import asyncio
from typing import Optional, Callable, Awaitable, Dict, Any

from .base import ILiveVoiceAgent
from app.tools.function_registry import FUNCTION_SPECS, call_function


class GeminiLiveAgent(ILiveVoiceAgent):
    """Stub showing how a Gemini live agent could integrate Function Calls.

    This is a template: in production you'd use the real Gemini Live SDK to
    stream audio and receive LLM events. When the LLM emits a function_call
    event, the agent should invoke `call_function` and then send the result
    back to the model as a follow-up message (function response). This class
    demonstrates the wiring with synchronous placeholders.
    """
    def __init__(self):
        self._on_response: Optional[Callable[[str], Awaitable[None]]] = None

    def set_on_response(self, cb: Callable[[str], Awaitable[None]]):
        self._on_response = cb

    async def start_session(self, session_id: str):
        # In a real implementation, open Gemini realtime session here
        return True

    async def process_audio_chunk(self, audio_bytes: bytes):
        # Real agent would stream audio to Gemini for STT; here we stub
        if self._on_response:
            await self._on_response("[gemini-stub] received audio chunk")

    async def process_text(self, text: str):
        # In a real flow, you'd call Gemini with the user's text and register
        # a callback to receive model events. For demonstration, support a
        # special text payload that requests a function call in JSON form:
        # /call {"name":"search_fsm","arguments":{"query":"..."}}
        if text.strip().startswith("/call "):
            try:
                import json
                payload = json.loads(text.strip()[6:])
                fname = payload.get("name")
                args = payload.get("arguments", {})
                # execute registered function
                result = await call_function(fname, args)
                # send result back to client as a response
                if self._on_response:
                    await self._on_response(f"function_result:{json.dumps(result)}")
                return
            except Exception as e:
                if self._on_response:
                    await self._on_response(f"function_error:{e}")
                return

        # default echo behavior
        if self._on_response:
            await self._on_response(f"gemini-stub-reply: {text}")

    def close(self):
        return True
