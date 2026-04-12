const pm2 = require('pm2');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify((cmd, opts = {}, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    return exec(cmd, { maxBuffer: 1024 * 1024 * 10, ...opts }, cb);
});

// Local DB to track ports and project metadata
const dbPath = path.join(__dirname, '..', 'data', 'projects.json');

// Event emitter for deploy progress
const EventEmitter = require('events');
const deployEmitter = new EventEmitter();

function connect() {
    pm2.connect((err) => {
        if (err) {
            console.error('Failed to connect to PM2:', err);
        } else {
            console.log('Connected to PM2');
        }
    });

    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
}

function getDB() {
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch {
        return {};
    }
}

function saveDB(db) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function getNextPort(db) {
    let max = 3000;
    for (const key in db) {
        if (db[key].port > max) max = db[key].port;
    }
    return max + 1;
}

// ─── Stack Detection ────────────────────────────────────────────────────────

function detectEntryPoint(folderPath) {
    // Node.js detection
    const pkgPath = path.join(folderPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

            // Check "main" field first
            if (pkg.main && fs.existsSync(path.join(folderPath, pkg.main))) {
                return { stack: 'Node.js', entryFile: pkg.main, installCmd: 'npm install' };
            }

            // Check "scripts.start" — if it points to a file
            if (pkg.scripts && pkg.scripts.start) {
                const startScript = pkg.scripts.start;
                // e.g. "node server.js" or "node src/index.js"
                const nodeMatch = startScript.match(/node\s+(.+)/);
                if (nodeMatch) {
                    const entry = nodeMatch[1].trim().split(' ')[0];
                    if (fs.existsSync(path.join(folderPath, entry))) {
                        return { stack: 'Node.js', entryFile: entry, installCmd: 'npm install' };
                    }
                }
                // Has start script but can't parse → use npm start mode
                return { stack: 'Node.js', useNpmStart: true, installCmd: 'npm install' };
            }
        } catch (e) { /* ignore json parse errors */ }

        // Scan for common entry files
        const candidates = ['server.js', 'index.js', 'app.js', 'main.js', 'src/index.js', 'src/server.js', 'src/app.js'];
        for (const c of candidates) {
            if (fs.existsSync(path.join(folderPath, c))) {
                return { stack: 'Node.js', entryFile: c, installCmd: 'npm install' };
            }
        }

        // Fallback: has package.json but no detectable entry → use npm start
        return { stack: 'Node.js', useNpmStart: true, installCmd: 'npm install' };
    }

    // Python detection
    if (fs.existsSync(path.join(folderPath, 'requirements.txt'))) {
        const pyCandidates = ['app.py', 'main.py', 'server.py', 'wsgi.py', 'manage.py', 'run.py'];
        for (const c of pyCandidates) {
            if (fs.existsSync(path.join(folderPath, c))) {
                return { stack: 'Python', entryFile: c, installCmd: 'pip install -r requirements.txt' };
            }
        }
        return { stack: 'Python', entryFile: 'app.py', installCmd: 'pip install -r requirements.txt' };
    }

    // Go detection
    if (fs.existsSync(path.join(folderPath, 'go.mod'))) {
        return { stack: 'Go', entryFile: '.', installCmd: 'go build -o app .', binary: './app' };
    }

    // Fallback: look for a start.sh
    if (fs.existsSync(path.join(folderPath, 'start.sh'))) {
        return { stack: 'Shell', entryFile: 'start.sh', installCmd: null };
    }

    return null; // Can't detect
}

// ─── List Projects ──────────────────────────────────────────────────────────

function listProjects() {
    return new Promise((resolve, reject) => {
        pm2.list((err, list) => {
            if (err) return reject(err);
            const db = getDB();

            const projects = list.map(app => {
                const name = app.name;
                const meta = db[name] || {};
                return {
                    name,
                    status: app.pm2_env.status,
                    uptime: app.pm2_env.pm_uptime,
                    memory: app.monit.memory,
                    cpu: app.monit.cpu,
                    port: meta.port,
                    stack: meta.stack,
                    repoUrl: meta.repoUrl,
                    branch: meta.branch || 'main',
                    deployedAt: meta.deployedAt,
                    lastUpdated: meta.lastUpdated
                };
            });
            resolve(projects);
        });
    });
}

