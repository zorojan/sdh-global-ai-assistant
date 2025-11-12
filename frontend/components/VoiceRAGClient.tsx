import React, { useEffect, useRef, useState } from 'react';

// Minimal VoiceRAGClient skeleton
// - captures microphone
// - connects to WebSocket at /ws/voice-rag
// - sends audio chunks as base64 (very small demo implementation)

type Message = {
  type: string;
  [key: string]: any;
};

export function VoiceRAGClient() {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function appendLog(msg: string) {
    setLog((s) => [...s.slice(-50), msg]);
  }

  async function start() {
    const ws = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws/voice-rag');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      appendLog('WS connected');
      // send init message
      const init: Message = { type: 'init', sessionId: 'demo-session-1' };
      ws.send(JSON.stringify(init));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as Message;
        appendLog('WS <- ' + JSON.stringify(msg).slice(0, 300));
      } catch (e) {
        appendLog('WS <- (non-json) ' + ev.data.toString().slice(0, 200));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      appendLog('WS closed');
    };

    // capture microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRef.current = stream;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    pcmProcessorRef.current = processor;

    processor.onaudioprocess = (ev) => {
      const ch = ev.inputBuffer.getChannelData(0);
      // very naive PCM16 conversion
      const buffer = new ArrayBuffer(ch.length * 2);
      const view = new DataView(buffer);
      let offset = 0;
      for (let i = 0; i < ch.length; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const msg: Message = { type: 'audio.chunk', sessionId: 'demo-session-1', seq: Date.now(), data: base64Chunk, mime: 'audio/pcm16' };
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
    appendLog('Microphone started');
  }

  function stop() {
    if (mediaRef.current) {
      mediaRef.current.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
    }
    if (pcmProcessorRef.current) {
      pcmProcessorRef.current.disconnect();
      pcmProcessorRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    appendLog('Stopped');
  }

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h3>VoiceRAG Client (skeleton)</h3>
      <div>
        <button onClick={start} disabled={connected}>Start</button>
        <button onClick={stop} disabled={!connected}>Stop</button>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', background: '#111', color: '#eee', padding: 8 }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

export default VoiceRAGClient;
