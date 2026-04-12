#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  AQUOS LIVE DASHBOARD — Continuous Terminal Process Monitor   ║
 * ║  Run: node dashboard.js                                      ║
 * ║  Runs forever. Ctrl+C to exit.                               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const pm2 = require('pm2');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ─── ANSI Color Codes ───────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  inverse: '\x1b[7m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  
  // Bright
  brightGreen: '\x1b[92m',
  brightRed: '\x1b[91m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

// ─── State ──────────────────────────────────────────────────────────────────

let previousProcessNames = new Set();
let eventLog = [];
const MAX_EVENTS = 8;
let tickCount = 0;
let previousCpus = os.cpus();
let startTime = Date.now();

// ─── Helpers ────────────────────────────────────────────────────────────────

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H'); // Clear + move cursor to top
}

function moveTo(row, col) {
  process.stdout.write(`\x1b[${row};${col}H`);
}

function hideCursor() {
  process.stdout.write('\x1b[?25l');
}

function showCursor() {
  process.stdout.write('\x1b[?25h');
}

function pad(str, len, align = 'left', padChar = ' ') {
  str = String(str);
  if (str.length >= len) return str.substring(0, len);
  const diff = len - str.length;
  if (align === 'right') return padChar.repeat(diff) + str;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return padChar.repeat(left) + str + padChar.repeat(right);
  }
  return str + padChar.repeat(diff);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatUptime(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function getCpuUsage() {
  const currentCpus = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;
  for (let i = 0; i < currentCpus.length; i++) {
    const cur = currentCpus[i];
    const prev = previousCpus[i];
    if (!cur || !prev) continue;
    for (const type in cur.times) {
      totalDiff += cur.times[type] - prev.times[type];
    }
    idleDiff += cur.times.idle - prev.times.idle;
  }
  previousCpus = currentCpus;
  if (totalDiff === 0) return 0;
  return ((1 - idleDiff / totalDiff) * 100);
}

function progressBar(percent, width = 20, filledChar = '█', emptyChar = '░') {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  
  let color;
  if (p < 50) color = c.brightGreen;
  else if (p < 80) color = c.brightYellow;
  else color = c.brightRed;
  
  return `${color}${filledChar.repeat(filled)}${c.gray}${emptyChar.repeat(empty)}${c.reset}`;
}

function addEvent(type, message) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  eventLog.unshift({ time, type, message });
  if (eventLog.length > MAX_EVENTS) eventLog.pop();
}

function statusBadge(status) {
  if (status === 'online') return `${c.bgGreen}${c.black}${c.bold} ONLINE ${c.reset}`;
  if (status === 'stopped') return `${c.bgRed}${c.white}${c.bold} STOPPED ${c.reset}`;
  if (status === 'errored') return `${c.bgRed}${c.white}${c.bold} ERROR  ${c.reset}`;
  return `${c.bgYellow}${c.black}${c.bold} ${pad(status.toUpperCase(), 7)} ${c.reset}`;
}

async function getDiskStats() {
  try {
    const isWin = os.platform() === 'win32';
    if (isWin) return null;
    const { stdout } = await execPromise('df -k / | tail -1', { timeout: 2000 });
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 5) {
      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      if (!isNaN(total) && total > 0) {
        return {
          total: (total / (1024 * 1024)).toFixed(1),
          used: (used / (1024 * 1024)).toFixed(1),
          percentage: Math.round((used / total) * 100)
        };
      }
    }
  } catch (e) {}
  return null;
}

// ─── Render ─────────────────────────────────────────────────────────────────

