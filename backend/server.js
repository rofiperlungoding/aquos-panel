require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');
let pty;
try {
    pty = require('node-pty');
} catch (e) {
    console.error('node-pty not found or failed to load. Terminal will use fallback spawn.');
}
const os = require('os');
const path = require('path');
const fs = require('fs');
const pm2Manager = require('./services/pm2Manager');
const systemStats = require('./services/systemStats');
const aiSentinel = require('./services/aiSentinel');

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

// ─── Performance: Gzip Compression ─────────────────────────────────────────
// Manual gzip middleware (no extra dependency needed)

app.use((req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip')) return next();
    
    // Only compress JSON API responses, not static files (those are handled by express.static)
    const originalJson = res.json.bind(res);
    res.json = (data) => {
        const raw = JSON.stringify(data);
        
        // Only gzip if response is > 1KB
        if (raw.length < 1024) return originalJson(data);
        
        zlib.gzip(Buffer.from(raw), (err, compressed) => {
            if (err) return originalJson(data);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Vary', 'Accept-Encoding');
            res.end(compressed);
        });
    };
    next();
});

app.use(cors());
app.use(express.json());

// ─── Static files with aggressive caching ───────────────────────────────────

app.use(express.static(path.join(__dirname, '../frontend/dist'), { 
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            // HTML: no cache (so updates are picked up)
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.match(/\.(js|css)$/)) {
            // JS/CSS with hash in filename: cache 1 year (immutable)
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.match(/\.(png|jpg|gif|svg|ico|woff2?)$/)) {
            // Assets: cache 30 days
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
    }
}));

// Init PM2 connection
pm2Manager.connect();

// Directory where projects will be stored
const PROJECTS_DIR = path.join(__dirname, 'projects');
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// ─── Auth API ───────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === PANEL_PASSWORD) {
        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// ─── System Stats ───────────────────────────────────────────────────────────

app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await systemStats.getStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Projects CRUD ──────────────────────────────────────────────────────────

