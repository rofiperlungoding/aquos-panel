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

function getNextPort(db) {
    let max = 3000;
    for (const key in db) {
        if (db[key].port > max) max = db[key].port;
    }
    return max + 1;
}

function listProjects() {
    return new Promise((resolve, reject) => {
        pm2.list((err, list) => {
            if (err) return reject(err);
            const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            
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
                    stack: meta.stack
                };
            });
            resolve(projects);
        });
    });
}

function detectStackStatus(folderPath) {
    if (fs.existsSync(path.join(folderPath, 'package.json'))) {
        return { stack: 'Node.js', script: 'npm', args: 'start' };
    }
    if (fs.existsSync(path.join(folderPath, 'requirements.txt'))) {
        // Find python mains
        return { stack: 'Python', script: 'python3', args: 'app.py' }; // Simplistic for now
    }
    if (fs.existsSync(path.join(folderPath, 'go.mod'))) {
        return { stack: 'Go', script: 'go', args: 'run main.go' };
    }
    return { stack: 'Unknown', script: 'bash', args: 'start.sh' }; // Fallback
}

async function deployProject(repoUrl, branch, envVars, projectsDir) {
    // 1. Extract name from repo URL
    const nameMatch = repoUrl.match(/\/([^\/]+)\.git|([^\/]+)$/);
    let name = nameMatch ? (nameMatch[1] || nameMatch[2]) : 'auto-app';
    name = name.replace('.git', '');

    const projectPath = path.join(projectsDir, name);

    // 2. Clone Repository
    if (fs.existsSync(projectPath)) {
        await execPromise(`cd ${projectPath} && git fetch && git checkout ${branch} && git pull`);
    } else {
        await execPromise(`git clone -b ${branch} ${repoUrl} ${projectPath}`);
    }

    // 3. Look for 'server' directory inside project
    let serverPath = projectPath;
    if (fs.existsSync(path.join(projectPath, 'server'))) {
        serverPath = path.join(projectPath, 'server');
    }

    // 4. Auto detect Stack
    const { stack, script, args } = detectStackStatus(serverPath);

    // 5. Install dependencies
    if (stack === 'Node.js') {
        await execPromise(`cd ${serverPath} && npm install`);
    } else if (stack === 'Python') {
        await execPromise(`cd ${serverPath} && pip install -r requirements.txt`);
    }

    // 6. Assign Port
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let port = db[name]?.port;
    if (!port) {
        port = getNextPort(db);
    }
    
    // Save metadata
    db[name] = { repoUrl, port, stack, serverPath };
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    // Combine ENVs
    const pm2EnvParams = {
        PORT: port,
        ...envVars
    };

    // 7. Start on PM2
    return new Promise((resolve, reject) => {
        pm2.start({
            name,
            script: script,
            args: args,
            cwd: serverPath,
            env: pm2EnvParams,
            interpreter: stack === 'Node.js' ? 'node' : 'none'
        }, (err, apps) => {
            if (err) return reject(err);
            resolve({ success: true, name, port, stack });
        });
    });
}

function executeAction(name, action) {
    return new Promise((resolve, reject) => {
        if (!['start', 'stop', 'restart', 'delete'].includes(action)) {
            return reject(new Error('Invalid action'));
        }
        pm2[action](name, (err) => {
            if (action === 'delete') {
                try {
                    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                    if (db[name]) {
                        delete db[name];
                        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
                    }
                    if (err && err.message && err.message.includes('process name not found')) {
                        return resolve(true); // Ignore if already deleted
                    }
                } catch(e) {}
            }
            if (err) return reject(err);
            
            if (action === 'delete') {
                const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                if (db[name]) delete db[name];
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            }
            resolve(true);
        });
    });
}

module.exports = { connect, deployProject, listProjects, executeAction };
