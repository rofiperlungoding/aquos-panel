import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TermSession {
  id: string;
  label: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  socket: WebSocket;
  alive: boolean;
  createdAt: number;
}

interface TerminalViewProps {
  wsUrl: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

const TerminalView: React.FC<TerminalViewProps> = ({ wsUrl }) => {
  const [sessions, setSessions] = useState<TermSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const termContainerRef = useRef<HTMLDivElement>(null);
  const sessionsRef = useRef<TermSession[]>([]);

  // Keep ref in sync
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  // ── Create a new session ──────────────────────────────────────────────────

  const createSession = useCallback(() => {
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const num = sessionsRef.current.length + 1;
    const label = `Session ${num}`;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
      lineHeight: 1.3,
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#1a73e8',
        cursorAccent: '#0c0c0c',
        selectionBackground: '#1a73e840',
        selectionForeground: '#ffffff',
        black: '#0c0c0c',
        red: '#c94f4f',
        green: '#13a10e',
        yellow: '#c09c00',
        blue: '#1a73e8',
        magenta: '#881798',
        cyan: '#3a96dd',
        white: '#cccccc',
        brightBlack: '#767676',
        brightRed: '#e74856',
        brightGreen: '#16c60c',
        brightYellow: '#f9f1a5',
        brightBlue: '#3b78ff',
        brightMagenta: '#b4009e',
        brightCyan: '#61d6d6',
        brightWhite: '#f2f2f2',
      },
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Connect WebSocket
    const token = localStorage.getItem('aquos_token');
    const socket = new WebSocket(
      `${wsUrl}?type=terminal&cols=${80}&rows=${24}&token=${token}`
    );

    socket.onopen = () => {
      term.writeln('\x1b[1;34m━━━ Aquos Cloud Shell ━━━\x1b[0m');
      term.writeln(`\x1b[90m${label} • ${new Date().toLocaleTimeString()}\x1b[0m`);
      term.writeln('');

      // Send proper size after open
      setTimeout(() => {
        try {
          fitAddon.fit();
          socket.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows
          }));
        } catch (e) { /* ignore */ }
      }, 100);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'terminal-data') {
          term.write(msg.data);
        }
      } catch (e) { /* ignore */ }
    };

    socket.onclose = () => {
      term.writeln('\r\n\x1b[31m━━━ Session disconnected ━━━\x1b[0m');
      setSessions(prev =>
        prev.map(s => s.id === id ? { ...s, alive: false } : s)
      );
    };

    socket.onerror = () => {
      term.writeln('\r\n\x1b[31mConnection error\x1b[0m');
    };

    // Input → WS
    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'terminal-input', data }));
      }
    });

    const session: TermSession = {
      id,
      label,
      terminal: term,
      fitAddon,
      socket,
      alive: true,
      createdAt: Date.now(),
    };

    setSessions(prev => [...prev, session]);
    setActiveId(id);

    return session;
  }, [wsUrl]);

  // ── Kill a session ────────────────────────────────────────────────────────

  const killSession = useCallback((id: string) => {
    setSessions(prev => {
      const session = prev.find(s => s.id === id);
      if (session) {
        try { session.socket.close(); } catch (e) {}
        try { session.terminal.dispose(); } catch (e) {}
      }
      const remaining = prev.filter(s => s.id !== id);

      // If we killed the active session, switch to another
      if (id === activeId) {
        const next = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
        setActiveId(next);
      }

      return remaining;
    });
  }, [activeId]);

  // ── Mount active terminal into DOM ────────────────────────────────────────

  useEffect(() => {
    const container = termContainerRef.current;
    if (!container) return;

    // Clear container
    while (container.firstChild) container.removeChild(container.firstChild);

    const activeSession = sessions.find(s => s.id === activeId);
    if (!activeSession) return;

    // Mount xterm into container
    const term = activeSession.terminal;
    const fit = activeSession.fitAddon;

    // Only open if not already opened
    if (!term.element) {
      term.open(container);
    } else {
      container.appendChild(term.element);
    }

    // Fit after mount
    requestAnimationFrame(() => {
      try {
        fit.fit();
        if (activeSession.socket.readyState === WebSocket.OPEN) {
          activeSession.socket.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows
          }));
        }
      } catch (e) { /* ignore */ }
    });

    term.focus();
  }, [activeId, sessions.length]);

  // ── Window resize handler ─────────────────────────────────────────────────

  useEffect(() => {
    const handleResize = () => {
      const activeSession = sessionsRef.current.find(s => s.id === activeId);
      if (!activeSession) return;
      try {
        activeSession.fitAddon.fit();
        if (activeSession.socket.readyState === WebSocket.OPEN) {
          activeSession.socket.send(JSON.stringify({
            type: 'resize',
            cols: activeSession.terminal.cols,
            rows: activeSession.terminal.rows
          }));
        }
      } catch (e) { /* ignore */ }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeId]);

  // ── Create first session on mount ─────────────────────────────────────────

  useEffect(() => {
    if (sessions.length === 0) {
      createSession();
    }
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      for (const s of sessionsRef.current) {
        try { s.socket.close(); } catch (e) {}
        try { s.terminal.dispose(); } catch (e) {}
      }
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const aliveCount = sessions.filter(s => s.alive).length;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Session Bar */}
      <div className="flex items-center gap-1 px-2 py-2 bg-[#161618] border-b border-white/5 flex-shrink-0 overflow-x-auto">
        {/* Session Tabs */}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer
              transition-all select-none group min-w-0 flex-shrink-0
              ${s.id === activeId
                ? 'bg-[#1a73e8] text-white shadow-lg shadow-[#1a73e8]/30'
                : 'text-[#888] hover:bg-white/5 hover:text-white/70'
              }
            `}
          >
            {/* Status dot */}
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              s.alive ? 'bg-[#34a853] shadow-[0_0_6px_#34a853]' : 'bg-[#ea4335]'
            }`} />

            <span className="truncate">{s.label}</span>

            {/* Kill button */}
            <button
              onClick={(e) => { e.stopPropagation(); killSession(s.id); }}
              className={`
                ml-1 w-4 h-4 flex items-center justify-center rounded
                transition-all flex-shrink-0
                ${s.id === activeId
                  ? 'hover:bg-white/20 text-white/60 hover:text-white'
                  : 'opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-[#ea4335]'
                }
              `}
              title="Kill session"
            >
              ×
            </button>
          </div>
        ))}

        {/* New Session Button */}
        <button
          onClick={createSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
            text-[#1a73e8] hover:bg-[#1a73e8]/10 transition-all flex-shrink-0 ml-1"
          title="New session"
        >
          <span className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">New</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Session Count */}
        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex-shrink-0">
          <span className="text-[#34a853]">● {aliveCount}</span>
          <span className="text-[#555]">/</span>
          <span className="text-[#888]">{sessions.length} sessions</span>
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={termContainerRef}
        className="flex-1 min-h-0 bg-[#0c0c0c] overflow-hidden"
        style={{ padding: '8px 4px 4px 8px' }}
      />

      {/* No sessions fallback */}
      {sessions.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c0c]">
          <p className="text-[#555] text-sm font-bold mb-4">No active sessions</p>
          <button
            onClick={createSession}
            className="bg-[#1a73e8] text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider
              shadow-lg shadow-[#1a73e8]/30 hover:bg-[#1557b0] transition-all active:scale-95"
          >
            + New Session
          </button>
        </div>
      )}
    </div>
  );
};

export default TerminalView;
