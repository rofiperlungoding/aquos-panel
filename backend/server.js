require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const pm2Manager = require('./services/pm2Manager');
const systemStats = require('./services/systemStats');

const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PANEL_PASSWORD = process.env.PANEL_PASSWORD || 'aquos123';
const JWT_SECRET = process.env.JWT_SECRET || 'aquos_ultra_secret_shield';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Authentication required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));


// Init PM2 connection
pm2Manager.connect();

// Directory where projects will be stored
const PROJECTS_DIR = path.join(__dirname, 'projects');
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// Auth API
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === PANEL_PASSWORD) {
        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// Protected REST APIs
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await systemStats.getStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects', authenticateToken, async (req, res) => {
    try {
        const list = await pm2Manager.listProjects();
        res.json({ projects: list });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
    const { repoUrl, branch = 'main', envVars = {} } = req.body;
    try {
        const result = await pm2Manager.deployProject(repoUrl, branch, envVars, PROJECTS_DIR);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/:name/action', authenticateToken, async (req, res) => {
    const { name } = req.params;
    const { action } = req.body; // start, stop, restart, delete
    try {
        const result = await pm2Manager.executeAction(name, action, PROJECTS_DIR);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto Updater APIs
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const REPO_ROOT = path.join(__dirname, '..'); // ~/aquos-panel (one level above /backend)

app.get('/api/system/check-update', async (req, res) => {
    try {
        await execPromise('git fetch --all', { cwd: REPO_ROOT });
        const { stdout: local } = await execPromise('git rev-parse HEAD', { cwd: REPO_ROOT });
        const { stdout: remote } = await execPromise('git rev-parse origin/master', { cwd: REPO_ROOT });
        res.json({ 
            updateAvailable: local.trim() !== remote.trim(),
            local: local.trim(),
            remote: remote.trim()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/system/update', async (req, res) => {
    res.json({ message: 'Update initiated' });
    setTimeout(() => {
        // Run from repo root so git pull works
        exec('git pull origin master && cd backend && npm install && pm2 reload aquos-panel', 
            { cwd: REPO_ROOT },
            (err) => {
                if (err) exec('pm2 restart aquos-panel');
            }
        );
    }, 1000);
});

// WebSocket for Terminal & Logs
wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const type = urlParams.get('type') || 'terminal';
    
    // Auth check for WS
    const token = urlParams.get('token');
    if (!token) {
        ws.close(1008, 'Auth Required');
        return;
    }

    try {
        jwt.verify(token, JWT_SECRET);
    } catch(e) {
        ws.close(1008, 'Invalid Token');
        return;
    }

    if (type === 'terminal') {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: parseInt(urlParams.get('cols') || 80),
            rows: parseInt(urlParams.get('rows') || 24),
            cwd: os.homedir(),
            env: process.env
        });

        ptyProcess.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'terminal-data', data }));
        });

        ws.on('message', (msg) => {
            const parsed = JSON.parse(msg);
            if (parsed.type === 'terminal-input') {
                ptyProcess.write(parsed.data);
            } else if (parsed.type === 'resize') {
                ptyProcess.resize(parsed.cols, parsed.rows);
            }
        });

        ws.on('close', () => {
            ptyProcess.kill();
        });
    } else if (type === 'logs') {
        // Will stream PM2 logs for a specific project
        const projectName = urlParams.get('project');
        // Logic to stream file logs using tail...
    }
});

const PORT = 2999;
server.listen(PORT, () => {
    console.log(`Universal Control Panel running on port ${PORT}`);
});
