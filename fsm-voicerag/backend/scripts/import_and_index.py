"""Import a single file into the fsm-voicerag documents folder and run the indexer.

Usage:
    python import_and_index.py path/to/file

The script copies the file into `backend/documents/` (creating the dir if needed)
and calls the existing indexer script. It does not start the server.
"""
import shutil
import sys
import os
import asyncio

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DOCS_DIR = os.path.join(BASE, 'documents')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python import_and_index.py path/to/file")
        sys.exit(1)
    src = sys.argv[1]
    if not os.path.exists(src):
        print("File not found:", src)
        sys.exit(1)
    os.makedirs(DOCS_DIR, exist_ok=True)
    dest = os.path.join(DOCS_DIR, os.path.basename(src))
    shutil.copyfile(src, dest)
    print(f"Copied {src} -> {dest}")

    # call the indexer module
    indexer = os.path.join(os.path.dirname(__file__), 'index_documents.py')
    if not os.path.exists(indexer):
        print("index_documents.py not found; created earlier?", indexer)
        sys.exit(0)
    # run indexer
    print("Indexing documents...")
    os.system(f'python "{indexer}" "{DOCS_DIR}"')
    print("Done")
