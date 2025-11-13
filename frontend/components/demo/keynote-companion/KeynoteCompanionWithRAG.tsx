/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useRef, useState } from 'react';
import BasicFace from '../basic-face/BasicFace';
import { useAgent, useUser } from '@/lib/state';
import { useLiveApi } from '../../../hooks/media/use-live-api';

export default function KeynoteCompanion() {
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const user = useUser();
  const { current } = useAgent();
  const lastAgentIdRef = useRef<string | null>(null);
  const { ws, connect, disconnect, reset, connected, sessionId, wsUrl, lastError } = useLiveApi({ agentId: current.id });
  const [connecting, setConnecting] = useState(false);
  // Минимальный RAG UI state (оставим только счетчик и алерт для примера)
  const [ragResponseCount, setRAGResponseCount] = useState(0);
  const [ragResponseAlert, setRAGResponseAlert] = useState('');
  const [lastRAGCheck, setLastRAGCheck] = useState('');
  const [ragEnabled, setRagEnabled] = useState(true);

  // Подключение к backend session при смене агента
  useEffect(() => {
    if (!current?.id || current.id === 'loading' || current.id === 'default') return;
    if (lastAgentIdRef.current === current.id) return;
    lastAgentIdRef.current = current.id;
    (async () => {
      try {
        setConnecting(true);
        await connect();
      } catch (err) {
        console.warn('KeynoteCompanion: connect failed', err);
      } finally {
        setConnecting(false);
      }
    })();
    return () => {
      disconnect();
    };
  }, [connect, disconnect, current.id]);

  // (Опционально) Можно отправить приветствие через ws после подключения
  useEffect(() => {
    if (!ws || !connected) return;
    try {
      // Ensure the socket is actually open before sending
      if ((ws as any).readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'greet', text: 'Greet the user and introduce yourself and your role.' }));
      } else {
        console.debug('KeynoteCompanion: ws not open yet, readyState=', (ws as any).readyState);
      }
    } catch (err) {
      console.warn('Failed to send greet over ws:', err);
    }
  }, [ws, connected]);

  const handleReconnect = async () => {
    try {
      setConnecting(true);
      reset();
      await connect();
    } catch (err) {
      console.warn('KeynoteCompanion: reconnect failed', err);
    } finally {
      setConnecting(false);
    }
  };

  // (RAG toolcall handler удалён — теперь этим занимается backend)

  return (
    <div className="keynote-companion">
      {/* Debug info for current configuration */}
      <div className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50 max-w-xs">
        <div className="mb-2 font-bold text-green-400">🧠 Gemini Live + RAG</div>
        <div>Agent: {current.name}</div>
        <div>Connected: {connected ? '✅' : (connecting ? '⏳ Connecting…' : '❌')}</div>
        <div>SessionId: {sessionId || '-'}</div>
        <div>wsUrl: {wsUrl || '-'}</div>
        {lastError && <div className="text-red-400">Error: {lastError}</div>}
        <div style={{ marginTop: '6px' }}>
          <button onClick={handleReconnect} style={{ padding: '4px 8px', fontSize: '12px' }} disabled={connecting}>
            {connecting ? '⏳ Reconnecting…' : 'Reconnect'}
          </button>
        </div>
      </div>

      <BasicFace
        canvasRef={faceCanvasRef!}
        color={current.bodyColor}
        avatarUrl={current.avatarUrl}
        isActive={connected}
      />
    </div>
  );
}
