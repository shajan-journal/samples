"""Corpus management utilities."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from pypdf import PdfReader

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _html_to_text(value: str) -> str:
    """Naive HTML-to-text conversion by stripping tags."""
    return _HTML_TAG_RE.sub(" ", value)


def _pdf_to_text(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: List[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


@dataclass
class DocumentRecord:
    """Metadata describing a registered document."""

    doc_id: str
    source: str
    kind: str = "text"
    path: Optional[str] = None
    url: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    description: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: Dict[str, object]) -> "DocumentRecord":
        return cls(**payload)


class CorpusManager:
    """Keeps track of the corpus definition and downloaded assets."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.download_dir = self.root / "downloads"
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.registry_path = self.root / "corpus.json"
        self._documents: Dict[str, DocumentRecord] = {}
        self._load()

    # ------------------------------------------------------------------
    # Persistence helpers
    def _load(self) -> None:
        if not self.registry_path.exists():
            return
        data = json.loads(self.registry_path.read_text())
        for doc in data.get("documents", []):
            record = DocumentRecord.from_dict(doc)
            self._documents[record.doc_id] = record

    def _save(self) -> None:
        payload = {
            "documents": [doc.to_dict() for doc in self._documents.values()]
        }
        self.registry_path.write_text(json.dumps(payload, indent=2))

    # ------------------------------------------------------------------
    def register_local_file(
        self,
        doc_id: str,
        path: Path,
        kind: str = "text",
        *,
        tags: Optional[Iterable[str]] = None,
        description: Optional[str] = None,
    ) -> DocumentRecord:
        """Register a local file that belongs to the corpus."""
        record = DocumentRecord(
            doc_id=doc_id,
            source="file",
            kind=kind,
            path=str(Path(path).expanduser().resolve()),
            tags=list(tags or []),
            description=description,
        )
        self._documents[doc_id] = record
        self._save()
        return record

    def register_url(
        self,
        doc_id: str,
        url: str,
        *,
        local_copy: Optional[Path] = None,
        kind: str = "text",
        tags: Optional[Iterable[str]] = None,
        description: Optional[str] = None,
    ) -> DocumentRecord:
        """Register a URL; optionally point to a downloaded copy."""
        record = DocumentRecord(
            doc_id=doc_id,
            source="url",
            kind=kind,
            url=url,
            path=str(local_copy.expanduser().resolve()) if local_copy else None,
            tags=list(tags or []),
            description=description,
        )
        self._documents[doc_id] = record
        self._save()
        return record

    # ------------------------------------------------------------------
    def list_documents(self) -> List[DocumentRecord]:
        return sorted(self._documents.values(), key=lambda rec: rec.doc_id)

    def get_document(self, doc_id: str) -> DocumentRecord:
        try:
            return self._documents[doc_id]
        except KeyError as exc:
            raise KeyError(f"Unknown document: {doc_id}") from exc

    def load_content(self, doc_id: str) -> str:
        """Load the textual representation of the document."""
        record = self.get_document(doc_id)
        if not record.path:
            raise FileNotFoundError(
                f"Document {doc_id} does not have a local copy yet"
            )
        path = Path(record.path)
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            return _pdf_to_text(path)
        text = path.read_text(errors="ignore")
        if record.kind == "html" or suffix in {".html", ".htm"}:
            return _html_to_text(text)
        return text

    # ------------------------------------------------------------------
    def as_dict(self) -> Dict[str, object]:
        return {doc_id: rec.to_dict() for doc_id, rec in self._documents.items()}

    def __contains__(self, doc_id: str) -> bool:
        return doc_id in self._documents

    def __len__(self) -> int:
        return len(self._documents)


__all__ = ["CorpusManager", "DocumentRecord"]
