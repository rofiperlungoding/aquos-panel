const { Mistral } = require('@mistralai/mistralai');

// Cek key di environment
const apiKey = process.env.MISTRAL_API_KEY;
let client = null;

if (apiKey) {
    client = new Mistral({ apiKey });
}

async function analyzeError(projectName, logs, systemInfo) {
    if (!client) {
        throw new Error("MISTRAL_API_KEY is not set in backend/.env . Harap isi dulu.");
    }

    const prompt = `You are AQUOS AI Sentinel, an expert server admin and developer guarding a Node.js/PM2 server environment.
A Node.js project named "${projectName}" running on PM2 has encountered errors.
Here is the system state (CPU/RAM): ${JSON.stringify(systemInfo)}
Here are the latest error logs from PM2:
--- LOGS START ---
${logs}
--- LOGS END ---

Please analyze the root cause using your coding expertise and provide output in this exact Markdown format:

### 🚨 Root Cause Analysis
(Explain what went wrong in 2-3 sentences max)

### 🛠️ Proposed Solution
(Explain how to fix it)

### 💻 Commands to Fix
\`\`\`bash
# Write the exact terminal commands needed to fix it (e.g. npm install, pm2 kill, etc)
\`\`\`
`;

    // We use the 'codestral-latest' model as requested
    const chatResponse = await client.chat.complete({
        model: 'codestral-latest',
        messages: [{ role: 'user', content: prompt }],
    });
    
    return chatResponse.choices[0].message.content;
}

module.exports = {
    analyzeError
};
