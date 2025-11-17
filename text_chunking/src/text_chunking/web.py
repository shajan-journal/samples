"""Minimal web UX for exploring indexes."""
from __future__ import annotations

import html
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from email.parser import BytesParser
from email.policy import default as email_policy
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .api import IndexingService


@dataclass
class UXContext:
    message: Optional[str] = None
    query_results: Optional[List[Tuple[float, Dict[str, str]]]] = None
    query_index: Optional[str] = None
    query_text: Optional[str] = None
    query_min_score: Optional[float] = None
    search_query: Optional[str] = None
    view: str = "corpus"


class UXApplication:
    """Wrapper around IndexingService with helpers for the UX."""

    def __init__(self, corpus_root: Path) -> None:
        self.service = IndexingService(corpus_root)
        self.inline_dir = self.service.corpus.root / "local_docs"
        legacy_dir = self.service.corpus.root / "web_docs"
        if legacy_dir.exists() and not self.inline_dir.exists():
            legacy_dir.rename(self.inline_dir)
        self.inline_dir.mkdir(parents=True, exist_ok=True)
        self._ext_to_kind = {
            ".txt": "text",
            ".md": "text",
            ".rtf": "text",
            ".csv": "table",
            ".tsv": "table",
            ".xls": "table",
            ".xlsx": "table",
            ".html": "html",
            ".htm": "html",
            ".pdf": "pdf",
            ".jpg": "image",
            ".jpeg": "image",
            ".png": "image",
        }

    def _infer_kind(self, name: str | None) -> str:
        if not name:
            return "text"
        ext = Path(name).suffix.lower()
        return self._ext_to_kind.get(ext, "text")

    # ------------------------------------------------------------------
    def _generate_doc_id(self, seed: Optional[str] = None) -> str:
        existing = {doc.doc_id for doc in self.service.corpus.list_documents()}
        normalized = "".join(
            ch.lower() if ch.isalnum() else "-"
            for ch in (seed.strip() if seed else "doc")
        ).strip("-") or "doc"
        candidate = normalized
        suffix = 2
        while candidate in existing:
            candidate = f"{normalized}-{suffix}"
            suffix += 1
        return candidate

    def create_document(self, content: str, doc_id: Optional[str] = None) -> str:
        if not content.strip():
            raise ValueError("Content is required")
        doc_id = doc_id.strip() if doc_id and doc_id.strip() else self._generate_doc_id()
        path = self.inline_dir / f"{doc_id}.txt"
        path.write_text(content.strip() + "\n")
        self.service.register_local(
            doc_id,
            path,
            kind="text",
            description="Added via web UX",
        )
        return doc_id

    def register_file(self, file_path: str, doc_id: Optional[str] = None) -> str:
        path = Path(file_path).expanduser()
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        doc_id = doc_id.strip() if doc_id and doc_id.strip() else self._generate_doc_id(path.stem)
        record = self.service.register_local(
            doc_id.strip(),
            path,
            kind=self._infer_kind(path.name),
            description="Registered via web UX",
        )
        return record.doc_id

    def register_url(self, url: str, doc_id: Optional[str] = None) -> str:
        url = url.strip()
        if not url:
            raise ValueError("URL is required")
        parsed = urllib.parse.urlparse(url)
        seed = parsed.path.strip("/").split("/")[-1] or parsed.netloc or "download"
        doc_id = doc_id.strip() if doc_id and doc_id.strip() else self._generate_doc_id(seed)
        suffix = Path(parsed.path).suffix or ".html"
        path = self.inline_dir / f"{doc_id}{suffix}"
        with urllib.request.urlopen(url) as response:
            data = response.read()
        path.write_bytes(data)
        self.service.register_url(
            doc_id,
            url,
            local_copy=path,
            kind=self._infer_kind(path.name),
            description="Downloaded via web UX",
        )
        return doc_id

    def upload_file(self, filename: str, content: bytes) -> str:
        if not filename:
            raise ValueError("Filename is required")
        seed = Path(filename).stem or "upload"
        doc_id = self._generate_doc_id(seed)
        suffix = Path(filename).suffix or ".txt"
        path = self.inline_dir / f"{doc_id}{suffix}"
        path.write_bytes(content)
        self.service.register_local(
            doc_id,
            path,
            kind=self._infer_kind(filename),
            description="Uploaded via web UX",
        )
        return doc_id

    def upload_folder(self, folder_path: str | Path) -> List[str]:
        folder = Path(folder_path).expanduser()
        if not folder.exists() or not folder.is_dir():
            raise FileNotFoundError(f"Folder not found: {folder}")
        doc_ids: List[str] = []
        for path in sorted(folder.rglob("*")):
            if not path.is_file():
                continue
            doc_ids.append(self.register_file(path))
        return doc_ids

    def reset_all_indexes(self) -> None:
        statuses = list(self.service.list_indexes())
        for status in statuses:
            self.service.reset_index(status.name)

    def build_index(
        self,
        *,
        model: str,
        policy: str,
        documents: Optional[List[str]] = None,
        name: Optional[str] = None,
        window_chars: Optional[int] = None,
        overlap_chars: Optional[int] = None,
    ) -> str:
        status = self.service.build_index(
            model=model,
            policy=policy,
            documents=documents,
            name=name,
            window_chars=window_chars,
            overlap_chars=overlap_chars,
        )
        return status.name

    def query(self, index: str, text: str, top_k: int = 5, min_score: Optional[float] = None):
        return self.service.query(index, text, top_k=top_k, min_score=min_score)


