# FSM VoiceRAG — FAQ

This FAQ contains common questions and answers useful for the FSM VoiceRAG assistant. Add or edit items here; use `scripts/import_and_index.py` to ingest this file into the RAG vector store.

## How to start a voice session?
1. Connect to the WebSocket endpoint at `ws://<host>:<port>/voice-chat`.
2. Send a `start_conversation` JSON message: `{ "type": "start_conversation", "payload": { "session_id": "your-session-id" } }`.
3. Stream base64-encoded audio chunks as `{ "type": "audio_chunk", "payload": { "data": "<base64>" } }`.
4. Or send text messages `{ "type": "text_message", "payload": { "text": "..." } }`.

## How to index documents for RAG?
- Place text files (.md, .txt), PDF (.pdf) or Word (.docx) files into the `fsm-voicerag/backend/documents/` directory and run the indexer:

```powershell
python backend/scripts/index_documents.py C:\path\to\documents
```

- Or use the helper to import a single FAQ file and index it:

```powershell
python backend/scripts/import_and_index.py C:\path\to\fsm-faq.md
```

## File formats supported
- .md, .txt — plain text
- .pdf — parsed with `pypdf` (if installed)
- .docx — parsed with `python-docx` (if installed)

## Chroma Cloud
- To use Chroma Cloud, set these env vars before starting the backend:
  - `CHROMA_CLOUD_API_KEY`
  - `CHROMA_CLOUD_TENANT` (optional)
  - `CHROMA_CLOUD_DATABASE` (optional)

Do not commit secrets into Git. Put them into a local `.env` file excluded by `.gitignore` or use your platform secret manager.

## Troubleshooting
- If the indexer reports no dependencies for parsing PDFs or DOCX, install `pypdf` and `python-docx` into the backend venv.
- If `pydantic-core` fails to build on install, install Rust toolchain or use Python 3.11/3.12 to obtain prebuilt wheels.

---

(You can expand this FAQ with additional FSM-specific Q/A. Use the import script to keep the vector DB in sync.)
