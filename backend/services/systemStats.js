const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function getStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // CPU load average
    const cpus = os.cpus();
    const loadAvg = os.loadavg(); 

    // Uptime
    const uptime = os.uptime();

    // Try to get Disk space (Unix/Linux/Termux)
    let diskStats = { total: 0, used: 0, percentage: 0 };
    try {
        if (os.platform() !== 'win32') {
            const { stdout } = await execPromise('df -k / | tail -1 | awk \'{print $2,$3}\'');
            const [total, used] = stdout.trim().split(' ').map(n => parseInt(n, 10));
            if (!isNaN(total) && !isNaN(used)) {
                diskStats = {
                    total: total * 1024,
                    used: used * 1024,
                    percentage: Math.round((used / total) * 100)
                };
            }
        }
    } catch (e) {
        // Silently fail on windows or weird configs, fallback to 0
    }

    return {
        ram: {
            total: totalMem,
            used: usedMem,
            percentage: Math.round((usedMem / totalMem) * 100)
        },
        cpu: {
            cores: cpus.length,
            model: cpus[0].model,
            usageObj: loadAvg // Array of 1, 5, and 15 min load averages
        },
        disk: diskStats,
        uptime: uptime
    };
}

module.exports = { getStats };
