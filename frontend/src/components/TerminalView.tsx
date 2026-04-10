import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalViewProps {
  wsUrl: string;
}

const TerminalView: React.FC<TerminalViewProps> = ({ wsUrl }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Fira Code", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    // WebSocket connection
    const socket = new WebSocket(`${wsUrl}?type=terminal&cols=${term.cols}&rows=${term.rows}`);
    socketRef.current = socket;

    socket.onopen = () => {
      term.writeln('\x1b[1;32mConnected to Aquos Cloud Shell\x1b[0m');
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'terminal-data') {
        term.write(msg.data);
      }
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'terminal-input', data }));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'resize', 
          cols: term.cols, 
          rows: term.rows 
        }));
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close();
      term.dispose();
    };
  }, [wsUrl]);

  return (
    <div className="w-full h-full bg-[#1e1e1e] rounded-[24px] overflow-hidden p-4 border border-[#333]">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
};

export default TerminalView;
