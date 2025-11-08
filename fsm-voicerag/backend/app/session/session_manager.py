import asyncio
from typing import Dict, Any

from ..live_agents.factory import LiveVoiceAgentFactory


class VoiceSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.outgoing: asyncio.Queue = asyncio.Queue()
        self.agent = None


class VoiceSessionManager:
    def __init__(self):
        self.sessions: Dict[str, VoiceSession] = {}

    def start_session(self, session_id: str):
        if session_id in self.sessions:
            return self.sessions[session_id]
        s = VoiceSession(session_id)
        # create a local live agent for this session
        s.agent = LiveVoiceAgentFactory.get_agent("local")
        # attach a simple callback: when agent produces text, put to outgoing queue
        async def on_response(text: str):
            await s.outgoing.put({"text": text})

        # the local agent exposes set_on_response (optional)
        try:
            s.agent.set_on_response(on_response)
        except Exception:
            pass

        self.sessions[session_id] = s
        return s

    async def process_audio(self, session_id: str, audio_bytes: bytes):
        s = self.sessions.get(session_id)
        if not s:
            return
        # forward to agent
        try:
            await s.agent.process_audio_chunk(audio_bytes)
        except Exception:
            # agent might not implement audio handling
            await s.outgoing.put({"error": "agent_audio_not_supported"})

    async def process_text(self, session_id: str, text: str):
        s = self.sessions.get(session_id)
        if not s:
            return
        # let agent handle text and produce responses via callback
        try:
            await s.agent.process_text(text)
        except Exception:
            await s.outgoing.put({"text": f"echo: {text}"})

    def get_outgoing_queue(self, session_id: str):
        s = self.sessions.get(session_id)
        if not s:
            # return a dummy queue
            q = asyncio.Queue()
            return q
        return s.outgoing

    def close_session(self, session_id: str):
        s = self.sessions.pop(session_id, None)
        if s and hasattr(s.agent, "close"):
            try:
                s.agent.close()
            except Exception:
                pass