def _render_page(app: UXApplication, context: UXContext | None = None) -> str:
    context = context or UXContext()
    view = context.view or "corpus"
    docs = app.service.corpus.list_documents()
    search_query = (context.search_query or "").strip()
    if search_query:
        needle = search_query.lower()
        filtered_docs = [
            doc
            for doc in docs
            if needle in doc.doc_id.lower()
            or (doc.description and needle in doc.description.lower())
        ]
    else:
        filtered_docs = docs
    RECENT_LIMIT = 10
    if search_query:
        display_docs = filtered_docs
    else:
        display_docs = filtered_docs[-RECENT_LIMIT:]
    display_docs = list(display_docs)
    if not search_query:
        display_docs = list(reversed(display_docs))
    more_count = max(len(filtered_docs) - len(display_docs), 0)
    indexes = app.service.list_indexes()
    options_indexes = "".join(
        f'<option value="{html.escape(status.name)}"'
        f" {'selected' if status.name == context.query_index else ''}>{html.escape(status.name)}</option>"
        for status in indexes
    )
    doc_items = "".join(
        f"<li><strong>{html.escape(doc.doc_id)}</strong> — {html.escape(doc.kind)} ({html.escape(doc.source)})"
        + (f" : {html.escape(doc.description)}" if doc.description else "")
        + "</li>"
        for doc in display_docs
    )
    index_rows = "".join(
        "<tr>"
        f"<td>{html.escape(status.name)}</td>"
        f"<td>{html.escape(status.model)}</td>"
        f"<td>{html.escape(status.policy)}</td>"
        f"<td>{status.documents}</td>"
        f"<td>{status.chunks}</td>"
        "</tr>"
        for status in indexes
    )
    results_html = ""
    if context.query_results is not None:
        if not context.query_results:
            results_html = "<p>No matches found.</p>"
        else:
            rows = []
            for score, record in context.query_results:
                preview = html.escape(record["text"][:160].replace("\n", " "))
                rows.append(
                    f"<li><strong>{html.escape(record['chunk_id'])}</strong> "
                    f"<em>{score:.3f}</em> — {preview}</li>"
                )
            results_html = "<ol>" + "".join(rows) + "</ol>"
    message_html = (
        f"<div class='flash'>{html.escape(context.message)}</div>"
        if context.message
        else ""
    )
    query_form_indexes = (
        options_indexes
        if options_indexes
        else '<option value="" disabled selected>No indexes yet</option>'
    )
    nav = f"""
    <nav>
      <a href="/corpus" class="{'active' if view == 'corpus' else ''}">Corpus</a>
      <a href="/indexes" class="{'active' if view == 'indexes' else ''}">Indexes</a>
    </nav>
    """
    corpus_summary = (
        f"Showing {len(display_docs)} of {len(filtered_docs)} matching documents"
        if search_query
        else f"Showing latest {len(display_docs)} of {len(docs)} documents"
    )
    if more_count and not search_query:
        corpus_summary += f" (and {more_count} more)"
    corpus_page = f"""
      <section>
        <h2>Corpus ({len(docs)} docs)</h2>
        <form method="get" action="/corpus" class="search-form">
          <label for="doc_search">Search file names</label>
          <input type="text" id="doc_search" name="q" placeholder="doc id or description" value="{html.escape(search_query)}" />
          <button type="submit">Search</button>
          {"<a class='clear' href='/corpus'>Clear</a>" if search_query else ""}
        </form>
        <p class="corpus-meta">{corpus_summary}.</p>
        <ul>
          {doc_items or '<li>(no documents match)</li>'}
        </ul>
      </section>
      <section class="forms">
        <form method="post" action="/uploads" enctype="multipart/form-data">
          <h3>Upload Files or Folders</h3>
          <p class="note">Pick a file/folder or enter a path; we'll ingest whatever you supply.</p>
          <label for="picker">Choose file/folder</label>
          <input id="picker" type="file" name="file" webkitdirectory directory multiple />
          <label for="manual_path">Manually enter path</label>
          <input id="manual_path" type="text" name="manual_path" placeholder="/path/to/file-or-folder" />
          <button type="submit">Add Content</button>
        </form>
        <form method="post" action="/urls">
          <h3>Download from Web</h3>
          <p class="note">Provide a URL and we'll fetch/store a local copy (kind inferred from extension).</p>
          <label for="url">URL</label>
          <input type="text" name="url" placeholder="https://example.com/doc.html" required />
          <button type="submit">Register</button>
        </form>
        <form method="post" action="/documents">
          <h3>Add Inline Document</h3>
          <p class="note">Document IDs and kinds are auto-generated.</p>
          <label for="content">Content</label>
          <textarea name="content" required></textarea>
          <button type="submit">Save</button>
        </form>
      </section>
    """
    indexes_page = f"""
      <section>
        <h2>Indexes</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Model</th><th>Policy</th><th>Docs</th><th>Chunks</th></tr>
          </thead>
          <tbody>
            {index_rows or '<tr><td colspan="5">No indexes yet.</td></tr>'}
          </tbody>
        </table>
      </section>
      <section class="forms">
        <form method="post" action="/reset-indexes">
          <h3>Reset All Indexes</h3>
          <p class="note">This clears every index and deletes its stored manifest.</p>
          <button type="submit">Reset Indexes</button>
        </form>
        <form method="post" action="/indexes">
          <h3>Build Index</h3>
          <label for="model">Model</label>
          <select name="model">
            <option value="text-mini">text-mini (MiniLM)</option>
            <option value="text-e5">text-e5 (E5-small)</option>
            <option value="text-bge">text-bge (BGE-small)</option>
            <option value="text-hash">text-hash (lightweight)</option>
          </select>
          <label for="policy">Policy</label>
          <select name="policy">
            <option value="sliding">sliding</option>
            <option value="paragraph">paragraph</option>
            <option value="document">document</option>
          </select>
          <label for="window_chars">Window size (chars, sliding only)</label>
          <input type="number" name="window_chars" placeholder="800" min="1" />
          <label for="overlap_chars">Overlap (chars, sliding only)</label>
          <input type="number" name="overlap_chars" placeholder="200" min="0" />
          <label for="name">Index name (optional)</label>
          <input type="text" name="name" placeholder="auto-generated" />
          <button type="submit">Build</button>
        </form>
        <form method="post" action="/query">
          <h3>Query Index</h3>
          <label for="index">Index</label>
          <select name="index">
            {query_form_indexes}
          </select>
          <label for="text">Question</label>
          <textarea name="text" required>{html.escape(context.query_text or '')}</textarea>
          <label for="top_k">Top K</label>
          <input type="text" name="top_k" value="5" />
          <label for="min_score">Min score (0-1, optional)</label>
          <input type="text" name="min_score" value="{'' if context.query_min_score is None else context.query_min_score}" />
          <button type="submit">Search</button>
        </form>
      </section>
      <section>
        <h2>Results</h2>
        {results_html or '<p>Run a query to see matches.</p>'}
      </section>
    """
    body_content = corpus_page if view == "corpus" else indexes_page
    return f"""
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Text Chunking Playground</title>
      <style>
        body {{ font-family: sans-serif; margin: 2rem; max-width: 960px; }}
        section {{ margin-bottom: 2rem; }}
        textarea {{ width: 100%; min-height: 140px; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 0.5rem; text-align: left; }}
        th {{ background: #f0f0f0; }}
        .flash {{ padding: 0.75rem; background: #eef; border: 1px solid #aac; margin-bottom: 1rem; }}
        .forms {{ display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }}
        form {{ border: 1px solid #ddd; padding: 1rem; border-radius: 6px; background: #fafafa; }}
        label {{ display: block; font-weight: 600; margin-top: 0.5rem; }}
        input[type=text], select {{ width: 100%; padding: 0.4rem; }}
        button {{ margin-top: 0.75rem; padding: 0.5rem 0.75rem; }}
        nav {{ margin-bottom: 1.5rem; }}
        nav a {{ margin-right: 1rem; text-decoration: none; font-weight: 600; color: #555; }}
        nav a.active {{ color: #000; text-decoration: underline; }}
        .note {{ font-size: 0.85rem; color: #555; margin: 0.2rem 0 0.6rem; }}
        .search-form {{ display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 0 0 0.5rem; }}
        .search-form input {{ flex: 1; min-width: 200px; padding: 0.4rem; }}
        .search-form label {{ margin: 0; }}
        .search-form .clear {{ font-size: 0.85rem; color: #0070f3; text-decoration: none; }}
        .corpus-meta {{ font-size: 0.9rem; color: #555; margin-bottom: 0.5rem; }}
      </style>
    </head>
    <body>
      <h1>Text Chunking Playground</h1>
      {nav}
      {message_html}
      {body_content}
    </body>
    <script>
      document.addEventListener('DOMContentLoaded', function() {{
        const picker = document.getElementById('picker');
        const manual = document.getElementById('manual_path');
        if (picker && manual) {{
          picker.addEventListener('change', () => {{
            if (!picker.files || picker.files.length === 0) {{
              return;
            }}
            const first = picker.files[0];
            if (first.webkitRelativePath) {{
              manual.value = '';
              return;
            }}
            manual.value = first.name;
          }});
        }}
      }});
    </script>
    </html>
    """


