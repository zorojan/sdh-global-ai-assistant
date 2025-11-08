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
        # chunking params
        self.chunk_size = 1200
        self.chunk_overlap = 200

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
        # If cloud credentials are present in environment, prefer CloudClient
        cloud_api_key = os.getenv("CHROMA_CLOUD_API_KEY")
        cloud_tenant = os.getenv("CHROMA_CLOUD_TENANT")
        cloud_database = os.getenv("CHROMA_CLOUD_DATABASE")
        try:
            if cloud_api_key:
                # Use CloudClient when API key is provided. Do NOT hardcode keys in source.
                try:
                    # cloud client constructor varies by chromadb version
                    self._client = chromadb.CloudClient(api_key=cloud_api_key, tenant=cloud_tenant, database=cloud_database)
                except Exception:
                    # fallback to generic Client with cloud settings if available
                    settings = Settings(chroma_db_impl="duckdb+parquet", persist_directory=self.persist_directory)
                    self._client = chromadb.Client(settings=settings)
            else:
                # create chroma client with local persistence
                settings = Settings(chroma_db_impl="duckdb+parquet", persist_directory=self.persist_directory)
                self._client = chromadb.Client(settings=settings)
        except Exception:
            # if client initialization fails, fall back to in-memory
            self._client = None
            self._collection = []
            self._initialized = True
            return True
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
                fp = os.path.join(root, f)
                try:
                    if f.lower().endswith((".txt", ".md")):
                        with open(fp, "r", encoding="utf-8") as fh:
                            text = fh.read()
                            docs.append({"id": fp, "text": text, "meta": {"source": f}})
                    elif f.lower().endswith(".pdf"):
                        try:
                            from pypdf import PdfReader
                            reader = PdfReader(fp)
                            pages = [p.extract_text() or "" for p in reader.pages]
                            text = "\n".join(pages)
                            docs.append({"id": fp, "text": text, "meta": {"source": f}})
                        except Exception:
                            # pypdf not available or parse failed
                            continue
                    elif f.lower().endswith(".docx"):
                        try:
                            import docx
                            doc = docx.Document(fp)
                            paragraphs = [p.text for p in doc.paragraphs]
                            text = "\n".join(paragraphs)
                            docs.append({"id": fp, "text": text, "meta": {"source": f}})
                        except Exception:
                            continue
                except Exception:
                    continue

        if not docs:
            return False

        # chunk documents into smaller pieces for better retrieval
        chunks = []
        for d in docs:
            text = d["text"]
            source = d.get("meta", {}).get("source", "")
            doc_id = d["id"]
            parts = self._split_text(text, self.chunk_size, self.chunk_overlap)
            for i, p in enumerate(parts):
                chunk_id = f"{doc_id}::chunk::{i}"
                chunks.append({"id": chunk_id, "text": p, "meta": {"source": source, "parent_id": doc_id, "chunk_index": i}})

        if CHROMA_AVAILABLE and self._client is not None and hasattr(self._collection, "add"):
            texts = [c["text"] for c in chunks]
            ids = [c["id"] for c in chunks]
            metadatas = [c.get("meta", {}) for c in chunks]
            try:
                # If we can compute embeddings via LangChain (or other), do so.
                embeddings = await self._get_embeddings(texts)
                if embeddings is not None:
                    # add with explicit embeddings
                    self._collection.add(documents=texts, metadatas=metadatas, ids=ids, embeddings=embeddings)
                else:
                    # let Chroma compute embeddings if configured externally
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
                    self._collection.extend(chunks)
                    return True
                return False
        else:
            # in-memory fallback
            self._collection = getattr(self, "_collection", [])
            if isinstance(self._collection, list):
                self._collection.extend(docs)
                return True
            return False

    def _split_text(self, text: str, max_length: int, overlap: int):
        """Split text into chunks of roughly max_length with overlap."""
        if not text:
            return []
        text = text.replace("\r\n", "\n")
        start = 0
        parts = []
        L = len(text)
        while start < L:
            end = min(start + max_length, L)
            part = text[start:end]
            parts.append(part)
            if end == L:
                break
            start = max(end - overlap, end)
        return parts

    async def _get_embeddings(self, texts: List[str]):
        """Try to compute embeddings using available libs.

        Returns a list of vector lists or None if not available.
        """
        if not texts:
            return None

        # Try LangChain embeddings first
        if LANGCHAIN_AVAILABLE:
            try:
                # attempt common embedding classes
                try:
                    from langchain.embeddings import OpenAIEmbeddings
                    emb = OpenAIEmbeddings()
                except Exception:
                    from langchain.embeddings import HuggingFaceEmbeddings
                    emb = HuggingFaceEmbeddings()
                # embed_documents is sync or async depending on implementation
                if hasattr(emb, "embed_documents"):
                    vectors = emb.embed_documents(texts)
                    return vectors
            except Exception:
                pass

        # Add additional providers here (google.generativeai, openai, etc.)
        # if none available, return None to allow Chroma fallback
        return None

    async def search_fsm_knowledge(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        """Return up to k best-match documents for query.

        If Chroma is available, use its nearest search. Otherwise perform a very
        simple substring match over the in-memory documents.
        """
        await self.initialize()

        if CHROMA_AVAILABLE and self._client is not None and hasattr(self._collection, "query"):
            try:
                # Use Chroma query by texts. The return structure can vary; support
                # the commonly used shapes where 'documents' and 'metadatas' are returned.
                results = self._collection.query(query_texts=[query], n_results=k)
                found = []
                docs = results.get("documents") or []
                metas = results.get("metadatas") or []
                # docs is typically a list-of-lists corresponding to queries
                for doc_list, meta_list in zip(docs, metas):
                    for d, m in zip(doc_list, meta_list):
                        found.append({"text": d, "meta": m})
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
