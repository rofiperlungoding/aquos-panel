const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const pidusage = require('pidusage');

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
        
        // Get panel's self usage
        const selfUsage = await pidusage(process.pid);
        const panelMem = selfUsage.memory; // in bytes

        let diskRaw = { total: 0, free: 0, used: 0, percentage: 0 };
        try {
            if (os.platform() !== 'win32') {
                // Better disk precision using df -B format
                const { stdout } = await execPromise('df -B1 /data | tail -1 | awk \'{print $2,$3,$4}\'');
                const [total, used, free] = stdout.trim().split(/\s+/).map(n => parseInt(n, 10));
                if (!isNaN(total)) {
                    diskRaw = {
                        total: (total / (1024**3)).toFixed(1), // GB
                        used: (used / (1024**3)).toFixed(1),   // GB
                        free: (free / (1024**3)).toFixed(1),   // GB
                        percentage: Math.round((used / total) * 100)
                    };
                }
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
                uptime: os.uptime(),
                disk: diskRaw
            },
            panel: {
                cpu: selfUsage.cpu.toFixed(1),
                mem: (panelMem / (1024**2)).toFixed(1)
            }
        };
    } catch (e) {
        return { error: e.message };
    }
}

module.exports = { getStats };
