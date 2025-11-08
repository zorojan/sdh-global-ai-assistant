import asyncio
from typing import Optional, Callable, Awaitable

from .base import ILiveVoiceAgent


class LocalLiveAgent(ILiveVoiceAgent):
    """A simple local agent that echoes text and pretends to process audio.

    This is a development stub used when no external live provider is configured.
    It supports registering an async on_response callback.
    """
    def __init__(self):
        self._on_response: Optional[Callable[[str], Awaitable[None]]] = None
        self._loop = asyncio.get_event_loop()

    def set_on_response(self, cb: Callable[[str], Awaitable[None]]):
        self._on_response = cb

    async def start_session(self, session_id: str):
        # nothing to prepare for the local stub
        return True

    async def process_audio_chunk(self, audio_bytes: bytes):
        # pretend we ran STT and produced partial text
        text = "[stt-placeholder]"
        if self._on_response:
            await self._on_response(text)

    async def process_text(self, text: str):
        # simple echo with a small delay to emulate async work
        await asyncio.sleep(0.1)
        resp = f"Agent reply: {text}"
        if self._on_response:
            await self._on_response(resp)

    def close(self):
        # nothing to close for stub
        return True
