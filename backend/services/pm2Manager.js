const pm2 = require('pm2');
const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');
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
    if (!folderPath || !fs.existsSync(folderPath)) return null;

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

// ─── Detect stack from PM2 process info ─────────────────────────────────────

function detectStackFromPM2(pm2Env) {
    if (!pm2Env) return 'Unknown';
    const interpreter = pm2Env.exec_interpreter || '';
    const script = pm2Env.pm_exec_path || '';
    
    if (interpreter.includes('node') || script.endsWith('.js') || script.endsWith('.mjs')) return 'Node.js';
    if (interpreter.includes('python')) return 'Python';
    if (interpreter === 'none' && (script.endsWith('.sh') || script.includes('bash'))) return 'Shell';
    if (interpreter === 'none') return 'Binary';
    return 'Unknown';
}

// ─── Detect port from PM2 process env ───────────────────────────────────────

function detectPortFromPM2(pm2Env) {
    if (!pm2Env) return null;
    // Check env vars in priority order
    const envObj = pm2Env.env || {};
    if (envObj.PORT) return parseInt(envObj.PORT);
    if (pm2Env.PORT) return parseInt(pm2Env.PORT);
    // Check args for --port or -p
    const args = pm2Env.args || [];
    if (typeof args === 'string') {
        const portMatch = args.match(/(?:--port|-p)\s*(\d+)/);
        if (portMatch) return parseInt(portMatch[1]);
    }
    return null;
}

// ─── List Projects ──────────────────────────────────────────────────────────

