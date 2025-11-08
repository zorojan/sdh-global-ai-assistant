"""Index documents into the FSM RAG tool's ChromaDB collection.

Usage:
    python index_documents.py [path_to_documents]

If path is omitted, the script will try to index ./documents under the project.
This script is safe to run without chromadb installed (the RAG tool will fall back
to an in-memory store).
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

try:
    from tools.fsm_rag_tool import get_rag_tool
except Exception:
    # if run from repo root
    from app.tools.fsm_rag_tool import get_rag_tool


async def main(path: str):
    rag = get_rag_tool()
    ok = await rag.index_documents(path)
    print(f"Indexing {path} -> {ok}")


if __name__ == '__main__':
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'documents')
    p = os.path.abspath(p)
    print("Indexing documents from:", p)
    asyncio.run(main(p))
