// Simple logger to surface GenAI-related logs to the DebugPanel
type LogEntry = { date: string | number; type: string; message: any };

function ensureGlobals() {
  // @ts-ignore
  if (!(globalThis as any).__GENAI_LOGS__) (globalThis as any).__GENAI_LOGS__ = [];
  // @ts-ignore
  if (!(globalThis as any).__GENAI_RAW__) (globalThis as any).__GENAI_RAW__ = [];
}

export function log(type: string, message: any) {
  try {
    ensureGlobals();
    const entry: LogEntry = { date: Date.now(), type, message };
    // @ts-ignore
    (globalThis as any).__GENAI_LOGS__.push(entry);
    try {
      const p = JSON.parse(localStorage.getItem('genai_logs') || '[]');
      p.push(entry);
      localStorage.setItem('genai_logs', JSON.stringify(p.slice(-500)));
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // swallow
  }
}

export function logRaw(obj: any) {
  try {
    ensureGlobals();
    // @ts-ignore
    (globalThis as any).__GENAI_RAW__.push(obj);
    try {
      const p = JSON.parse(localStorage.getItem('genai_raw') || '[]');
      p.push(obj);
      localStorage.setItem('genai_raw', JSON.stringify(p.slice(-500)));
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // swallow
  }
}

export default { log, logRaw };
