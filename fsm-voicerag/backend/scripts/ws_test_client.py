"""Simple WebSocket test client for the VoiceRAG backend.

This client demonstrates the expected JSON message flow for the WebSocket
voice endpoint. It does not perform real audio capture; it sends a small
base64-encoded placeholder payload and a text message to trigger normal
text processing paths.

Usage: python ws_test_client.py ws://localhost:8000/voice-chat
"""
import asyncio
import base64
import json
import sys

try:
    import websockets
except Exception:
    print("Please install websockets: pip install websockets")
    raise


async def run(uri: str):
    async with websockets.connect(uri) as ws:
        # start conversation
        await ws.send(json.dumps({"type": "start_conversation", "payload": {"session_id": "test-session"}}))
        print("Sent start_conversation")

        # send fake audio chunk (very small, just to emulate the shape)
        fake_audio = base64.b64encode(b"\x00\x01\x02\x03").decode("ascii")
        await ws.send(json.dumps({"type": "audio_chunk", "payload": {"data": fake_audio}}))
        print("Sent audio_chunk")

        # send a text message
        await ws.send(json.dumps({"type": "text_message", "payload": {"text": "What is the procedure to reset the device?"}}))
        print("Sent text_message")

        # read a few responses
        for _ in range(5):
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print("RECV:", msg)
            except asyncio.TimeoutError:
                break


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ws_test_client.py ws://localhost:8000/voice-chat")
        sys.exit(1)
    uri = sys.argv[1]
    asyncio.run(run(uri))