app.get('/api/projects', authenticateToken, async (req, res) => {
    try {
        const list = await pm2Manager.listProjects();
        res.json({ projects: list });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deploy new project
app.post('/api/projects', authenticateToken, async (req, res) => {
    const { repoUrl, branch = 'main', envVars = {} } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

    try {
        const result = await pm2Manager.deployProject(repoUrl, branch, envVars, PROJECTS_DIR);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Project detail
app.get('/api/projects/:name', authenticateToken, async (req, res) => {
    // Set a hard timeout on the response
    const timer = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout', name: req.params.name });
        }
    }, 8000);

    try {
        const detail = await pm2Manager.getProjectDetail(req.params.name);
        clearTimeout(timer);
        if (!res.headersSent) res.json(detail);
    } catch (err) {
        clearTimeout(timer);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// Project logs
app.get('/api/projects/:name/logs', authenticateToken, async (req, res) => {
    try {
        const lines = parseInt(req.query.lines) || 100;
        const logs = await pm2Manager.getProjectLogs(req.params.name, lines);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Error Analysis via Mistral Codestral
app.post('/api/projects/:name/analyze-error', authenticateToken, async (req, res) => {
    try {
        // Fetch last 100 lines of stderr and stdout
        const logs = await pm2Manager.getProjectLogs(req.params.name, 100);
        // Fetch current system stats
        const stats = await systemStats.getStats();
        
        let combinedLogs = `[STDERR]\n${logs.stderr}\n\n[STDOUT]\n${logs.stdout}`;
        
        const analysis = await aiSentinel.analyzeError(req.params.name, combinedLogs, stats);
        res.json({ analysis });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Project actions (start/stop/restart/delete)
app.post('/api/projects/:name/action', authenticateToken, async (req, res) => {
    const { name } = req.params;
    const { action } = req.body;
    try {
        const result = await pm2Manager.executeAction(name, action, PROJECTS_DIR);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update project (git pull + reinstall + restart)
app.post('/api/projects/:name/update', authenticateToken, async (req, res) => {
    try {
        const result = await pm2Manager.updateProject(req.params.name);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update env vars
app.post('/api/projects/:name/env', authenticateToken, async (req, res) => {
    const { envVars } = req.body;
    try {
        const result = await pm2Manager.updateEnvVars(req.params.name, envVars || {});
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Auto Updater APIs ──────────────────────────────────────────────────────

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
        // 1. Hard reset to latest code
        // 2. Rebuild frontend (crucial!)
        // 3. Restart backend via PM2
        const updateCmd = 'git fetch origin master && git reset --hard origin/master && cd frontend && npm run build && cd .. && npx pm2 restart aquos-panel';
        
        exec(updateCmd, { cwd: REPO_ROOT }, (err, stdout, stderr) => {
            if (err) {
                console.error('Update failed:', err);
                console.error('Stderr:', stderr);
            }
        });
    }, 1000);
});

// ─── SPA Fallback (must be after all /api routes) ───────────────────────────

app.get(/.*/, (req, res) => {
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Pad the response so Chromium doesn't hijack the 404 page
        const padding = ' '.repeat(1024);
        res.status(404).json({ 
            error: 'Frontend not built or path invalid.', 
            pathChecked: indexPath,
            cwd: process.cwd(),
            __dirname: __dirname,
            padding 
        });
    }
});

// ─── WebSocket for Terminal, Logs, Deploy & Live Stats ──────────────────────

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
        const isWin = os.platform() === 'win32';
        let shell = isWin ? 'powershell.exe' : 'bash';
        
        // Termux check
        if (!isWin && fs.existsSync('/data/data/com.termux/files/usr/bin/bash')) {
            shell = '/data/data/com.termux/files/usr/bin/bash';
        }

        let ptyProcess = null;
        try {
            ptyProcess = pty.spawn(shell, isWin ? [] : ['-l'], { // Use login shell for bash
                name: 'xterm-256color',
                cols: parseInt(urlParams.get('cols') || 80),
                rows: parseInt(urlParams.get('rows') || 24),
                cwd: os.homedir(),
                env: { ...process.env, TERM: 'xterm-256color' }
            });

            ptyProcess.on('data', (data) => {
                if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'terminal-data', data }));
            });

            ptyProcess.on('exit', () => {
                if (ws.readyState === 1) ws.close();
            });
        } catch (err) {
            console.error('PTY spawn failed, falling back to simple spawn:', err);
            // Fallback to basic child_process if pty fails
            const { spawn } = require('child_process');
            const cp = spawn(shell, isWin ? [] : ['-i'], {
                cwd: os.homedir(),
                env: process.env,
                shell: true
            });

            cp.stdout.on('data', (data) => ws.send(JSON.stringify({ type: 'terminal-data', data: data.toString() })));
            cp.stderr.on('data', (data) => ws.send(JSON.stringify({ type: 'terminal-data', data: data.toString() })));
            
            ws.on('message', (msg) => {
                const parsed = JSON.parse(msg);
                if (parsed.type === 'terminal-input') cp.stdin.write(parsed.data);
            });

            ws.on('close', () => cp.kill());
            return;
        }

        ws.on('message', (msg) => {
            try {
                const parsed = JSON.parse(msg);
                if (parsed.type === 'terminal-input' && ptyProcess) {
                    ptyProcess.write(parsed.data);
                } else if (parsed.type === 'resize' && ptyProcess) {
                    ptyProcess.resize(parsed.cols, parsed.rows);
                }
            } catch (e) {}
        });

        ws.on('close', () => {
            if (ptyProcess) ptyProcess.kill();
        });

    } else if (type === 'live-stats') {
        // ─── LIVE STATS via WebSocket (replaces HTTP polling) ───────────────
        let alive = true;
        
        const pushStats = async () => {
            if (!alive || ws.readyState !== 1) return;
            
            try {
                const [stats, projects] = await Promise.all([
                    systemStats.getStats(),
                    pm2Manager.listProjects()
                ]);
                
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ 
                        type: 'live-stats', 
                        stats, 
                        projects 
                    }));
                }
            } catch (e) {
                // Don't crash the loop
            }
            
            if (alive) setTimeout(pushStats, 2000); // Push every 2s
        };
        
        // Start pushing immediately
        pushStats();
        
        ws.on('close', () => { alive = false; });
        ws.on('error', () => { alive = false; });

    } else if (type === 'deploy') {
        // Stream deploy progress events to the client
        const handler = (progress) => {
            if (ws.readyState === 1) { // OPEN
                ws.send(JSON.stringify({ type: 'deploy-progress', ...progress }));
            }
        };
        pm2Manager.deployEmitter.on('progress', handler);

        ws.on('close', () => {
            pm2Manager.deployEmitter.removeListener('progress', handler);
        });

    } else if (type === 'logs') {
        // Stream PM2 logs for a specific project
        const projectName = urlParams.get('project');
        if (!projectName) {
            ws.close(1008, 'Project name required');
            return;
        }

        // Tail log files and stream
        const homedir = os.homedir();
        const outLog = path.join(homedir, '.pm2', 'logs', `${projectName}-out.log`);
        const errLog = path.join(homedir, '.pm2', 'logs', `${projectName}-error.log`);

        let watchers = [];

        const streamFile = (filePath, logType) => {
            if (!fs.existsSync(filePath)) return;
            
            // Send last 50 lines initially
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n').slice(-50).join('\n');
                if (lines.trim()) {
                    ws.send(JSON.stringify({ type: 'log-data', logType, data: lines }));
                }
            } catch (e) { /* ignore */ }

            // Watch for changes
            try {
                const watcher = fs.watch(filePath, () => {
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const lines = content.split('\n').slice(-5).join('\n');
                        if (ws.readyState === 1) {
                            ws.send(JSON.stringify({ type: 'log-data', logType, data: lines }));
                        }
                    } catch (e) { /* ignore */ }
                });
                watchers.push(watcher);
            } catch (e) { /* ignore */ }
        };

        streamFile(outLog, 'stdout');
        streamFile(errLog, 'stderr');

        ws.on('close', () => {
            watchers.forEach(w => w.close());
        });
    }
});

const PORT = 2999;
server.listen(PORT, () => {
    console.log(`Universal Control Panel running on port ${PORT}`);
});
