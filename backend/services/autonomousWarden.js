const pm2Manager = require('./pm2Manager');
const aiSentinel = require('./aiSentinel');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Warden history to prevent infinite fixing loops
const dbPath = path.join(__dirname, '..', 'data', 'warden.json');
let monitoringInterval = null;

function getWardenDB() {
    try {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch {
        return {};
    }
}

function saveWardenDB(db) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// Ensure dir exists
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function startAutonomousMonitoring() {
    if (monitoringInterval) clearInterval(monitoringInterval);
    console.log("🛡️ AQUOS Autonomous Warden Started. Monitoring apps every 60 seconds.");
    
    monitoringInterval = setInterval(async () => {
        try {
            const projects = await pm2Manager.listProjects();
            const db = getWardenDB();
            const now = Date.now();

            for (const app of projects) {
                // Criteria for intervention:
                // Is offline, errored, or crashing frequently
                const needsFix = app.status === 'errored' || app.status === 'stopped' || app.status === 'stopping' || app.memory === 0;
                
                if (needsFix) {
                    const lastAttempt = db[app.name] ? db[app.name].lastAttempt : 0;
                    // Only try auto-fix once every 10 minutes to prevent infinite loops
                    if (now - lastAttempt < 10 * 60 * 1000) {
                        continue;
                    }

                    console.log(`[Warden] Detected crash on ${app.name}. Analyzing...`);
                    
                    // 1. Get logs
                    const logs = await pm2Manager.getProjectLogs(app.name, 100);
                    if (!logs.stderr || logs.stderr.trim() === '') {
                        console.log(`[Warden] No error logs found for ${app.name}. Cannot diagnose.`);
                        continue;
                    }

                    // 2. Combine state
                    const state = {
                        name: app.name,
                        status: app.status,
                        restarts: 'unknown',
                        memory: app.memory,
                        uptime: app.uptime,
                        logs: logs
                    };

                    // 3. Prepare strict JSON prompt
                    const prompt = `
You are AQUOS Sentinel, a hyper-advanced level 3 autonomous system administrator.
An application named "${app.name}" is currently crashing or errored.

Here is the PM2 status:
Status: ${state.status}
Memory: ${state.memory} bytes

Recent Logs:
STDOUT:
${state.logs.stdout.slice(-1000)}

STDERR:
${state.logs.stderr.slice(-3000)}

Diagnose the root cause. If there is a clear bash command workflow that can fix this (e.g., npm install package, deleting a corrupted file, chmod), provide it. 
CRITICAL: You MUST respond in pure JSON format only, without markdown wrapping, without any explanation outside the JSON.
Shape:
{
  "diagnosis": "Short explanation of root cause",
  "executeCommand": "bash command to run, or null if none",
  "restartRequired": true
}`;
                    
                    // 4. Request Mistral API explicitly handling the JSON response
                    const axios = require('axios');
                    const mistralUrl = 'https://api.mistral.ai/v1/chat/completions';
                    
                    const response = await axios.post(mistralUrl, {
                        model: 'codestral-latest',
                        messages: [
                            { role: 'system', content: 'You are an autonomous JSON API server. Output ONLY raw JSON.' },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: "json_object" }
                    }, {
                        headers: {
                            'Authorization': \`Bearer \${process.env.MISTRAL_API_KEY}\`,
                            'Content-Type': 'application/json'
                        }
                    });

                    let aiResult;
                    try {
                        const content = response.data.choices[0].message.content;
                        // Strip markdown json blocks if codestral includes them
                        const jsonStr = content.replace(/^```json/m, '').replace(/```$/m, '').trim();
                        aiResult = JSON.parse(jsonStr);
                    } catch (e) {
                        console.error(`[Warden] Failed to parse AI JSON for ${app.name}:`, response.data?.choices[0]?.message?.content);
                        db[app.name] = { lastAttempt: now };
                        saveWardenDB(db);
                        continue;
                    }

                    console.log(`[Warden] AI Diagnosis for ${app.name}:`, aiResult.diagnosis);

                    // 5. Execute Fixes
                    if (aiResult.executeCommand) {
                        console.log(`[Warden] Executing AI Command: ${aiResult.executeCommand}`);
                        
                        // We need the working directory of the app
                        const details = await pm2Manager.getProjectDetail(app.name);
                        const cwd = details.serverPath !== 'N/A' ? details.serverPath : process.cwd();

                        try {
                            const { stdout, stderr } = await execPromise(aiResult.executeCommand, { cwd, timeout: 30000 });
                            console.log(`[Warden] Command output: ${stdout}`);
                        } catch (err) {
                            console.error(`[Warden] Command failed:`, err.message);
                        }
                    }

                    // 6. Restart App
                    if (aiResult.restartRequired) {
                        try {
                            await pm2Manager.executeAction(app.name, 'restart');
                            console.log(`[Warden] Restarted ${app.name} successfully.`);
                        } catch (e) {
                            console.error(`[Warden] Failed to restart ${app.name}:`, e.message);
                        }
                    }

                    // Record attempt
                    db[app.name] = { lastAttempt: now };
                    saveWardenDB(db);
                }
            }
        } catch (e) {
            console.error("[Warden] General error during monitoring loop:", e);
        }
    }, 60000); // Poll every minute
}

function stopAutonomousMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log("🛡️ AQUOS Autonomous Warden Stopped.");
    }
}

module.exports = {
    startAutonomousMonitoring,
    stopAutonomousMonitoring
};
