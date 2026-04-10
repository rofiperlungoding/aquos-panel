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

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

// REST APIs
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await systemStats.getStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        const list = await pm2Manager.listProjects();
        res.json({ projects: list });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', async (req, res) => {
    const { repoUrl, branch = 'main', envVars = {} } = req.body;
    try {
        const result = await pm2Manager.deployProject(repoUrl, branch, envVars, PROJECTS_DIR);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/:name/action', async (req, res) => {
    const { name } = req.params;
    const { action } = req.body; // start, stop, restart, delete
    try {
        const result = await pm2Manager.executeAction(name, action, PROJECTS_DIR);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// WebSocket for Terminal & Logs
wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const type = urlParams.get('type') || 'terminal';
    
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
