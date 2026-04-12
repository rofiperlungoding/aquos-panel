const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const pidusage = require('pidusage');

let statsHistory = [];
const MAX_HISTORY = 60; // 5 minutes of 5s samples

let previousCpus = os.cpus();

function getCpuUsage() {
    try {
        const currentCpus = os.cpus();
        let idleDiff = 0;
        let totalDiff = 0;

        for (let i = 0, len = currentCpus.length; i < len; i++) {
            const cpu = currentCpus[i];
            const prevCpu = previousCpus[i];
            if (!cpu || !prevCpu) continue;
            for (const type in cpu.times) {
                totalDiff += cpu.times[type] - prevCpu.times[type];
            }
            idleDiff += cpu.times.idle - prevCpu.times.idle;
        }
        previousCpus = currentCpus;
        if (totalDiff === 0) return 0;
        return (1 - (idleDiff / totalDiff)) * 100;
    } catch (e) { return 0; }
}

async function getStats() {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // Background collector shim: if history is empty, initialize it slightly
        if (statsHistory.length === 0) {
           statsHistory.push({ timestamp: Date.now(), cpu: parseFloat(getCpuUsage().toFixed(1)), ram: Math.round((usedMem / totalMem) * 100) });
        }
        
        // Get panel's self usage
        const selfUsage = await pidusage(process.pid);
        const panelMem = selfUsage.memory; // in bytes

        // Get disk stats robustly
        let diskRaw = { total: 0, used: 0, free: 0, percentage: 0 };
        try {
            const isWin = os.platform() === 'win32';
            if (!isWin) {
                // Try / first, then /data (Termux use /data/data/com.termux/files/home usually, but / should work)
                const pathsToTry = ['/', '/data', '/home'];
                let diskData = null;

                for (const p of pathsToTry) {
                    try {
                        const { stdout } = await execPromise(`df -k "${p}" | tail -1`);
                        const parts = stdout.trim().split(/\s+/);
                        // Filesystem, 1K-blocks, Used, Available, Use%, Mounted on
                        if (parts.length >= 5) {
                            const total = parseInt(parts[1]); // in KB
                            const used = parseInt(parts[2]);
                            const free = parseInt(parts[3]);
                            if (!isNaN(total) && total > 0) {
                                diskData = { total, used, free };
                                break;
                            }
                        }
                    } catch (e) {}
                }

                if (diskData) {
                    diskRaw = {
                        total: (diskData.total / (1024*1024)).toFixed(1), // GB
                        used: (diskData.used / (1024*1024)).toFixed(1),   // GB
                        free: (diskData.free / (1024*1024)).toFixed(1),   // GB
                        percentage: Math.round((diskData.used / diskData.total) * 100)
                    };
                }
            } else {
                // Basic windows disk info (limited in node os)
                diskRaw = { total: 'N/A', used: 'N/A', free: 'N/A', percentage: 0 };
            }
        } catch (e) {}

        return {
            system: {
                cpu: getCpuUsage().toFixed(1),
                ram: {
                    percentage: Math.round((usedMem / totalMem) * 100),
                    total: (totalMem / (1024**3)).toFixed(1),
                    used: (usedMem / (1024**2)).toFixed(0),
                    free: (freeMem / (1024**2)).toFixed(0)
                },
                uptime: process.uptime(), // Return the process/panel uptime in seconds
                disk: diskRaw
            },
            panel: {
                cpu: selfUsage.cpu.toFixed(1),
                mem: (panelMem / (1024**2)).toFixed(1)
            },
            history: statsHistory
        };
    } catch (e) {
        return { error: e.message };
    }
}

// Background telemetry collector
setInterval(async () => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const cpu = (1 - (os.loadavg()[0] / os.cpus().length)) * 0; // Fallback or proper calc
        
        // Use a simpler cpu calc for history to avoid getting stuck
        const currentCpu = parseFloat(getCpuUsage().toFixed(1));

        statsHistory.push({
            timestamp: Date.now(),
            cpu: currentCpu,
            ram: Math.round((usedMem / totalMem) * 100)
        });
        if (statsHistory.length > MAX_HISTORY) statsHistory.shift();
    } catch (e) {}
}, 5000);

module.exports = { getStats };
