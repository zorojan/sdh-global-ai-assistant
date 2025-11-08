import asyncio
import base64
import json
import logging
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from session.session_manager import VoiceSessionManager
from tools.fsm_rag_tool import get_rag_tool
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fsm-voicerag")

app = FastAPI(title="FSM VoiceRAG Backend")

# Shared session manager instance
session_manager = VoiceSessionManager()
rag_tool = get_rag_tool()


class SearchRequest(BaseModel):
    query: str
    k: int = 3


@app.post("/api/rag/search")
async def rag_search(req: SearchRequest):
    try:
        results = await rag_tool.search_fsm_knowledge(req.query, k=req.k)
        return {"query": req.query, "results": results}
    except Exception as e:
        return {"error": str(e)}


@app.on_event("startup")
async def startup_event():
    logger.info("Initializing RAG tool and session manager")
    await rag_tool.initialize()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/voice-chat")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session_id: Optional[str] = None
    send_task = None
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                await ws.send_text(json.dumps({"error": "invalid_json"}))
                continue

            mtype = msg.get("type")
            payload = msg.get("payload", {})

            if mtype == "start_conversation":
                session_id = payload.get("session_id") or "session-" + str(id(ws))
                session_manager.start_session(session_id)

                # start background sender for this websocket/session
                async def sender_loop(sid: str):
                    q = session_manager.get_outgoing_queue(sid)
                    while True:
                        item = await q.get()
                        if item is None:
                            break
                        await ws.send_text(json.dumps({"type": "server_message", "payload": item}))

                send_task = asyncio.create_task(sender_loop(session_id))
                await ws.send_text(json.dumps({"type": "started", "payload": {"session_id": session_id}}))

            elif mtype == "audio_chunk":
                # payload.data is expected base64 audio bytes
                if not session_id:
                    await ws.send_text(json.dumps({"error": "no_session"}))
                    continue
                b64 = payload.get("data")
                try:
                    audio = base64.b64decode(b64)
                except Exception:
                    audio = b""
                await session_manager.process_audio(session_id, audio)

            elif mtype == "text_message":
                if not session_id:
                    await ws.send_text(json.dumps({"error": "no_session"}))
                    continue
                text = payload.get("text", "")
                await session_manager.process_text(session_id, text)

            else:
                await ws.send_text(json.dumps({"error": "unknown_type"}))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected session={session_id}")
    finally:
        if session_id:
            session_manager.close_session(session_id)
        if send_task:
            send_task.cancel()
