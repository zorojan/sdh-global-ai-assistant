import React, { useEffect, useRef, useState } from 'react';

// Minimal React component for voice chat interface. No external UI libs.
export default function VoiceChatInterface() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/voice-chat');
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        setMessages((m) => [...m, JSON.stringify(d)]);
      } catch (e) {
        setMessages((m) => [...m, ev.data]);
      }
    };
    return () => ws.close();
  }, []);

  const sendText = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'text_message', payload: { text: 'Hello from frontend' } }));
  };

  return (
    <div style={{ padding: 12, fontFamily: 'Arial' }}>
      <h3>Voice Chat Interface</h3>
      <div>Status: {connected ? 'connected' : 'disconnected'}</div>
      <button onClick={sendText} disabled={!connected} style={{ marginTop: 8 }}>
        Send sample text
      </button>
      <div style={{ marginTop: 12, maxHeight: 300, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>
        {messages.map((m, i) => (
          <pre key={i} style={{ whiteSpace: 'pre-wrap' }}>{m}</pre>
        ))}
      </div>
    </div>
  );
}