class UXRequestHandler(BaseHTTPRequestHandler):
    app: UXApplication | None = None

    # ------------------------------------------------------------------
    def _parse_form(self) -> Tuple[Dict[str, str], Dict[str, List[Dict[str, bytes]]]]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}, {}
        raw = self.rfile.read(length)
        content_type = self.headers.get("Content-Type", "")
        if content_type.startswith("multipart/form-data"):
            header = f"Content-Type: {content_type}\r\n\r\n".encode("utf-8")
            message = BytesParser(policy=email_policy).parsebytes(header + raw)
            fields: Dict[str, str] = {}
            files: Dict[str, List[Dict[str, bytes]]] = {}
            for part in message.iter_parts():
                if part.get_content_disposition() != "form-data":
                    continue
                name = part.get_param("name", header="content-disposition")
                if not name:
                    continue
                filename = part.get_filename()
                payload = part.get_payload(decode=True) or b""
                if filename:
                    files.setdefault(name, []).append(
                        {"filename": filename, "content": payload}
                    )
                else:
                    charset = part.get_content_charset() or "utf-8"
                    fields[name] = payload.decode(charset)
            return fields, files
        data = raw.decode("utf-8")
        parsed = urllib.parse.parse_qs(data)
        return {key: values[0] for key, values in parsed.items()}, {}

    def _redirect(self, path: str, message: Optional[str] = None) -> None:
        location = path
        if message:
            sep = "&" if "?" in location else "?"
            location = f"{location}{sep}" + urllib.parse.urlencode({"message": message})
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", location)
        self.end_headers()

    def _render(self, context: UXContext | None = None) -> None:
        content = _render_page(self.app, context)
        payload = content.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path or "/"
        if path == "/":
            self._redirect("/corpus")
            return
        if path not in {"/corpus", "/indexes"}:
            self.send_error(HTTPStatus.NOT_FOUND, "Page not found")
            return
        params = urllib.parse.parse_qs(parsed.query)
        message = params.get("message", [None])[0]
        view = "corpus" if path == "/corpus" else "indexes"
        search_query = params.get("q", [None])[0] if view == "corpus" else None
        self._render(UXContext(message=message, view=view, search_query=search_query))

    def do_POST(self) -> None:  # noqa: N802
        if not self.app:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "App not configured")
            return
        form, files = self._parse_form()
        try:
            if self.path == "/documents":
                doc_id = self.app.create_document(form.get("content", ""))
                self._redirect("/corpus", message=f"Document {doc_id} saved.")
                return
            if self.path == "/uploads":
                uploaded_files = files.get("file", [])
                uploaded_count = 0
                for upload in uploaded_files:
                    doc_id = self.app.upload_file(
                        upload["filename"],
                        upload["content"],
                    )
                    uploaded_count += 1
                path_value = form.get("manual_path", "").strip()
                registered_count = 0
                folder_count = 0
                if path_value:
                    path_obj = Path(path_value).expanduser()
                    if path_obj.is_dir():
                        docs = self.app.upload_folder(path_obj)
                        folder_count += len(docs)
                    else:
                        self.app.register_file(path_obj)
                        registered_count += 1
                total = uploaded_count + registered_count + folder_count
                if total == 0:
                    raise ValueError("Please upload a file/folder or provide a path")
                summary = []
                if uploaded_count:
                    summary.append(f"Uploaded {uploaded_count} file(s)")
                if registered_count:
                    summary.append(f"Registered {registered_count} path(s)")
                if folder_count:
                    summary.append(f"Ingested {folder_count} file(s) from folder")
                self._redirect("/corpus", message="; ".join(summary))
                return
            if self.path == "/urls":
                doc_id = self.app.register_url(
                    form.get("url", "")
                )
                self._redirect("/corpus", message=f"Document {doc_id} registered from URL.")
                return
            if self.path == "/indexes":
                documents = form.get("documents") or ""
                doc_list = [doc.strip() for doc in documents.split(",") if doc.strip()]
                window_chars_val = form.get("window_chars")
                overlap_chars_val = form.get("overlap_chars")
                window_chars = int(window_chars_val) if window_chars_val else None
                overlap_chars = int(overlap_chars_val) if overlap_chars_val else None
                name = self.app.build_index(
                    model=form.get("model", "text-mini"),
                    policy=form.get("policy", "sliding"),
                    documents=doc_list or None,
                    name=form.get("name") or None,
                    window_chars=window_chars,
                    overlap_chars=overlap_chars,
                )
                self._redirect("/indexes", message=f"Index {name} built.")
                return
            if self.path == "/reset-indexes":
                self.app.reset_all_indexes()
                self._redirect("/indexes", message="All indexes have been reset.")
                return
            if self.path == "/query":
                index = form.get("index", "")
                text = form.get("text", "")
                top_k = int(form.get("top_k", "5") or 5)
                min_score_value = form.get("min_score")
                min_score = None
                if min_score_value:
                    try:
                        min_score = float(min_score_value)
                    except ValueError:
                        min_score = None
                results = self.app.query(index, text, top_k=top_k, min_score=min_score)
                self._render(
                    UXContext(
                        message=f"Showing {len(results)} results for {index}",
                        query_results=results,
                        query_index=index,
                        query_text=text,
                        query_min_score=min_score,
                        view="indexes",
                    )
                )
                return
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")
        except Exception as exc:  # pragma: no cover - interactive UX
            self._render(UXContext(message=f"Error: {exc}"))


