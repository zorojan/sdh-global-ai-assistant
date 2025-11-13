#!/usr/bin/env node
const { execSync } = require('child_process');
const port = process.argv[2] || process.env.PORT || '3001';
console.log(`ensure-port-free: checking port ${port}`);
try {
  if (process.platform === 'win32') {
    let out = '';
    try { out = execSync('netstat -ano -p tcp').toString(); } catch (e) { out = (e && e.stdout) ? String(e.stdout) : ''; }
    const lines = out.split(/\r?\n/);
    const pids = new Set();
    for (const line of lines) {
      if (!line) continue;
      // Match lines that contain :<port> followed by whitespace
      if (line.includes(`:${port} `) || line.match(new RegExp(`:${port}\\s*$`))) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
    }
    if (pids.size === 0) console.log('ensure-port-free: no process found on port', port);
    else {
      for (const pid of pids) {
        try {
          console.log('ensure-port-free: killing PID', pid);
          execSync(`taskkill /PID ${pid} /F`);
          console.log('ensure-port-free: killed', pid);
        } catch (e) {
          console.warn('ensure-port-free: failed to kill', pid, e && e.message ? e.message : e);
        }
      }
    }
  } else {
    // unix-like fallback
    try {
      const out = execSync(`lsof -i :${port} -t || true`).toString();
      const pids = out.split(/\s+/).filter(Boolean);
      if (pids.length === 0) console.log('ensure-port-free: no process found on port', port);
      else {
        for (const pid of pids) {
          try {
            console.log('ensure-port-free: killing PID', pid);
            process.kill(Number(pid), 'SIGKILL');
            console.log('ensure-port-free: killed', pid);
          } catch (e) {
            console.warn('ensure-port-free: failed to kill', pid, e && e.message ? e.message : e);
            try { execSync(`kill -9 ${pid}`); } catch (e2) {}
          }
        }
      }
    } catch (e) {
      console.warn('ensure-port-free: lsof check failed', e && e.message ? e.message : e);
    }
  }
} catch (err) {
  console.warn('ensure-port-free: unexpected error', err && err.message ? err.message : err);
}
process.exit(0);
