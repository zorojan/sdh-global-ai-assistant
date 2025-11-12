"""
Realtime adapter (OpenAI) - skeleton

This module provides helper functions to interact with OpenAI Realtime API.
It's intentionally minimal and synchronous/illustrative. For production you
should implement proper async streaming, authentication, token refresh and
binary audio framing.

The functions below show the expected call points from the WebSocket gateway.
"""
import os
import json
import asyncio

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')


async def create_realtime_session(session_id: str, model: str = 'gpt-4o-realtime-preview'):
    """Create a realtime session (placeholder).

    Returns a dict with session info that the gateway can use to route audio.
    """
    # In real code: call OpenAI REST API to create session, return websocket_url and credentials
    return {
        'session_id': session_id,
        'model': model,
        'ws_url': 'wss://api.openai.example/realtime',
        'token': OPENAI_API_KEY,
    }


async def send_audio_chunk(session_info: dict, chunk_bytes: bytes, seq: int):
    """Send an audio chunk to the realtime endpoint (placeholder)."""
    # placeholder: in real code you'd send binary frames over the realtime WS
    await asyncio.sleep(0)
    return {'sent': True, 'seq': seq}


async def close_session(session_info: dict):
    """Close session placeholder."""
    await asyncio.sleep(0)
    return True
