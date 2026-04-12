#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  AQUOS LIVE DASHBOARD — Ultra-Fast Terminal Process Monitor   ║
 * ║  200ms render cycle • 100ms system stats • Literal live       ║
 * ║  Run: node dashboard.js                                       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const pm2 = require('pm2');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);

// ─── ANSI ───────────────────────────────────────────────────────────────────

const ESC = '\x1b[';
const c = {
  reset: `${ESC}0m`, bold: `${ESC}1m`, dim: `${ESC}2m`,
  red: `${ESC}31m`, green: `${ESC}32m`, yellow: `${ESC}33m`,
  blue: `${ESC}34m`, magenta: `${ESC}35m`, cyan: `${ESC}36m`,
  gray: `${ESC}90m`, white: `${ESC}37m`,
  bRed: `${ESC}91m`, bGreen: `${ESC}92m`, bYellow: `${ESC}93m`,
  bBlue: `${ESC}94m`, bCyan: `${ESC}96m`, bWhite: `${ESC}97m`,
  bgBlue: `${ESC}44m`, bgGreen: `${ESC}42m`, bgRed: `${ESC}41m`,
  bgYellow: `${ESC}43m`, bgBlack: `${ESC}40m`,
  black: `${ESC}30m`,
};

// ─── Cached State (updated at different rates) ──────────────────────────────

let cachedProcesses = [];
let cachedDisk = null;
let cpuPercent = 0;
let memPercent = 0;
let memUsed = 0;
let memTotal = 0;
let previousCpus = os.cpus();
let previousProcessNames = new Set();
let previousProcessStatus = {};
let eventLog = [];
const MAX_EVENTS = 6;
let startTime = Date.now();
let frameCount = 0;
let fps = 0;
let lastFpsTime = Date.now();
let lastFpsCount = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function pad(s, len, align = 'left') {
  s = String(s);
  if (s.length >= len) return s.substring(0, len);
  const d = len - s.length;
  if (align === 'right') return ' '.repeat(d) + s;
  if (align === 'center') return ' '.repeat(Math.floor(d/2)) + s + ' '.repeat(Math.ceil(d/2));
  return s + ' '.repeat(d);
}

function fmtBytes(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB'];
  let i = 0, v = b;
  while (v >= 1024 && i < 3) { v /= 1024; i++; }
  return `${v.toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
}

function fmtUptime(ms) {
  if (!ms) return '—';
  const d = Date.now() - ms;
  const days = Math.floor(d / 86400000);
  const h = Math.floor((d % 86400000) / 3600000);
  const m = Math.floor((d % 3600000) / 60000);
  const s = Math.floor((d % 60000) / 1000);
  if (days > 0) return `${days}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function bar(pct, w = 24) {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * w);
  const empty = w - filled;
  const col = p < 50 ? c.bGreen : p < 80 ? c.bYellow : c.bRed;
  return `${col}${'█'.repeat(filled)}${c.gray}${'░'.repeat(empty)}${c.reset}`;
}

function miniBar(pct, w = 8) {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * w);
  const empty = w - filled;
  const col = p < 50 ? c.bGreen : p < 80 ? c.bYellow : c.bRed;
  return `${col}${'▮'.repeat(filled)}${c.gray}${'▯'.repeat(empty)}${c.reset}`;
}

function statusBadge(status) {
  if (status === 'online') return `${c.bgGreen}${c.black}${c.bold} ON ${c.reset}`;
  if (status === 'stopped') return `${c.bgRed}${c.bWhite}${c.bold} OFF${c.reset}`;
  if (status === 'errored') return `${c.bgRed}${c.bWhite}${c.bold} ERR${c.reset}`;
  return `${c.bgYellow}${c.black}${c.bold} ??? ${c.reset}`;
}

function addEvent(type, msg) {
  const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
  eventLog.unshift({ t, type, msg });
  if (eventLog.length > MAX_EVENTS) eventLog.pop();
}