// ─── Deploy Project ─────────────────────────────────────────────────────────

function emitProgress(deployId, step, message, status = 'running') {
    deployEmitter.emit('progress', { deployId, step, message, status });
}

async function deployProject(repoUrl, branch = 'main', envVars = {}, projectsDir) {
    // Generate a unique deploy ID for progress tracking
    const deployId = Date.now().toString(36);

    // 1. Extract name from repo URL
    const nameMatch = repoUrl.match(/\/([^\/]+)\.git|([^\/]+)$/);
    let name = nameMatch ? (nameMatch[1] || nameMatch[2]) : 'auto-app';
    name = name.replace('.git', '');

    const projectPath = path.join(projectsDir, name);

    try {
        // Step 1: Clone or pull
        emitProgress(deployId, 'clone', `Cloning ${repoUrl} (branch: ${branch})...`);

        if (fs.existsSync(projectPath)) {
            await execPromise(`git -C "${projectPath}" fetch && git -C "${projectPath}" checkout ${branch} && git -C "${projectPath}" pull origin ${branch}`);
            emitProgress(deployId, 'clone', 'Repository updated.', 'done');
        } else {
            await execPromise(`git clone -b ${branch} "${repoUrl}" "${projectPath}"`);
            emitProgress(deployId, 'clone', 'Repository cloned.', 'done');
        }

        // Step 2: Detect server folder
        emitProgress(deployId, 'detect', 'Looking for server/ folder...');
        let serverPath = projectPath;
        if (fs.existsSync(path.join(projectPath, 'server'))) {
            serverPath = path.join(projectPath, 'server');
            emitProgress(deployId, 'detect', 'Found server/ folder — using it as root.', 'done');
        } else {
            emitProgress(deployId, 'detect', 'No server/ folder found — using project root.', 'done');
        }

        // Step 3: Detect stack
        emitProgress(deployId, 'stack', 'Auto-detecting stack...');
        const detection = detectEntryPoint(serverPath);
        if (!detection) {
            emitProgress(deployId, 'stack', 'Could not detect stack. Add package.json, requirements.txt, or go.mod.', 'error');
            throw new Error(`Cannot detect stack for ${name}. No package.json, requirements.txt, or go.mod found in ${serverPath === projectPath ? 'project root' : 'server/ folder'}.`);
        }
        emitProgress(deployId, 'stack', `Detected: ${detection.stack}${detection.entryFile ? ` → ${detection.entryFile}` : ''}`, 'done');

        // Step 4: Install dependencies
        if (detection.installCmd) {
            emitProgress(deployId, 'install', `Installing dependencies: ${detection.installCmd}...`);
            await execPromise(detection.installCmd, { cwd: serverPath });
            emitProgress(deployId, 'install', 'Dependencies installed.', 'done');
        } else {
            emitProgress(deployId, 'install', 'No install step needed.', 'done');
        }

        // Step 5: Assign port
        const db = getDB();
        let port = db[name]?.port;
        if (!port) {
            port = getNextPort(db);
        }

        // Step 6: Build PM2 config
        emitProgress(deployId, 'start', `Starting ${name} on port ${port}...`);

        let pm2Config;
        if (detection.stack === 'Node.js') {
            if (detection.useNpmStart) {
                pm2Config = {
                    name,
                    script: 'npm',
                    args: 'start',
                    cwd: serverPath,
                    interpreter: 'none',
                    env: { PORT: port, NODE_ENV: 'production', ...envVars }
                };
            } else {
                pm2Config = {
                    name,
                    script: detection.entryFile,
                    cwd: serverPath,
                    interpreter: 'node',
                    env: { PORT: port, NODE_ENV: 'production', ...envVars }
                };
            }
        } else if (detection.stack === 'Python') {
            pm2Config = {
                name,
                script: detection.entryFile,
                cwd: serverPath,
                interpreter: 'python3',
                env: { PORT: port, ...envVars }
            };
        } else if (detection.stack === 'Go') {
            // Go binary already built during install
            pm2Config = {
                name,
                script: detection.binary || './app',
                cwd: serverPath,
                interpreter: 'none',
                env: { PORT: port, ...envVars }
            };
        } else if (detection.stack === 'Shell') {
            pm2Config = {
                name,
                script: detection.entryFile,
                cwd: serverPath,
                interpreter: 'bash',
                env: { PORT: port, ...envVars }
            };
        }

        // Stop existing if running
        try { await new Promise((res, rej) => pm2.delete(name, () => res())); } catch (e) { /* ignore */ }

        // Start on PM2
        await new Promise((resolve, reject) => {
            pm2.start(pm2Config, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Save metadata
        const now = new Date().toISOString();
        db[name] = {
            repoUrl,
            branch,
            port,
            stack: detection.stack,
            entryFile: detection.entryFile || null,
            serverPath,
            envVars,
            deployedAt: db[name]?.deployedAt || now,
            lastUpdated: now
        };
        saveDB(db);

        emitProgress(deployId, 'start', `${name} is running on port ${port}.`, 'done');
        emitProgress(deployId, 'complete', `Deployment complete! 🚀`, 'done');

        return { success: true, name, port, stack: detection.stack, deployId };

    } catch (err) {
        emitProgress(deployId, 'error', err.message, 'error');
        throw err;
    }
}

// ─── Update Project (git pull + reinstall + restart) ────────────────────────

async function updateProject(name) {
    const db = getDB();
    const meta = db[name];
    if (!meta) throw new Error(`Project "${name}" not found in registry.`);

    const serverPath = meta.serverPath;
    // The project root is either serverPath or its parent (if server/ is used)
    const projectRoot = serverPath.endsWith(path.sep + 'server')
        ? path.dirname(serverPath)
        : serverPath;

    // 1. Git pull
    const branch = meta.branch || 'main';
    await execPromise(`git -C "${projectRoot}" pull origin ${branch}`);

    // 2. Reinstall deps
    const detection = detectEntryPoint(serverPath);
    if (detection && detection.installCmd) {
        await execPromise(detection.installCmd, { cwd: serverPath });
    }

    // 3. Restart PM2 process
    await new Promise((resolve, reject) => {
        pm2.restart(name, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    // 4. Update metadata
    meta.lastUpdated = new Date().toISOString();
    if (detection) {
        meta.stack = detection.stack;
        meta.entryFile = detection.entryFile || null;
    }
    saveDB(db);

    return { success: true, name, lastUpdated: meta.lastUpdated };
}

// ─── Get Project Detail ─────────────────────────────────────────────────────

async function getProjectDetail(name) {
    const db = getDB();
    const meta = db[name] || {
        repoUrl: 'Unknown',
        branch: 'N/A',
        port: 'N/A',
        stack: 'Unknown',
        entryFile: 'N/A',
        envVars: {},
        deployedAt: 'N/A',
        lastUpdated: 'N/A',
        serverPath: process.cwd()
    };

    // Get PM2 process info
    const pm2Info = await new Promise((resolve, reject) => {
        pm2.describe(name, (err, desc) => {
            if (err) return reject(err);
            resolve(desc[0] || null);
        });
    });

    // Determine the working directory
    // Priority: meta.serverPath > pm2Info.pm2_env.pm_cwd
    const workingDir = meta.serverPath || pm2Info?.pm2_env?.pm_cwd || process.cwd();

    // The project root is usually workingDir, but we check if it's a subfolder like 'server/'
    let projectRoot = workingDir;
    if (workingDir.endsWith(path.sep + 'server')) {
        projectRoot = path.dirname(workingDir);
    }

    let gitInfo = {};
    try {
        // Check if it's actually a git repo
        await execPromise(`git -C "${projectRoot}" rev-parse --is-inside-work-tree`);
        
        const { stdout: branch } = await execPromise(`git -C "${projectRoot}" rev-parse --abbrev-ref HEAD`);
        const { stdout: commitHash } = await execPromise(`git -C "${projectRoot}" rev-parse --short HEAD`);
        const { stdout: commitMsg } = await execPromise(`git -C "${projectRoot}" log -1 --pretty=format:"%s"`);
        const { stdout: commitDate } = await execPromise(`git -C "${projectRoot}" log -1 --pretty=format:"%ci"`);
        const { stdout: remoteUrl } = await execPromise(`git -C "${projectRoot}" config --get remote.origin.url`).catch(() => ({ stdout: '' }));

        gitInfo = {
            branch: branch.trim(),
            lastCommit: {
                hash: commitHash.trim(),
                message: commitMsg.trim(),
                date: commitDate.trim()
            },
            remoteUrl: remoteUrl.trim() || meta.repoUrl
        };
    } catch (e) {
        gitInfo = { error: 'Not a git repository or git not found' };
    }

    // Get folder size
    let diskSize = 'unknown';
    try {
        const { stdout } = await execPromise(`du -sh "${workingDir}" | awk '{print $1}'`);
        diskSize = stdout.trim();
    } catch (e) { /* ignore */ }

    return {
        name,
        repoUrl: gitInfo.remoteUrl || meta.repoUrl,
        branch: gitInfo.branch || meta.branch,
        port: meta.port,
        stack: meta.stack,
        entryFile: meta.entryFile,
        envVars: meta.envVars || {},
        deployedAt: meta.deployedAt,
        lastUpdated: meta.lastUpdated,
        serverPath: workingDir,
        diskSize,
        git: gitInfo,
        process: pm2Info ? {
            status: pm2Info.pm2_env.status,
            uptime: pm2Info.pm2_env.pm_uptime,
            restarts: pm2Info.pm2_env.restart_time,
            memory: pm2Info.monit.memory,
            cpu: pm2Info.monit.cpu
        } : null
    };
}

// ─── Get Project Logs ───────────────────────────────────────────────────────

async function getProjectLogs(name, lines = 100) {
    // PM2 stores logs in ~/.pm2/logs/
    const homedir = require('os').homedir();
    const outLog = path.join(homedir, '.pm2', 'logs', `${name}-out.log`);
    const errLog = path.join(homedir, '.pm2', 'logs', `${name}-error.log`);

    let output = '';
    let errors = '';

    try {
        if (fs.existsSync(outLog)) {
            const { stdout } = await execPromise(`tail -n ${lines} "${outLog}"`);
            output = stdout;
        }
    } catch (e) { output = '(no output logs)'; }

    try {
        if (fs.existsSync(errLog)) {
            const { stdout } = await execPromise(`tail -n ${lines} "${errLog}"`);
            errors = stdout;
        }
    } catch (e) { errors = '(no error logs)'; }

    return { stdout: output, stderr: errors };
}

// ─── Update Env Vars ────────────────────────────────────────────────────────

async function updateEnvVars(name, envVars) {
    const db = getDB();
    const meta = db[name];
    if (!meta) throw new Error(`Project "${name}" not found.`);

    meta.envVars = envVars;
    meta.lastUpdated = new Date().toISOString();
    saveDB(db);

    // Restart with new env
    await new Promise((resolve, reject) => {
        pm2.restart(name, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    return { success: true };
}

// ─── Execute Action (start/stop/restart/delete) ─────────────────────────────

function executeAction(name, action, projectsDir) {
    return new Promise((resolve, reject) => {
        if (!['start', 'stop', 'restart', 'delete'].includes(action)) {
            return reject(new Error('Invalid action. Use: start, stop, restart, delete'));
        }

        pm2[action](name, (err) => {
            if (action === 'delete') {
                const db = getDB();
                if (db[name]) {
                    // Also remove cloned files
                    if (projectsDir) {
                        const projectPath = path.join(projectsDir, name);
                        try {
                            if (fs.existsSync(projectPath)) {
                                fs.rmSync(projectPath, { recursive: true, force: true });
                            }
                        } catch (e) { console.error('Failed to remove project files:', e.message); }
                    }
                    delete db[name];
                    saveDB(db);
                }
                if (err && err.message && err.message.includes('process name not found')) {
                    return resolve(true);
                }
            }
            if (err) return reject(err);
            resolve(true);
        });
    });
}

module.exports = {
    connect,
    deployProject,
    updateProject,
    listProjects,
    getProjectDetail,
    getProjectLogs,
    updateEnvVars,
    executeAction,
    deployEmitter
};