async function render() {
  tickCount++;
  
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  
  // Get data
  const cpuPercent = getCpuUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = (usedMem / totalMem) * 100;
  const disk = await getDiskStats();
  const dashUptime = (Date.now() - startTime) / 1000;
  
  // Get PM2 processes
  const processes = await new Promise((resolve) => {
    pm2.list((err, list) => {
      if (err) return resolve([]);
      resolve(list);
    });
  });
  
  // Detect changes
  const currentNames = new Set(processes.map(p => p.name));
  
  for (const name of currentNames) {
    if (!previousProcessNames.has(name)) {
      addEvent('add', `${name} appeared`);
    }
  }
  for (const name of previousProcessNames) {
    if (!currentNames.has(name)) {
      addEvent('remove', `${name} disappeared`);
    }
  }
  
  // Check for status changes
  for (const proc of processes) {
    const status = proc.pm2_env?.status;
    const prevStatus = previousProcessStatus?.[proc.name];
    if (prevStatus && prevStatus !== status) {
      addEvent('status', `${proc.name}: ${prevStatus} → ${status}`);
    }
  }
  
  // Store for next tick
  previousProcessNames = currentNames;
  previousProcessStatus = {};
  for (const proc of processes) {
    previousProcessStatus[proc.name] = proc.pm2_env?.status;
  }
  
  // Sort: online first, then by name
  processes.sort((a, b) => {
    const aOnline = a.pm2_env?.status === 'online' ? 0 : 1;
    const bOnline = b.pm2_env?.status === 'online' ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return a.name.localeCompare(b.name);
  });
  
  // Total resource usage across all processes
  let totalProcCpu = 0;
  let totalProcMem = 0;
  let onlineCount = 0;
  let stoppedCount = 0;
  
  for (const p of processes) {
    totalProcCpu += p.monit?.cpu || 0;
    totalProcMem += p.monit?.memory || 0;
    if (p.pm2_env?.status === 'online') onlineCount++;
    else stoppedCount++;
  }

  // ── Build Output ──────────────────────────────────────────────────────────

  let output = '';
  const line = (s = '') => { output += s + '\n'; };
  const hr = () => { line(`${c.gray}${'─'.repeat(Math.min(cols, 80))}${c.reset}`); };
  const maxW = Math.min(cols, 80);
  
  // Header
  line();
  line(`  ${c.bgBlue}${c.brightWhite}${c.bold}  ⚡ AQUOS LIVE DASHBOARD  ${c.reset}  ${c.gray}${new Date().toLocaleString('en-US', { hour12: false })}${c.reset}`);
  line(`  ${c.dim}Dashboard uptime: ${formatDuration(dashUptime)}  •  Refresh: ${tickCount}  •  Ctrl+C to exit${c.reset}`);
  line();
  
  // System Overview
  line(`  ${c.bold}${c.brightWhite}SYSTEM${c.reset}  ${c.gray}${os.hostname()} • ${os.arch()} • ${os.cpus().length} cores${c.reset}`);
  hr();
  
  // CPU
  const cpuStr = cpuPercent.toFixed(1);
  line(`  ${c.cyan}CPU${c.reset}  ${progressBar(cpuPercent, 30)}  ${c.bold}${cpuStr}%${c.reset}  ${c.dim}(${os.cpus().length} cores)${c.reset}`);
  
  // RAM
  line(`  ${c.magenta}RAM${c.reset}  ${progressBar(memPercent, 30)}  ${c.bold}${memPercent.toFixed(1)}%${c.reset}  ${c.dim}${formatBytes(usedMem)} / ${formatBytes(totalMem)}${c.reset}`);
  
  // Disk
  if (disk) {
    line(`  ${c.green}DSK${c.reset}  ${progressBar(disk.percentage, 30)}  ${c.bold}${disk.percentage}%${c.reset}  ${c.dim}${disk.used} GB / ${disk.total} GB${c.reset}`);
  }
  
  line();
  
  // Process Summary
  const totalProcs = processes.length;
  line(`  ${c.bold}${c.brightWhite}PROCESSES${c.reset}  ${c.brightGreen}${onlineCount} online${c.reset}  ${stoppedCount > 0 ? `${c.brightRed}${stoppedCount} stopped${c.reset}  ` : ''}${c.gray}${totalProcs} total${c.reset}`);
  line(`  ${c.dim}Total CPU: ${totalProcCpu.toFixed(1)}%  •  Total RAM: ${formatBytes(totalProcMem)}${c.reset}`);
  hr();
  
  // Process Table Header
  if (processes.length === 0) {
    line();
    line(`  ${c.dim}No PM2 processes running.${c.reset}`);
    line(`  ${c.dim}Deploy via panel or: pm2 start app.js${c.reset}`);
  } else {
    // Header
    line(`  ${c.bold}${c.gray}${pad('NAME', 18)} ${pad('STATUS', 9)} ${pad('CPU', 8, 'right')} ${pad('MEM', 10, 'right')} ${pad('↻', 4, 'right')} ${pad('UPTIME', 14)}${c.reset}`);
    line(`  ${c.gray}${pad('', 18, 'left', '·')} ${pad('', 9, 'left', '·')} ${pad('', 8, 'left', '·')} ${pad('', 10, 'left', '·')} ${pad('', 4, 'left', '·')} ${pad('', 14, 'left', '·')}${c.reset}`);
    
    // Process Rows
    for (const proc of processes) {
      const name = proc.name;
      const status = proc.pm2_env?.status || 'unknown';
      const cpu = proc.monit?.cpu || 0;
      const mem = proc.monit?.memory || 0;
      const restarts = proc.pm2_env?.restart_time || 0;
      const uptime = proc.pm2_env?.pm_uptime;
      
      const nameColor = status === 'online' ? c.brightWhite : c.gray;
      const cpuColor = cpu > 50 ? c.brightRed : cpu > 20 ? c.brightYellow : c.brightGreen;
      const memColor = mem > 200 * 1024 * 1024 ? c.brightRed : mem > 100 * 1024 * 1024 ? c.brightYellow : c.brightGreen;
      const restartColor = restarts > 10 ? c.brightRed : restarts > 3 ? c.brightYellow : c.dim;
      
      line(`  ${nameColor}${c.bold}${pad(name, 18)}${c.reset} ${statusBadge(status)} ${cpuColor}${pad(cpu.toFixed(1) + '%', 8, 'right')}${c.reset} ${memColor}${pad(formatBytes(mem), 10, 'right')}${c.reset} ${restartColor}${pad(String(restarts), 4, 'right')}${c.reset} ${c.dim}${pad(formatUptime(uptime), 14)}${c.reset}`);
      
      // Show port if detectable
      const port = proc.pm2_env?.env?.PORT || proc.pm2_env?.PORT;
      const script = proc.pm2_env?.pm_exec_path ? require('path').basename(proc.pm2_env.pm_exec_path) : '';
      const interpreter = proc.pm2_env?.exec_interpreter || '';
      const stack = interpreter.includes('node') ? 'node' : interpreter.includes('python') ? 'python' : interpreter === 'none' ? 'binary' : interpreter;
      
      const detailParts = [];
      if (port) detailParts.push(`port:${port}`);
      if (script) detailParts.push(script);
      if (stack) detailParts.push(stack);
      if (proc.pm2_env?.pm_cwd) detailParts.push(proc.pm2_env.pm_cwd);
      
      if (detailParts.length > 0) {
        const detailStr = detailParts.join(' │ ');
        line(`  ${c.dim}  └─ ${detailStr.substring(0, maxW - 8)}${c.reset}`);
      }
    }
  }
  
  line();
  
  // Event Log
  if (eventLog.length > 0) {
    line(`  ${c.bold}${c.brightWhite}EVENTS${c.reset}  ${c.dim}recent changes${c.reset}`);
    hr();
    for (const evt of eventLog) {
      let icon, color;
      if (evt.type === 'add') { icon = '＋'; color = c.brightGreen; }
      else if (evt.type === 'remove') { icon = '＋'; color = c.brightRed; }
      else if (evt.type === 'status') { icon = '◆'; color = c.brightYellow; }
      else { icon = '●'; color = c.dim; }
      
      line(`  ${c.dim}${evt.time}${c.reset}  ${color}${icon} ${evt.message}${c.reset}`);
    }
    line();
  }
  
  // Footer
  line(`  ${c.dim}─── aquos-panel/dashboard • ${os.platform()} ${os.release()} ───${c.reset}`);
  
  // Write output
  clearScreen();
  process.stdout.write(output);
}

// ─── Process Status Tracking ────────────────────────────────────────────────

let previousProcessStatus = {};

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Connect to PM2
  await new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('Failed to connect to PM2. Is PM2 installed?');
        console.error(err.message);
        process.exit(1);
      }
      resolve();
    });
  });
  
  hideCursor();
  addEvent('info', 'Dashboard started');
  
  // Initial render
  await render();
  
  // Continuous update loop — every 2 seconds
  const interval = setInterval(async () => {
    try {
      await render();
    } catch (e) {
      // Silently continue on render errors
    }
  }, 2000);
  
  // Handle resize
  process.stdout.on('resize', async () => {
    try { await render(); } catch (e) {}
  });
  
  // Graceful exit
  const cleanup = () => {
    clearInterval(interval);
    showCursor();
    clearScreen();
    console.log('\n  Aquos Dashboard terminated.\n');
    pm2.disconnect();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => showCursor());
}

main().catch(err => {
  showCursor();
  console.error('Dashboard error:', err);
  process.exit(1);
});
