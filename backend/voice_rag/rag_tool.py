"""
Lightweight RAG tool selector/wrapper.

This skeleton tries to use a local Chroma implementation if available
(`rag_tool_chroma.py`) and falls back to a simple placeholder.

Expose: search_fsm_rag(query: str) -> str (formatted context)
"""
from typing import Optional
import os

try:
    # prefer local chroma implementation if present
    from .rag_tool_chroma import search_fsm_rag as chroma_search
except Exception:
    chroma_search = None


def search_fsm_rag(query: str, k: int = 5) -> str:
    """Return a formatted context string for the given query.

    This wrapper will call the Chroma-based implementation when available.
    Otherwise it returns a helpful placeholder for development.
    """
    if chroma_search:
        return chroma_search(query, k=k)

    # Fallback: return a stubbed response so frontend/backend flow can be tested
    snippet = f"[RAG-PLACEHOLDER] No local vector DB found. Query: {query}\n"
    snippet += "Please run scripts/ingest_fsm_to_chroma.py to populate a local Chroma DB."
    return snippet


if __name__ == '__main__':
    q = os.environ.get('RAG_TEST_QUERY', 'Как подать жалобу на банк?')
    print(search_fsm_rag(q))