def run_server(
    *,
    host: str = "127.0.0.1",
    port: int = 8000,
    corpus: Optional[Path] = None,
) -> None:
    corpus_root = corpus or Path(__file__).resolve().parents[2] / "data"
    app = UXApplication(corpus_root)
    UXRequestHandler.app = app
    server = ThreadingHTTPServer((host, port), UXRequestHandler)
    print(f"Serving UX on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:  # pragma: no cover - manual stop
        print("\nShutting down...")
    finally:
        server.server_close()


def main(argv: Optional[List[str]] = None) -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Run the web UX server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--corpus",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data",
        help="Directory where corpus + indexes are stored",
    )
    args = parser.parse_args(argv)
    run_server(host=args.host, port=args.port, corpus=args.corpus)


if __name__ == "__main__":  # pragma: no cover
    main()
    def upload_folder(self, folder_path: Path) -> List[str]:
        folder = Path(folder_path).expanduser()
        if not folder.exists() or not folder.is_dir():
            raise FileNotFoundError(f"Folder not found: {folder}")
        registered: List[str] = []
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                doc_id = self.register_file(path)
                registered.append(doc_id)
        return registered

    def reset_all_indexes(self) -> None:
        for status in list(self.service.list_indexes()):
            self.service.reset_index(status.name)
