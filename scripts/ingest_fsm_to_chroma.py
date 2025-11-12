"""
Simple script to ingest a text file (or folder) into a local ChromaDB collection.

Usage (dev):
  python scripts/ingest_fsm_to_chroma.py --input "doc/example aisearch-openai-rag-audio-main/aisearch-openai-rag-audio-main/README.md"

Requires:
  pip install chromadb openai tiktoken

Environment variables:
  OPENAI_API_KEY - for embeddings (or change to other embedding function)

This is a minimal, local-only helper for quick demos. It creates a Chroma DB directory
inside the project (./.chroma) by default.
"""
import argparse
import os
from pathlib import Path
from typing import List

try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
except Exception:
    chromadb = None


def read_text(path: Path) -> str:
    if path.is_file():
        return path.read_text(encoding='utf-8')
    # join all files in folder
    texts = []
    for p in sorted(path.rglob('*.md')):
        texts.append(p.read_text(encoding='utf-8'))
    return "\n\n".join(texts)


def simple_split(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
        if start < 0:
            start = 0
    return chunks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', '-i', required=True, help='Path to file or folder to ingest')
    parser.add_argument('--collection', '-c', default='fsm_knowledge', help='Chroma collection name')
    parser.add_argument('--chroma-dir', default='.chroma', help='Local chroma DB directory')
    args = parser.parse_args()

    if chromadb is None:
        raise RuntimeError('chromadb library not installed. Run: pip install chromadb')

    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f'Input path not found: {input_path}')

    text = read_text(input_path)
    print(f'Read {len(text)} characters from {input_path}')

    chunks = simple_split(text)
    print(f'Created {len(chunks)} chunks')

    # initialize chroma client
    client = chromadb.Client(Settings(chroma_db_impl="duckdb+parquet", persist_directory=args.chroma_dir))

    # Use OpenAI embedding function (requires OPENAI_API_KEY env var)
    ef = embedding_functions.OpenAIEmbeddingFunction(api_key=os.environ.get('OPENAI_API_KEY'), model_name="text-embedding-3-small")

    coll = client.create_collection(name=args.collection, embedding_function=ef)

    ids = [f'doc-{i}' for i in range(len(chunks))]
    metadatas = [{'source': str(input_path), 'chunk_index': i} for i in range(len(chunks))]
    texts = chunks

    coll.add(ids=ids, metadatas=metadatas, documents=texts)
    client.persist()

    print(f'Ingested {len(chunks)} chunks into Chroma collection "{args.collection}" at {args.chroma_dir}')


if __name__ == '__main__':
    main()
