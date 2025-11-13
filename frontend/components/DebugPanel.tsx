import React, { useEffect, useState } from 'react';

const refreshInterval = 1000; // ms

const formatDate = (d: any) => {
  try {
    return new Date(d).toLocaleTimeString();
  } catch (e) {
    return String(d);
  }
};

const DebugPanel: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [raw, setRaw] = useState<any[]>([]);
  const [persist, setPersist] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const read = () => {
    try {
      // @ts-ignore
      const g = (globalThis as any).__GENAI_LOGS__ || [];
      // @ts-ignore
      const r = (globalThis as any).__GENAI_RAW__ || [];
      const p = JSON.parse(localStorage.getItem('genai_logs') || '[]');
      setLogs(g.slice(-100).reverse());
      setRaw(r.slice(-100).reverse());
      setPersist(p.slice(-100).reverse());
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    read();
    const id = setInterval(read, refreshInterval);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9999 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOpen(o => !o)} style={{ padding: '6px 10px' }}>
          {open ? 'Close Debug' : 'Open Debug'}
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ logs, raw, persist }, null, 2)); }} style={{ padding: '6px 10px' }}>
          Copy
        </button>
        <button onClick={() => { localStorage.removeItem('genai_logs'); alert('Cleared persisted logs'); }} style={{ padding: '6px 10px' }}>
          Clear Persist
        </button>
      </div>

      {open && (
        <div style={{ width: 760, height: 520, overflow: 'auto', marginTop: 8, background: 'rgba(0,0,0,0.85)', color: '#eee', padding: 12, borderRadius: 6 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>GenAI Debug Panel</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <h5 style={{ margin: '0 0 6px 0' }}>Logs (window.__GENAI_LOGS__)</h5>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                {logs.map((l, i) => `${formatDate(l.date)} [${l.type}] ${typeof l.message === 'string' ? l.message : JSON.stringify(l.message)}\n`).join('')}
              </pre>
            </div>

            <div>
              <h5 style={{ margin: '0 0 6px 0' }}>Raw Messages (window.__GENAI_RAW__)</h5>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                {raw.map((r, i) => `${formatDate(r?.serverContent?.modelTurn?.parts?.[0]?.date || r?.serverContent?.turnComplete || '')} ${JSON.stringify(r, null, 2)}\n`).join('\n')}
              </pre>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <h5 style={{ margin: '0 0 6px 0' }}>Persisted (localStorage genai_logs)</h5>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(persist, null, 2)}</pre>
          </div>

          <div style={{ marginTop: 12 }}>
            <h5 style={{ margin: '8px 0' }}>Quick API Tester</h5>
            <div style={{ display: 'flex', gap: 8 }}>
              <select id="debug-endpoint" defaultValue="/api/gemini/live/send">
                <option value="/api/gemini/live/send">POST /api/gemini/live/send</option>
                <option value="/api/rag/search">POST /api/rag/search</option>
                <option value="/api/gemini/live/session">POST /api/gemini/live/session</option>
              </select>
              <button onClick={async () => {
                const sel = (document.getElementById('debug-endpoint') as HTMLSelectElement).value;
                // Use Vite-provided API base if available, otherwise default to localhost:3001
                // This prevents the dev server (5173) from returning 404 for /api/* calls.
                // Vite exposes env variables via import.meta.env.VITE_API_URL if configured.
                // If VITE_API_URL is not set, fall back to http://localhost:3001
                const viteApiBase = (import.meta as any)?.env?.VITE_API_URL || '';
                const fallback = 'http://localhost:3001';
                const base = viteApiBase || fallback;
                const target = sel.startsWith('http') ? sel : (base.replace(/\/$/, '') + sel);
                const bodyInput = (document.getElementById('debug-body') as HTMLTextAreaElement).value || '{}';
                let parsed: any = {};
                try { parsed = JSON.parse(bodyInput); } catch(e) { alert('Invalid JSON'); return; }
                try {
                  const resp = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
                  const text = await resp.text();
                  (document.getElementById('debug-response') as HTMLPreElement).textContent = `HTTP ${resp.status}\n${text}`;
                } catch (err) {
                  (document.getElementById('debug-response') as HTMLPreElement).textContent = `ERROR: ${err}`;
                }
              }}>Send</button>
              <button onClick={() => { (document.getElementById('debug-body') as HTMLTextAreaElement).value = '{}'; }}>Reset</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <textarea id="debug-body" style={{ width: '100%', height: 80, fontSize: 12 }} defaultValue={`{\n  "sessionId": "session_xxx",\n  "audioBase64": "<base64>",\n  "contentType": "audio"\n}`} />
            </div>
            <div style={{ marginTop: 8 }}>
              <h6>Response</h6>
              <pre id="debug-response" style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#111', padding: 8 }}></pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
