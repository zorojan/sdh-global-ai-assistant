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
        <div style={{ width: 720, height: 420, overflow: 'auto', marginTop: 8, background: 'rgba(0,0,0,0.85)', color: '#eee', padding: 12, borderRadius: 6 }}>
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
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
