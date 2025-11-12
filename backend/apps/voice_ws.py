"""
WebSocket gateway skeleton for VoiceRAG.

This is a minimal FastAPI app that provides a /ws/voice-rag endpoint.
It demonstrates receiving audio chunks and text messages from the frontend,
and shows how to call the local RAG tool (search_fsm_rag) when a function
call is required (simulated here by receiving a 'call_tool' message).

Run (dev):
  pip install fastapi uvicorn
  uvicorn backend.apps.voice_ws:app --reload --port 8766

Connect using WebSocket to ws://localhost:8766/ws/voice-rag
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import json
import asyncio
from typing import Dict

from ..voice_rag.rag_tool import search_fsm_rag

app = FastAPI()


html = """
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <h1>VoiceRAG WS Skeleton</h1>
    <p>Use a WebSocket client to connect to /ws/voice-rag</p>
  </body>
</html>
"""


@app.get('/')
async def index():
    return HTMLResponse(html)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_json(self, session_id: str, data: dict):
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_text(json.dumps(data))


manager = ConnectionManager()


@app.websocket('/ws/voice-rag')
async def websocket_endpoint(websocket: WebSocket):
    # Simple protocol expects an initial JSON message with sessionId
    await websocket.accept()
    session_id = None
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                # ignore non-json messages in this skeleton
                continue

            # Example message types:
            # {type: 'init', sessionId: 'abc'}
            # {type: 'audio.chunk', sessionId: 'abc', seq: 1, data: '<base64>'}
            # {type: 'text.message', sessionId: 'abc', text: '...'}
            # {type: 'call_tool', sessionId: 'abc', tool: 'search_fsm_rag', args: {query: '...'}}

            t = msg.get('type')
            if t == 'init':
                session_id = msg.get('sessionId')
                await manager.connect(websocket, session_id)
                await manager.send_json(session_id, {'type': 'session.accepted', 'sessionId': session_id})
                continue

            if t == 'audio.chunk':
                # In real implementation: append bytes to buffer, forward to realtime API
                # Here we just acknowledge receipt
                sid = msg.get('sessionId')
                await manager.send_json(sid, {'type': 'audio.received', 'seq': msg.get('seq')})
                continue

            if t == 'text.message':
                sid = msg.get('sessionId')
                text = msg.get('text')
                # In a real flow this would be injected into the live session
                # For skeleton: echo and optionally run RAG
                await manager.send_json(sid, {'type': 'transcription.final', 'text': text})
                continue

            if t == 'call_tool':
                sid = msg.get('sessionId')
                tool = msg.get('tool')
                args = msg.get('args', {})
                if tool == 'search_fsm_rag':
                    query = args.get('query')
                    # Call the RAG tool (local Chroma or fallback)
                    context = search_fsm_rag(query)
                    # Send back the tool result
                    await manager.send_json(sid, {'type': 'tool.result', 'tool': tool, 'context': context})
                else:
                    await manager.send_json(sid, {'type': 'error', 'message': f'Unknown tool: {tool}'})
                continue

            # Unknown message type
            if session_id:
                await manager.send_json(session_id, {'type': 'error', 'message': 'unknown message type'})

    except WebSocketDisconnect:
        if session_id:
            manager.disconnect(session_id)
"""
WebSocket gateway / session proxy (skeleton).

This file provides a minimal FastAPI WebSocket endpoint for `/ws/voice-rag`.
It accepts JSON messages with structure described in `doc/technical/voice-rag-integration.md`.

This is intentionally minimal: production-ready features like authentication,
binary audio handling, audio framing, VAD and streaming to external Realtime
APIs are out-of-scope for the skeleton and must be implemented per project needs.
"""
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

from ...voice_rag.rag_tool import search_fsm_rag

app = FastAPI()


@app.get('/')
async def root():
    return HTMLResponse('<h3>VoiceRAG WS gateway (skeleton). Connect to /ws/voice-rag</h3>')


@app.websocket('/ws/voice-rag')
async def ws_voice_rag(websocket: WebSocket):
    await websocket.accept()
    client = websocket.client
    print(f'WS connected: {client}')
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                # ignore malformed messages for now
                await websocket.send_text(json.dumps({'error': 'invalid json'}))
                continue

            mtype = msg.get('type')
            # audio chunks would normally be binary or base64; here we accept simple control flow
            if mtype == 'text.message':
                text = msg.get('text', '')
                # developer shortcut: if user wants to run a RAG search from text
                if text.strip().startswith('/search '):
                    query = text.strip()[8:]
                    # call RAG tool (synchronous in this skeleton)
                    context = search_fsm_rag(query)
                    out = {'type': 'response.text', 'text': context, 'sources': []}
                    await websocket.send_text(json.dumps(out))
                else:
                    # echo back as partial transcription in this skeleton
                    await websocket.send_text(json.dumps({'type': 'transcription.partial', 'text': text, 'isFinal': True}))

            elif mtype == 'control':
                action = msg.get('action')
                await websocket.send_text(json.dumps({'type': 'control.ack', 'action': action}))

            elif mtype == 'audio.chunk':
                # In a real implementation we'd buffer and forward these bytes to Realtime API
                # For skeleton, acknowledge receipt and optionally simulate transcription
                seq = msg.get('seq')
                await websocket.send_text(json.dumps({'type': 'transcription.partial', 'text': f'[audio chunk {seq} received]', 'isFinal': False}))

            else:
                await websocket.send_text(json.dumps({'type': 'error', 'message': 'unknown message type'}))

    except WebSocketDisconnect:
        print('WebSocket disconnected')
