<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/server.svg" width="100" height="100" alt="Aquos Panel"/>
  <h1>AQUOS Panel</h1>
  <p><strong>A Sleek, Autonomous, AI-Powered Control Panel for Next-Gen Hostings</strong></p>
</div>

<br>

AQUOS Panel is a modern, lightweight, yet powerful server management panel born from the idea of transforming underutilized hardware (like an old Aquos Android phone using Termux) into a brilliant, autonomous Cloud Server.

It comes packed with a sleek UI, full Bash terminal emulation directly in your browser, advanced PM2 process management, and an integrated **Auto-Healing AI Warden**. 

---

## ✨ Features

### 💻 Glassmorphism Dashboard
Say goodbye to boring terminal text or legacy 90s-styled panels. Enjoy a highly responsive UI with fluid animations, real-time charts powered by Recharts, and a semantic dark-light harmony. 

### 🚀 Zero-Touch Deployments
Simply provide a Git Repository URL. AQUOS Panel will:
1. Clone / Pull your repository.
2. Auto-detect your framework stack (`package.json`, `go.mod`, `requirements.txt`).
3. Automatically install all required dependencies! 
4. Assign an open PORT and inject it silently as an Environment Variable.
5. Boot it directly on PM2!

### 🌍 Secure Web Terminal
Direct native shell access from your browser using `xterm.js` and `node-pty`. Need to run internal commands? You don't need a separate SSH client. Just one click inside the panel.

### 🛡️ AQUOS Sentinel (The AI Auto-Healer)
Why fix server crashes manually when AI can do it?
- **Manual Diagnosis:** Click `✨ Ask AI Sentinel` above any red error logs. Mistral's Codestral model will explain what's wrong and tell you how to fix it in human language.
- **Autonomous Warden (24/7):** A background chron that monitors all processes every 60 seconds. If an app crashes, Warden pulls the stack trace, talks to the AI, and executes the suggested Bash command to recover your server *without human intervention*.

---

## 🚀 Quick Setup (Termux / Linux)

### Prerequisites
- Node.js (v18+)
- PM2 (`npm install -g pm2`)
- Git
- *For Termux/Android users: Node-Pty requires a C++ compiler (`pkg install build-essential python`). Alternatively, the panel provides a fallback spawn mechanism.*

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rofiperlungoding/aquos-panel.git
   cd aquos-panel
   ```

2. **Setup the Backend:**
   ```bash
   cd backend
   npm install

   # Setup your environment variables
   # Set the main admin password, your JWT Secret, and your Mistral AI Key
   echo "PANEL_PASSWORD=supersecret" >> .env
   echo "JWT_SECRET=shield" >> .env
   echo "MISTRAL_API_KEY=your_mistral_key_here" >> .env
   ```

3. **Setup and Build Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run build
   ```

4. **Start the Panel (with PM2):**
   ```bash
   cd ..
   npx pm2 start backend/server.js --name aquos-panel
   ```

5. **Access the Dashboard:**
   Open your browser and navigate to `http://<your-server-ip>:2999`
   Login with your `PANEL_PASSWORD`.

---

## 🧠 System Architecture

AQUOS Panel divides concerns cleanly into two areas:
- **Backend (`/backend`)**: An Express.js JSON API serving PM2 integrations, system commands (Node-PTY), and AI autonomous loops. Handles HTTP and custom WebSockets protocols safely with JWT validation.
- **Frontend (`/frontend`)**: A standalone React Single Page Application (SPA) built via Vite using TailwindCSS v4. It compiles its assets and pushes them to be served statically by the Express node.

---

## 📜 Further Reading (The Lore)
To read about the full background history on how this panel was initially engineered from scratch, the design philosophies, and what crazy ideas are planned for the future, check out the chronicles:
👉 **[AQUOS_JOURNEY.md](./AQUOS_JOURNEY.md)** 

---
*Created by [rofiperlungoding](https://github.com/rofiperlungoding) - Merging Server Management with Artifical Intelligence.*
