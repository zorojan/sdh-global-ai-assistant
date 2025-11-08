// Minimal WebSocket service wrapper for the frontend. This is intentionally tiny
// and illustrative; the component directly uses WebSocket for now.

export function createVoiceSocket(url: string) {
  const ws = new WebSocket(url);
  return ws;
}
