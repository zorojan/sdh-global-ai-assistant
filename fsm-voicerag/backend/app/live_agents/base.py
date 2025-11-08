from typing import Callable, Awaitable


class ILiveVoiceAgent:
    """Interface for a live voice-capable agent.

    Implementations should provide async methods for audio chunks and text,
    and allow registering an on_response callback to push messages back.
    """
    def set_on_response(self, cb: Callable[[str], Awaitable[None]]):
        raise NotImplementedError()

    async def start_session(self, session_id: str):
        raise NotImplementedError()

    async def process_audio_chunk(self, audio_bytes: bytes):
        raise NotImplementedError()

    async def process_text(self, text: str):
        raise NotImplementedError()

    def close(self):
        raise NotImplementedError()