function listProjects() {
    return new Promise((resolve, reject) => {
        pm2.list((err, list) => {
            if (err) return reject(err);
            const db = getDB();

            const projects = list.map(app => {
                const name = app.name;
                const meta = db[name];
                const pm2Env = app.pm2_env || {};
                
                // For manually-started apps, auto-detect what we can
                const port = (meta && meta.port) || detectPortFromPM2(pm2Env) || null;
                const stack = (meta && meta.stack) || detectStackFromPM2(pm2Env);

                return {
                    name,
                    status: pm2Env.status,
                    uptime: pm2Env.pm_uptime,
                    memory: app.monit ? app.monit.memory : 0,
                    cpu: app.monit ? app.monit.cpu : 0,
                    port,
                    stack,
                    repoUrl: meta ? meta.repoUrl : null,
                    branch: (meta && meta.branch) || null,
                    deployedAt: meta ? meta.deployedAt : null,
                    lastUpdated: meta ? meta.lastUpdated : null
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

    // For manually-started PM2 apps (not in our registry),
    // get path from PM2 directly and do git pull + restart
    let workingDir = null;
    let projectRoot = null;
    let branch = 'main';

    if (meta) {
        workingDir = meta.serverPath;
        branch = meta.branch || 'main';
    } else {
        // Get from PM2
        const pm2Info = await new Promise((resolve) => {
            pm2.describe(name, (err, desc) => {
                if (err || !desc || !desc[0]) return resolve(null);
                resolve(desc[0]);
            });
        });
        if (!pm2Info) throw new Error(`Process "${name}" not found.`);
        workingDir = pm2Info.pm2_env?.pm_cwd || null;
        if (!workingDir) throw new Error(`Cannot determine working directory for "${name}".`);
    }

    // The project root is either workingDir or its parent (if server/ is used)
    projectRoot = workingDir;
    if (workingDir.endsWith(path.sep + 'server')) {
        projectRoot = path.dirname(workingDir);
    }

    // 1. Git pull (non-fatal if not a git repo)
    try {
        // Detect branch from git if not in registry
        if (!meta) {
            try {
                const { stdout: branchOut } = await execPromise(`git -C "${projectRoot}" rev-parse --abbrev-ref HEAD`, { timeout: 3000 });
                branch = branchOut.trim() || 'main';
            } catch (e) { /* use default */ }
        }
        await execPromise(`git -C "${projectRoot}" pull origin ${branch}`, { timeout: 15000 });
    } catch (e) {
        console.error(`Git pull failed for ${name}:`, e.message);
        // Continue anyway — maybe not a git repo, just restart
    }

    // 2. Reinstall deps
    const detection = detectEntryPoint(workingDir);
    if (detection && detection.installCmd) {
        try {
            await execPromise(detection.installCmd, { cwd: workingDir, timeout: 30000 });
        } catch (e) {
            console.error(`Install failed for ${name}:`, e.message);
        }
    }

    // 3. Restart PM2 process
    await new Promise((resolve, reject) => {
        pm2.restart(name, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    // 4. Update metadata (only if in registry)
    const now = new Date().toISOString();
    if (meta) {
        meta.lastUpdated = now;
        if (detection) {
            meta.stack = detection.stack;
            meta.entryFile = detection.entryFile || null;
        }
        saveDB(db);
    }

    return { success: true, name, lastUpdated: now };
}

// ─── Get Project Detail ─────────────────────────────────────────────────────

async function getProjectDetail(name) {
    // Master timeout: if anything takes >5s total, return partial data
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Detail fetch timeout')), 5000)
    );

    try {
        return await Promise.race([timeoutPromise, _getProjectDetailInner(name)]);
    } catch (e) {
        // Return minimal data so frontend never hangs
        return {
            name,
            repoUrl: 'N/A',
            branch: 'N/A',
            port: null,
            stack: 'Unknown',
            entryFile: 'N/A',
            envVars: {},
            deployedAt: null,
            lastUpdated: null,
            serverPath: 'N/A',
            diskSize: 'unknown',
            git: { error: e.message || 'Timeout fetching details' },
            process: null
        };
    }
}

async function _getProjectDetailInner(name) {
    const db = getDB();
    const meta = db[name] || null;
    const isManaged = !!meta; // true if deployed via panel

    // Step 1: Get PM2 process info FIRST (we need pm_cwd)
    let pm2Info = null;
    try {
        pm2Info = await new Promise((resolve) => {
            pm2.describe(name, (err, desc) => {
                if (err) return resolve(null);
                resolve(desc && desc[0] ? desc[0] : null);
            });
        });
    } catch (e) { pm2Info = null; }

    const pm2Env = pm2Info ? pm2Info.pm2_env : null;

    // Step 2: Determine working directory
    let workingDir;
    if (isManaged && meta.serverPath) {
        workingDir = meta.serverPath;
    } else if (pm2Env && pm2Env.pm_cwd) {
        workingDir = pm2Env.pm_cwd;
    } else {
        workingDir = null;
    }

    // Step 3: Auto-detect port & stack for unmanaged processes
    const port = (isManaged && meta.port) || detectPortFromPM2(pm2Env) || null;
    const stack = (isManaged && meta.stack) || detectStackFromPM2(pm2Env);
    
    // Step 4: Try to detect entry file
    let entryFile = (isManaged && meta.entryFile) || null;
    if (!entryFile && pm2Env) {
        // Get from PM2 exec path
        const execPath = pm2Env.pm_exec_path || '';
        if (execPath && workingDir) {
            entryFile = path.relative(workingDir, execPath) || path.basename(execPath);
        } else {
            entryFile = path.basename(execPath) || 'N/A';
        }
    }

    // Step 5: Get env vars (from registry or PM2)
    let envVars = {};
    if (isManaged) {
        envVars = meta.envVars || {};
    } else if (pm2Env && pm2Env.env) {
        // Extract user-set env vars (filter out system ones)
        const systemKeys = new Set(['PATH', 'HOME', 'SHELL', 'USER', 'TERM', 'LANG', 'LOGNAME',
            'HOSTNAME', 'PWD', 'OLDPWD', 'SHLVL', '_', 'LS_COLORS', 'MAIL',
            'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'SSH_AUTH_SOCK',
            'SSH_AGENT_PID', 'DISPLAY', 'COLORTERM', 'TERM_PROGRAM',
            'NODE_ENV', 'unique_id', 'PM2_HOME', 'PM2_INTERACTOR_PROCESSING',
            'PM2_USAGE', 'km_link', 'pm_id', 'status', 'unstable_restarts',
            'restart_time', 'pm_uptime', 'created_at', 'axm_dynamic',
            'axm_options', 'axm_monitor', 'axm_actions',
            'USERNAME', 'USERDOMAIN', 'ALLUSERSPROFILE', 'APPDATA',
            'CommonProgramFiles', 'COMPUTERNAME', 'ComSpec', 'DriverData',
            'HOMEDRIVE', 'HOMEPATH', 'LOCALAPPDATA', 'NUMBER_OF_PROCESSORS',
            'OS', 'PATHEXT', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER',
            'PROCESSOR_LEVEL', 'PROCESSOR_REVISION', 'ProgramData',
            'ProgramFiles', 'PSModulePath', 'PUBLIC', 'SystemDrive',
            'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'windir',
            'ANDROID_DATA', 'ANDROID_ROOT', 'PREFIX', 'TMPDIR']);
        for (const [k, v] of Object.entries(pm2Env.env)) {
            if (!systemKeys.has(k) && typeof v === 'string') {
                envVars[k] = v;
            }
        }
    }

    // Step 6: Project root for git (go up if in server/ subfolder)
    let projectRoot = workingDir;
    if (workingDir && workingDir.endsWith(path.sep + 'server')) {
        projectRoot = path.dirname(workingDir);
    }

    // Step 7: Parallel data fetch (git + disk size) — only if we have a path
    let gitInfo = { error: 'No working directory found' };
    let diskSize = 'unknown';

    if (projectRoot) {
        const results = await Promise.allSettled([
            // Git info
            (async () => {
                try {
                    const { stdout: check } = await execPromise(
                        `git -C "${projectRoot}" rev-parse --is-inside-work-tree`,
                        { timeout: 2000 }
                    );
                    if (!check.toString().trim().startsWith('true')) return { isGit: false };

                    const { stdout } = await execPromise(
                        `git -C "${projectRoot}" log -1 --pretty=format:"%D|%h|%s|%ci"`,
                        { timeout: 2000 }
                    );
                    const parts = stdout.trim().split('|');
                    const branchRaw = parts[0] || '';
                    const hash = parts[1] || '';
                    const msg = parts[2] || '';
                    const date = parts[3] || '';

                    let gitBranch = 'main';
                    if (branchRaw.includes('->')) {
                        gitBranch = branchRaw.split('->')[1].split(',')[0].trim();
                    } else if (branchRaw.trim()) {
                        gitBranch = branchRaw.trim();
                    }

                    return { branch: gitBranch, lastCommit: { hash, message: msg, date }, isGit: true };
                } catch (e) { return { isGit: false }; }
            })(),

            // Disk size
            (async () => {
                try {
                    const { stdout } = await execPromise(
                        `du -sh "${workingDir}" | awk '{print $1}'`,
                        { timeout: 2000 }
                    );
                    return stdout.trim() || 'unknown';
                } catch (e) { return 'unknown'; }
            })()
        ]);

        const gitResult = results[0].status === 'fulfilled' ? results[0].value : { isGit: false };
        const duResult = results[1].status === 'fulfilled' ? results[1].value : 'unknown';

        if (gitResult.isGit) {
            gitInfo = { branch: gitResult.branch, lastCommit: gitResult.lastCommit };
        } else {
            gitInfo = { error: 'Not a git repository' };
        }
        diskSize = duResult;
    }

    return {
        name,
        repoUrl: (isManaged && meta.repoUrl && meta.repoUrl !== 'Unknown') ? meta.repoUrl : (gitInfo.branch ? 'Local Git' : 'N/A'),
        branch: gitInfo.branch || (isManaged && meta.branch) || 'N/A',
        port,
        stack,
        entryFile: entryFile || 'N/A',
        envVars,
        deployedAt: isManaged ? meta.deployedAt : null,
        lastUpdated: isManaged ? meta.lastUpdated : null,
        serverPath: workingDir || 'N/A',
        diskSize,
        git: gitInfo,
        process: pm2Info ? {
            status: pm2Env.status,
            uptime: pm2Env.pm_uptime,
            restarts: pm2Env.restart_time,
            memory: pm2Info.monit ? pm2Info.monit.memory : 0,
            cpu: pm2Info.monit ? pm2Info.monit.cpu : 0
        } : null
    };
}

// ─── Get Project Logs ───────────────────────────────────────────────────────

async function getProjectLogs(name, lines = 100) {
    // PM2 stores logs in ~/.pm2/logs/
    const homedir = os.homedir();
    const outLog = path.join(homedir, '.pm2', 'logs', `${name}-out.log`);
    const errLog = path.join(homedir, '.pm2', 'logs', `${name}-error.log`);

    let output = '';
    let errors = '';

    // Check if files exist and read them
    try {
        if (fs.existsSync(outLog)) {
            const { stdout } = await execPromise(`tail -n ${lines} "${outLog}"`, { timeout: 3000 });
            output = stdout || '';
        }
    } catch (e) { output = ''; }

    try {
        if (fs.existsSync(errLog)) {
            const { stdout } = await execPromise(`tail -n ${lines} "${errLog}"`, { timeout: 3000 });
            errors = stdout || '';
        }
    } catch (e) { errors = ''; }

    // If no log files found, try to get from PM2 describe
    if (!output && !errors) {
        try {
            const info = await new Promise((resolve) => {
                pm2.describe(name, (err, desc) => {
                    if (err || !desc || !desc[0]) return resolve(null);
                    resolve(desc[0]);
                });
            });
            if (info && info.pm2_env) {
                const altOut = info.pm2_env.pm_out_log_path;
                const altErr = info.pm2_env.pm_err_log_path;
                if (altOut && fs.existsSync(altOut)) {
                    try {
                        const { stdout } = await execPromise(`tail -n ${lines} "${altOut}"`, { timeout: 3000 });
                        output = stdout || '';
                    } catch (e) {}
                }
                if (altErr && fs.existsSync(altErr)) {
                    try {
                        const { stdout } = await execPromise(`tail -n ${lines} "${altErr}"`, { timeout: 3000 });
                        errors = stdout || '';
                    } catch (e) {}
                }
            }
        } catch (e) {}
    }

    return { stdout: output || '(no output)', stderr: errors || '' };
}

// ─── Update Env Vars ────────────────────────────────────────────────────────

async function updateEnvVars(name, envVars) {
    const db = getDB();
    let meta = db[name];

    // For unmanaged processes, create a registry entry on the fly
    if (!meta) {
        // Get path from PM2
        const pm2Info = await new Promise((resolve) => {
            pm2.describe(name, (err, desc) => {
                if (err || !desc || !desc[0]) return resolve(null);
                resolve(desc[0]);
            });
        });
        if (!pm2Info) throw new Error(`Process "${name}" not found.`);

        const pm2Env = pm2Info.pm2_env || {};
        meta = {
            repoUrl: 'Unknown',
            branch: 'N/A',
            port: detectPortFromPM2(pm2Env),
            stack: detectStackFromPM2(pm2Env),
            entryFile: pm2Env.pm_exec_path ? path.basename(pm2Env.pm_exec_path) : 'N/A',
            serverPath: pm2Env.pm_cwd || null,
            envVars: {},
            deployedAt: null,
            lastUpdated: null
        };
    }

    meta.envVars = envVars;
    meta.lastUpdated = new Date().toISOString();
    db[name] = meta;
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
