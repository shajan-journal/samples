# Text Chunking Playground

This project is a lightweight implementation of the `prd.txt` spec. It couples
corpus management, multiple chunking strategies, a toy vector database, and a
CLI-based UX/API to demonstrate how different embedding models behave.

## Features

- **Corpus management** – register local files or URLs, upload assets through
  the browser, keep metadata in `data/corpus.json`, and store downloaded copies
  under `data/downloads`.
- **Chunking policies** – sliding window, paragraph, and whole-document chunkers
  that you can mix-and-match with any embedding model.
- **Embedding models** – multiple text backends (MiniLM, E5, BGE, hashed) so you
  can compare quality/perf without worrying about modality-specific wiring.
- **Vector indexes** – backed by `hnswlib` for fast ANN search, persisted under
  `data/indexes`, with document/chunk counts plus similarity scores.
- **Format support** – PDF parsing (via `pypdf`) and HTML stripping are built-in.
- **API/UX** – the `IndexingService` class backs both a CLI (`python -m
  text_chunking.app`) and a lightweight web UI (`python -m text_chunking.web`)
  for ingestion, indexing, querying, resetting, and demos.

## Quick start

### 1. Install Python (if needed)

Any modern Python (3.10+) works. Pick the method that matches your OS:

```bash
# macOS (Homebrew)
brew install python

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y python3 python3-venv

# Cross-platform (pyenv)
curl https://pyenv.run | bash
pyenv install 3.11.7
pyenv local 3.11.7
```

Verify the interpreter:

```bash
python3 --version
```

### 2. Create & activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Install this project in editable mode so the `text_chunking` package is importable.
python -m pip install -e .
```

### 3. Run the CLI

```bash
# Explore the CLI
python -m text_chunking.app --help

# Run the scripted demo (initializes the data directory, no default docs)
python -m text_chunking.app demo
```


### 4. Launch the web UX (optional)

```bash
# Start the server (Ctrl+C to stop)
python -m text_chunking.web --host 127.0.0.1 --port 8000
```

Then visit `http://127.0.0.1:8000` to:

- Use the **Corpus** page to view assets, add inline documents (saved under
  `data/local_docs`), upload files/folders (or point to existing paths), or download new
  documents from the web by URL.
  Document IDs and kinds are inferred automatically.
- Use the corpus search bar to quickly find documents by file name/description; only the most recent docs are shown by default for readability.
- Bulk-upload entire folders or reset all indexes via the dedicated controls.
- Switch to the **Indexes** page to build new indexes and run similarity queries entirely in the browser.
- Use the optional *Min score* field in the query form to filter out low-signal matches.
- Tip: run `python -m text_chunking.app demo` once to initialize the data directory before opening the UI.

After building indexes (via CLI or UI) you can inspect the corpus metadata in
`data/corpus.json` and the persisted index manifests under `data/indexes`. Build
your own index before querying to avoid `KeyError: 'Unknown index: …'`.

```bash
python -m text_chunking.app query --index text-mini_sliding --text "company culture"

# Filter for matches scoring at least 0.4
python -m text_chunking.app query --index text-mini_sliding --text "company culture" --min-score 0.4
```

### Build your own index

```bash
# Register a local file
python -m text_chunking.app ingest --doc-id guide --path /path/to/file.txt --kind text

# Build a sliding-window index with the MiniLM embedding model
python -m text_chunking.app index \
  --model text-mini \
  --policy sliding \
  --documents guide \
  --window-chars 600 \
  --overlap-chars 150

# Ask a question (returning only matches with score >= 0.35)
python -m text_chunking.app query --index text-mini_sliding --text "what does the guide say?" --min-score 0.35
```

Omit `--documents` to automatically index every document currently in the corpus.

For sliding-window chunking you can tweak `--window-chars` (default 800) and
`--overlap-chars` (default 200) to control chunk granularity. The web UI exposes
these fields alongside the Build Index form as well.

### Available embedding models

| CLI/Web key  | Description |
|--------------|-------------|
| `text-mini`  | `sentence-transformers/all-MiniLM-L6-v2` |
| `text-e5`    | `intfloat/e5-small-v2` |
| `text-bge`   | `BAAI/bge-small-en-v1.5` |
| `text-hash`  | Lightweight hashed vectors (no external model) |

The first three require downloading Hugging Face checkpoints the first time you
use them; the CLI/web UI will trigger the download automatically.

### Reset/re-index

```bash
python -m text_chunking.app status  # show index health
python -m text_chunking.app reset --index text-mini_sliding
```

## Project layout

```
src/text_chunking/
  corpus.py       # Corpus registry + loaders (HTML/PDF aware)
  chunking.py     # Chunking policies
  embeddings.py   # SentenceTransformer + hashed embeddings
  index.py        # HNSW vector index + similarity search
  api.py          # Orchestrates the corpus + indexes
  ux.py           # Niceties for console rendering
  app.py          # CLI entrypoint consuming the API layer
  web.py          # Browser-based UX server
```

The system is intentionally dependency-free so it can run anywhere. Swap the
stub embedding models with real ML backends (OpenAI, HuggingFace, etc.) and wire
in a persistent vector store if you need production-grade behavior.
