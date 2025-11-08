import os
import json
import asyncio
from typing import List, Dict, Any, Optional

# Minimal Chroma/LangChain-compatible RAG tool implementation.
# This file provides async stubs that use chromadb client if available.
# It intentionally avoids running network calls at import time and
# documents where to add real provider configuration.

try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
    CHROMA_AVAILABLE = True
except Exception:
    CHROMA_AVAILABLE = False

try:
    # prefer langchain's embedding interface if available
    from langchain.embeddings.base import Embeddings
    LANGCHAIN_AVAILABLE = True
except Exception:
    LANGCHAIN_AVAILABLE = False


class FSMRAGTool:
    def __init__(self, persist_directory: str = "./chroma_db") -> None:
        self.persist_directory = persist_directory
        self._client = None
        self._collection = None
        self._initialized = False

    async def initialize(self):
        """Initialize chroma client and collection. Safe to call multiple times."""
        if self._initialized:
            return True

        if not CHROMA_AVAILABLE:
            # no chroma installed — operate in ephemeral in-memory mode (fallback)
            self._client = None
            self._collection = []  # simple list of documents
            self._initialized = True
            return True

        # create chroma client with local persistence
        settings = Settings(chroma_db_impl="duckdb+parquet", persist_directory=self.persist_directory)
        self._client = chromadb.Client(settings=settings)
        # create/get collection
        try:
            self._collection = self._client.get_collection("fsm_documents")
        except Exception:
            self._collection = self._client.create_collection("fsm_documents")

        self._initialized = True
        return True

    async def index_documents(self, documents_path: str) -> bool:
        """Index text documents found in documents_path into ChromaDB.

        documents_path: a directory with text/pdf/docx files. This function will
        scan for supported file types and index their text content.
        """
        await self.initialize()

        # simple filesystem scan — extract text from supported files
        docs = []
        for root, _, files in os.walk(documents_path):
            for f in files:
                if f.lower().endswith((".txt", ".md")):
                    try:
                        with open(os.path.join(root, f), "r", encoding="utf-8") as fh:
                            text = fh.read()
                            docs.append({"id": os.path.join(root, f), "text": text, "meta": {"source": f}})
                    except Exception:
                        continue
                # PDF/DOCX readers can be plugged here; keep minimal for now.

        if not docs:
            return False

        if CHROMA_AVAILABLE and self._client is not None and hasattr(self._collection, "add"):
            texts = [d["text"] for d in docs]
            ids = [d["id"] for d in docs]
            metadatas = [d.get("meta", {}) for d in docs]
            try:
                # If an embedding function is configured in environment, you may add it here.
                self._collection.add(documents=texts, metadatas=metadatas, ids=ids)
                try:
                    self._client.persist()
                except Exception:
                    pass
                return True
            except Exception:
                # fallback to in-memory append
                self._collection = getattr(self, "_collection", [])
                if isinstance(self._collection, list):
                    self._collection.extend(docs)
                    return True
                return False
        else:
            # in-memory fallback
            self._collection = getattr(self, "_collection", [])
            if isinstance(self._collection, list):
                self._collection.extend(docs)
                return True
            return False

    async def search_fsm_knowledge(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        """Return up to k best-match documents for query.

        If Chroma is available, use its nearest search. Otherwise perform a very
        simple substring match over the in-memory documents.
        """
        await self.initialize()

        if CHROMA_AVAILABLE and self._client is not None and hasattr(self._collection, "query"):
            try:
                # This assumes chroma collection supports query by 'n_results' and 'query_texts'
                results = self._collection.query(query_texts=[query], n_results=k)
                # results structure varies; normalize to a list of dicts
                found = []
                # attempt to extract documents and metadatas
                for idx, rows in enumerate(results.get("documents", [[]])):
                    for doc_text in rows:
                        found.append({"text": doc_text})
                return found[:k]
            except Exception:
                pass

        # naive fallback: substring match
        found = []
        coll = getattr(self, "_collection", [])
        if isinstance(coll, list):
            for d in coll:
                if query.lower() in d.get("text", "").lower():
                    found.append({"id": d.get("id"), "text": d.get("text"), "meta": d.get("meta")})
                    if len(found) >= k:
                        break
        return found

    async def get_stats(self) -> Dict[str, Any]:
        await self.initialize()
        if CHROMA_AVAILABLE and self._client is not None and hasattr(self._collection, "count"):
            try:
                count = self._collection.count()
                return {"collection": "fsm_documents", "count": count}
            except Exception:
                pass
        coll = getattr(self, "_collection", [])
        if isinstance(coll, list):
            return {"collection": "in-memory", "count": len(coll)}
        return {"collection": "unknown", "count": 0}


# Module-level shared tool instance
rag_tool = FSMRAGTool()

async def initialize_rag():
    return await rag_tool.initialize()


# Small helper for synchronous callers
def get_rag_tool():
    return rag_tool