// ─── Data Collectors (different rates) ──────────────────────────────────────

/** 100ms — ultra fast, just CPU math */
function updateSystemFast() {
  const curCpus = os.cpus();
  let idle = 0, total = 0;
  for (let i = 0; i < curCpus.length; i++) {
    const cur = curCpus[i], prev = previousCpus[i];
    if (!cur || !prev) continue;
    for (const t in cur.times) total += cur.times[t] - prev.times[t];
    idle += cur.times.idle - prev.times.idle;
  }
  previousCpus = curCpus;
  cpuPercent = total === 0 ? 0 : (1 - idle / total) * 100;

  memTotal = os.totalmem();
  const free = os.freemem();
  memUsed = memTotal - free;
  memPercent = (memUsed / memTotal) * 100;
}

/** 500ms — PM2 IPC call (heavier) */
function updateProcesses() {
  pm2.list((err, list) => {
    if (err || !list) return;
    
    const newProcs = list;
    const newNames = new Set(newProcs.map(p => p.name));
    
    // Detect additions
    for (const name of newNames) {
      if (!previousProcessNames.has(name)) addEvent('add', `${name} appeared`);
    }
    // Detect removals
    for (const name of previousProcessNames) {
      if (!newNames.has(name)) addEvent('rm', `${name} removed`);
    }
    // Detect status changes
    for (const p of newProcs) {
      const st = p.pm2_env?.status;
      const prev = previousProcessStatus[p.name];
      if (prev && prev !== st) addEvent('st', `${p.name}: ${prev} → ${st}`);
    }
    
    previousProcessNames = newNames;
    previousProcessStatus = {};
    for (const p of newProcs) previousProcessStatus[p.name] = p.pm2_env?.status;
    
    // Sort: online first
    newProcs.sort((a, b) => {
      const ao = a.pm2_env?.status === 'online' ? 0 : 1;
      const bo = b.pm2_env?.status === 'online' ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
    
    cachedProcesses = newProcs;
  });
}

/** 10s — disk check (slow shell call) */
async function updateDisk() {
  if (os.platform() === 'win32') return;
  try {
    const { stdout } = await execPromise('df -k / | tail -1', { timeout: 3000 });
    const p = stdout.trim().split(/\s+/);
    if (p.length >= 5) {
      const t = parseInt(p[1]), u = parseInt(p[2]);
      if (!isNaN(t) && t > 0) {
        cachedDisk = { total: (t/(1024*1024)).toFixed(1), used: (u/(1024*1024)).toFixed(1), pct: Math.round(u/t*100) };
      }
    }
  } catch (e) {}
}

// ─── Render (200ms — smooth 5fps) ───────────────────────────────────────────

function render() {
  frameCount++;
  
  // FPS counter
  const now = Date.now();
  if (now - lastFpsTime >= 1000) {
    fps = frameCount - lastFpsCount;
    lastFpsCount = frameCount;
    lastFpsTime = now;
  }
  
  const W = Math.min(process.stdout.columns || 80, 90);
  const dashUp = (now - startTime) / 1000;
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 1 });
  
  // Totals
  let totalCpu = 0, totalMem = 0, onlineN = 0, stoppedN = 0;
  for (const p of cachedProcesses) {
    totalCpu += p.monit?.cpu || 0;
    totalMem += p.monit?.memory || 0;
    if (p.pm2_env?.status === 'online') onlineN++; else stoppedN++;
  }
  
  const lines = [];
  const L = (s = '') => lines.push(s);
  const hr = () => L(`  ${c.gray}${'─'.repeat(W - 4)}${c.reset}`);
  
  // ── Header ──
  L();
  L(`  ${c.bgBlue}${c.bWhite}${c.bold}  ⚡ AQUOS LIVE  ${c.reset}  ${c.bWhite}${timeStr}${c.reset}  ${c.dim}${fps}fps  f:${frameCount}  up:${fmtDuration(dashUp)}${c.reset}`);
  L();
  
  // ── System Gauges (inline) ──
  const cpuStr = cpuPercent.toFixed(1);
  const memStr = memPercent.toFixed(1);
  L(`  ${c.cyan}${c.bold}CPU${c.reset} ${bar(cpuPercent, 20)} ${c.bold}${pad(cpuStr + '%', 7, 'right')}${c.reset}  ${c.magenta}${c.bold}RAM${c.reset} ${bar(memPercent, 20)} ${c.bold}${pad(memStr + '%', 7, 'right')}${c.reset}`);
  
  if (cachedDisk) {
    L(`  ${c.green}${c.bold}DSK${c.reset} ${bar(cachedDisk.pct, 20)} ${c.bold}${pad(cachedDisk.pct + '%', 7, 'right')}${c.reset}  ${c.dim}${cachedDisk.used}/${cachedDisk.total} GB${c.reset}  ${c.dim}│ ${fmtBytes(memUsed)}/${fmtBytes(memTotal)} RAM${c.reset}`);
  } else {
    L(`  ${c.dim}${fmtBytes(memUsed)} / ${fmtBytes(memTotal)} RAM  •  ${os.cpus().length} cores  •  ${os.hostname()}${c.reset}`);
  }
  
  L();
  
  // ── Processes ──
  L(`  ${c.bold}${c.bWhite}PROCESSES${c.reset}  ${c.bGreen}● ${onlineN}${c.reset}  ${stoppedN > 0 ? `${c.bRed}● ${stoppedN}${c.reset}  ` : ''}${c.dim}Σ ${cachedProcesses.length}  cpu:${totalCpu.toFixed(1)}%  mem:${fmtBytes(totalMem)}${c.reset}`);
  hr();
  
  if (cachedProcesses.length === 0) {
    L(`  ${c.dim}(no processes)${c.reset}`);
  } else {
    // Header row
    L(`  ${c.gray}${c.bold}${pad('NAME',16)} ${pad('ST',4)} ${pad('CPU',7,'right')} ${pad('MEM',9,'right')} ${pad('↻',3,'right')} ${pad('PORT',6,'right')} ${pad('UPTIME',12)}${c.reset}`);
    
    for (const p of cachedProcesses) {
      const nm = p.name;
      const st = p.pm2_env?.status || '?';
      const cpu = p.monit?.cpu || 0;
      const mem = p.monit?.memory || 0;
      const rst = p.pm2_env?.restart_time || 0;
      const upt = p.pm2_env?.pm_uptime;
      const port = p.pm2_env?.env?.PORT || p.pm2_env?.PORT || '';
      
      const nmCol = st === 'online' ? c.bWhite : c.gray;
      const cpuCol = cpu > 50 ? c.bRed : cpu > 20 ? c.bYellow : c.bGreen;
      const memCol = mem > 200*1024*1024 ? c.bRed : mem > 100*1024*1024 ? c.bYellow : c.bGreen;
      const rstCol = rst > 10 ? c.bRed : rst > 3 ? c.bYellow : c.dim;
      
      // Main row
      L(`  ${nmCol}${c.bold}${pad(nm,16)}${c.reset} ${statusBadge(st)} ${cpuCol}${pad(cpu.toFixed(1)+'%',7,'right')}${c.reset} ${memCol}${pad(fmtBytes(mem),9,'right')}${c.reset} ${rstCol}${pad(String(rst),3,'right')}${c.reset} ${c.bCyan}${pad(port ? ':'+port : '—',6,'right')}${c.reset} ${c.dim}${pad(fmtUptime(upt),12)}${c.reset}`);
      
      // CPU micro-bar on second line
      const script = p.pm2_env?.pm_exec_path ? path.basename(p.pm2_env.pm_exec_path) : '';
      const interp = p.pm2_env?.exec_interpreter || '';
      const stack = interp.includes('node') ? 'node' : interp.includes('python') ? 'py' : interp === 'none' ? 'bin' : interp.substring(0,4);
      const cwd = p.pm2_env?.pm_cwd || '';
      const shortCwd = cwd.length > 30 ? '…' + cwd.slice(-29) : cwd;
      
      L(`  ${c.dim}  └ ${miniBar(cpu,6)} ${stack}/${script}  ${shortCwd}${c.reset}`);
    }
  }
  
  L();
  
  // ── Events ──
  if (eventLog.length > 0) {
    L(`  ${c.bold}${c.bWhite}EVENTS${c.reset}`);
    hr();
    for (const e of eventLog) {
      const icon = e.type === 'add' ? `${c.bGreen}＋` : e.type === 'rm' ? `${c.bRed}－` : e.type === 'st' ? `${c.bYellow}◆` : `${c.dim}●`;
      L(`  ${c.dim}${e.t}${c.reset} ${icon} ${e.msg}${c.reset}`);
    }
    L();
  }
  
  // ── Footer ──
  L(`  ${c.dim}aquos-panel • ${os.platform()}/${os.arch()} • ${os.cpus().length}c • Ctrl+C exit${c.reset}`);
  L();
  
  // ── Write (cursor home, NO clear — prevents flicker) ──
  const output = lines.join('\n');
  
  // Move cursor home + clear each line as we go (flicker-free)
  process.stdout.write(`${ESC}H`); // cursor home
  
  // Write content + clear remainder of each line
  for (const line of lines) {
    process.stdout.write(line + `${ESC}K\n`); // \x1b[K = clear to end of line
  }
  
  // Clear any leftover lines from previous render
  const totalRows = process.stdout.rows || 40;
  const remaining = totalRows - lines.length - 1;
  for (let i = 0; i < remaining; i++) {
    process.stdout.write(`${ESC}K\n`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await new Promise((res, rej) => {
    pm2.connect(err => { if (err) { console.error('PM2 connect failed:', err.message); process.exit(1); } res(); });
  });
  
  // Hide cursor
  process.stdout.write(`${ESC}?25l`);
  // Clear screen once at start
  process.stdout.write(`${ESC}2J${ESC}H`);
  
  addEvent('info', 'Dashboard started');
  
  // Initial data fetch
  updateSystemFast();
  updateProcesses();
  await updateDisk();
  
  // ── Tiered update loops ──
  
  // System stats: every 100ms (ultra cheap — just os.cpus() math)
  const sysInterval = setInterval(updateSystemFast, 100);
  
  // PM2 process list: every 500ms (IPC call)
  const pm2Interval = setInterval(updateProcesses, 500);
  
  // Disk: every 10s (shell exec)
  const diskInterval = setInterval(updateDisk, 10000);
  
  // Render: every 200ms (5fps — flicker-free, feels live)
  const renderInterval = setInterval(() => {
    try { render(); } catch (e) { /* continue */ }
  }, 200);
  
  // Handle terminal resize
  process.stdout.on('resize', () => {
    process.stdout.write(`${ESC}2J${ESC}H`); // Full clear on resize
    try { render(); } catch (e) {}
  });
  
  // Graceful shutdown
  const cleanup = () => {
    clearInterval(sysInterval);
    clearInterval(pm2Interval);
    clearInterval(diskInterval);
    clearInterval(renderInterval);
    process.stdout.write(`${ESC}?25h`); // show cursor
    process.stdout.write(`${ESC}2J${ESC}H`); // clear
    console.log('\n  ⚡ Aquos Dashboard terminated.\n');
    pm2.disconnect();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => process.stdout.write(`${ESC}?25h`));
}

main().catch(e => {
  process.stdout.write(`${ESC}?25h`);
  console.error('Fatal:', e);
  process.exit(1);
});
