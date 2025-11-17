"""API layer powering UX/CLI."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from .chunking import (
    ChunkingPolicy,
    ParagraphChunker,
    SlidingWindowChunker,
    WholeDocumentChunker,
)
from .corpus import CorpusManager, DocumentRecord
from .embeddings import HashedEmbeddingModel, SentenceTransformerEmbeddingModel
from .index import IndexManager, IndexStatus, VectorIndex


class IndexingService:
    """Facade bundling corpus, chunkers, and indexes."""

    def __init__(self, corpus_root: Path) -> None:
        self.corpus = CorpusManager(corpus_root)
        self.index_manager = IndexManager()
        self._models = {
            "text-mini": SentenceTransformerEmbeddingModel(
                "text-mini", "sentence-transformers/all-MiniLM-L6-v2"
            ),
            "text-e5": SentenceTransformerEmbeddingModel(
                "text-e5", "intfloat/e5-small-v2"
            ),
            "text-bge": SentenceTransformerEmbeddingModel(
                "text-bge", "BAAI/bge-small-en-v1.5"
            ),
            "text-hash": HashedEmbeddingModel("text-hash"),
        }
        self.index_dir = self.corpus.root / "indexes"
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self._manifests: Dict[str, Dict[str, object]] = {}
        self._load_manifests()

    # ------------------------------------------------------------------
    def register_local(
        self,
        doc_id: str,
        path: Path,
        *,
        kind: str = "text",
        tags: Optional[Iterable[str]] = None,
        description: Optional[str] = None,
    ) -> DocumentRecord:
        return self.corpus.register_local_file(
            doc_id, path, kind, tags=tags, description=description
        )

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
        return self.corpus.register_url(
            doc_id,
            url,
            local_copy=local_copy,
            kind=kind,
            tags=tags,
            description=description,
        )

    # ------------------------------------------------------------------
    def _resolve_policy(
        self,
        name: str,
        *,
        window_chars: Optional[int] = None,
        overlap_chars: Optional[int] = None,
    ) -> ChunkingPolicy:
        lookup = {
            "sliding": SlidingWindowChunker(
                window_chars=window_chars or SlidingWindowChunker.DEFAULT_WINDOW_CHARS,
                overlap_chars=overlap_chars
                or SlidingWindowChunker.DEFAULT_OVERLAP_CHARS,
            ),
            "paragraph": ParagraphChunker(),
            "document": WholeDocumentChunker(),
        }
        try:
            return lookup[name]
        except KeyError as exc:
            raise KeyError(f"Unknown policy: {name}") from exc

    def _resolve_model(self, name: str):
        try:
            return self._models[name]
        except KeyError as exc:
            raise KeyError(f"Unknown model: {name}") from exc

    def _default_index_name(self, model: str, policy: str) -> str:
        return f"{model}_{policy}"

    # ------------------------------------------------------------------
    def _manifest_path(self, name: str) -> Path:
        return self.index_dir / f"{name}.json"

    def _load_manifests(self) -> None:
        for path in self.index_dir.glob("*.json"):
            payload = json.loads(path.read_text())
            name = payload["name"]
            model_name = payload.get("model")
            if model_name not in self._models:
                path.unlink(missing_ok=True)
                continue
            self._manifests[name] = payload

    def _write_manifest(self, name: str, manifest: Dict[str, object]) -> None:
        self._manifests[name] = manifest
        self._manifest_path(name).write_text(json.dumps(manifest, indent=2))

    def _delete_manifest(self, name: str) -> None:
        self._manifests.pop(name, None)
        path = self._manifest_path(name)
        if path.exists():
            path.unlink()

    def _ensure_index_loaded(self, name: str) -> VectorIndex:
        if name in self.index_manager:
            return self.index_manager._indexes[name]
        manifest = self._manifests.get(name)
        if not manifest:
            raise KeyError(f"Unknown index: {name}")
        policy_name = manifest["policy"]
        model_name = manifest["model"]
        documents = manifest.get("documents", [])
        chunk_config = manifest.get("chunk_config", {})
        policy_obj = self._resolve_policy(
            policy_name,
            window_chars=chunk_config.get("window_chars"),
            overlap_chars=chunk_config.get("overlap_chars"),
        )
        model_obj = self._resolve_model(model_name)
        index = self.index_manager.get_or_create(name, policy=policy_obj, model=model_obj)
        for doc_id in documents:
            text = self.corpus.load_content(doc_id)
            index.add_document(
                doc_id,
                text,
                metadata={"policy": policy_name, "model": model_name},
            )
        return index

    def build_index(
        self,
        *,
        model: str,
        policy: str,
        documents: Optional[Iterable[str]] = None,
        name: Optional[str] = None,
        window_chars: Optional[int] = None,
        overlap_chars: Optional[int] = None,
    ) -> IndexStatus:
        policy_obj = self._resolve_policy(
            policy, window_chars=window_chars, overlap_chars=overlap_chars
        )
        model_obj = self._resolve_model(model)
        index_name = name or self._default_index_name(model, policy)
        if index_name in self.index_manager:
            self.index_manager.reset(index_name)
        index = self.index_manager.get_or_create(
            index_name, policy=policy_obj, model=model_obj
        )
        target_docs = list(
            documents or [doc.doc_id for doc in self.corpus.list_documents()]
        )
        for doc_id in target_docs:
            text = self.corpus.load_content(doc_id)
            index.add_document(
                doc_id, text, metadata={"policy": policy, "model": model}
            )
        manifest = {
            "name": index_name,
            "model": model,
            "policy": policy,
            "documents": target_docs,
            "chunk_config": (
                {
                    "window_chars": policy_obj.window_chars,
                    "overlap_chars": policy_obj.overlap_chars,
                }
                if isinstance(policy_obj, SlidingWindowChunker)
                else {}
            ),
        }
        self._write_manifest(index_name, manifest)
        return index.status()

    # ------------------------------------------------------------------
    def query(
        self,
        index_name: str,
        text: str,
        *,
        top_k: int = 5,
        min_score: Optional[float] = None,
    ) -> List[Tuple[float, Dict[str, str]]]:
        index = self._ensure_index_loaded(index_name)
        results = [
            (score, {"chunk_id": record.chunk_id, "doc_id": record.doc_id, "text": record.text})
            for score, record in index.query(text, top_k=top_k)
        ]
        if min_score is not None:
            results = [item for item in results if item[0] >= min_score]
        return results

    # ------------------------------------------------------------------
    def list_indexes(self) -> List[IndexStatus]:
        statuses: List[IndexStatus] = []
        if not self._manifests:
            return statuses
        for name in sorted(self._manifests):
            index = self._ensure_index_loaded(name)
            statuses.append(index.status())
        return statuses

    def reset_index(self, name: str) -> None:
        self.index_manager.reset(name)
        self._delete_manifest(name)


__all__ = ["IndexingService"]
