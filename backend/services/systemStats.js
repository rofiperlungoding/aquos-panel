const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

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
        if (totalDiff === 0) return "0.0";
        return ((1 - (idleDiff / totalDiff)) * 100).toFixed(1);
    } catch (e) {
        return "0.0";
    }
}

async function getStats() {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const uptime = os.uptime();

        let diskStats = { total: 0, used: 0, percentage: 0 };
        try {
            if (os.platform() !== 'win32') {
                const { stdout } = await execPromise('df -k / | tail -1 | awk \'{print $2,$3}\'');
                const parts = stdout.trim().split(/\s+/);
                const total = parseInt(parts[0], 10);
                const used = parseInt(parts[1], 10);
                if (!isNaN(total) && !isNaN(used)) {
                    diskStats = {
                        total: total * 1024,
                        used: used * 1024,
                        percentage: Math.round((used / total) * 100)
                    };
                }
            }
        } catch (e) {}

        return {
            ram: Math.round((usedMem / totalMem) * 100) || 0,
            activeMem: Math.round(usedMem / 1024 / 1024) || 0,
            totalMem: (totalMem / 1024 / 1024 / 1024).toFixed(1),
            cpu: getCpuUsage(),
            disk: diskStats.percentage || 0,
            uptime: uptime || 0
        };
    } catch (e) {
        return { ram: 0, activeMem: 0, totalMem: "0.0", cpu: "0.0", disk: 0, uptime: 0 };
    }
}

module.exports = { getStats };
