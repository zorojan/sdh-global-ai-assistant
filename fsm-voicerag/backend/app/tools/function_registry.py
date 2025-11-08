"""Registry of functions that the LLM (Gemini/OpenAI) can call via Function Calls.

This module exposes function metadata (useful for registering with an LLM) and
the runtime caller `call_function` which executes the function and returns results.

Currently implemented functions:
- search_fsm: searches the FSM knowledge base via FSMRAGTool
- get_document: returns raw text of a stored document chunk or parent document

Do not put secrets here. Keep functions idempotent and side-effect free where possible.
"""
from typing import Any, Dict
from app.tools.fsm_rag_tool import get_rag_tool


FUNCTION_SPECS = {
    "search_fsm": {
        "name": "search_fsm",
        "description": "Search the FSM knowledge base for a query and return top results.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "k": {"type": "integer", "description": "Number of results to return", "default": 3}
            },
            "required": ["query"]
        }
    },
    "get_document": {
        "name": "get_document",
        "description": "Retrieve the full text of a stored document by id.",
        "parameters": {
            "type": "object",
            "properties": {
                "doc_id": {"type": "string", "description": "Document or chunk ID"}
            },
            "required": ["doc_id"]
        }
    }
}


async def call_function(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a registered function and return a JSON-serializable result.

    Raises KeyError if function name is unknown.
    """
    if name == "search_fsm":
        query = arguments.get("query")
        k = int(arguments.get("k", 3))
        rag = get_rag_tool()
        results = await rag.search_fsm_knowledge(query, k=k)
        return {"results": results}

    if name == "get_document":
        doc_id = arguments.get("doc_id")
        rag = get_rag_tool()
        # naive lookup in in-memory collection if Chroma not available
        coll = getattr(rag, "_collection", [])
        if isinstance(coll, list):
            for d in coll:
                if d.get("id") == doc_id:
                    return {"id": doc_id, "text": d.get("text"), "meta": d.get("meta")}
        # if chroma available, try to query by ids (best-effort)
        try:
            if hasattr(rag._collection, "get"):
                # chroma collections may allow get(ids=[...]) depending on version
                res = rag._collection.get(ids=[doc_id])
                # normalize
                docs = res.get("documents") if isinstance(res, dict) else None
                if docs:
                    return {"id": doc_id, "text": docs[0]}
        except Exception:
            pass
        return {"id": doc_id, "text": None}

    raise KeyError(f"Function {name} not found")
