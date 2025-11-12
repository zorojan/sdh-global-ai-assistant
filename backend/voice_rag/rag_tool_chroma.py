"""
Minimal RAG tool implementation using ChromaDB as a local vector store.

Provides a search_fsm_rag(query) function that returns formatted context
from the nearest documents.

This is a skeleton for local development and testing.
"""
from typing import List, Dict, Any
import os

try:
    import chromadb
    from chromadb.config import Settings
except Exception:
    chromadb = None


class RagToolChroma:
    def __init__(self, collection_name: str = 'fsm_knowledge', chroma_dir: str = '.chroma'):
        if chromadb is None:
            raise RuntimeError('chromadb is not installed. pip install chromadb')
        self.client = chromadb.Client(Settings(chroma_db_impl="duckdb+parquet", persist_directory=chroma_dir))
        self.collection = None
        try:
            self.collection = self.client.get_collection(collection_name)
        except Exception:
            # collection may not exist yet
            self.collection = None

    def ensure_collection(self, collection_name: str = 'fsm_knowledge'):
        if self.collection is None:
            self.collection = self.client.create_collection(name=collection_name)
        return self.collection

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        if self.collection is None:
            raise RuntimeError('Chroma collection not found. Run ingestion first.')
        results = self.collection.query(query_texts=[query], n_results=k)
        docs = []
        # results['documents'] is a list-of-lists
        for i, docs_list in enumerate(results.get('documents', [])):
            for j, doc_text in enumerate(docs_list):
                metadata = results.get('metadatas', [[]])[i][j] if results.get('metadatas') else {}
                docs.append({'text': doc_text, 'metadata': metadata})
        return docs

    def format_context(self, docs: List[Dict[str, Any]]) -> str:
        parts = []
        for d in docs:
            src = d.get('metadata', {}).get('source', 'unknown')
            idx = d.get('metadata', {}).get('chunk_index', None)
            header = f"Source: {src}"
            if idx is not None:
                header += f" (chunk {idx})"
            parts.append(header + "\n" + d.get('text', '') + "\n---\n")
        return "\n".join(parts)


def search_fsm_rag(query: str, k: int = 5, collection_name: str = 'fsm_knowledge', chroma_dir: str = '.chroma') -> str:
    tool = RagToolChroma(collection_name=collection_name, chroma_dir=chroma_dir)
    docs = tool.search(query, k=k)
    context = tool.format_context(docs)
    return context


if __name__ == '__main__':
    q = "Как подать жалобу на банк?"
    print('Query:', q)
    try:
        ctx = search_fsm_rag(q)
        print('Context sample:\n', ctx[:1000])
    except Exception as e:
        print('Error (likely chroma not initialized):', e)
