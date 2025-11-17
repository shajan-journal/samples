"""Vector database built on HNSW."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import hnswlib
import numpy as np

from .chunking import ChunkingPolicy
from .embeddings import EmbeddingModel


@dataclass
class ChunkRecord:
    chunk_id: str
    doc_id: str
    text: str
    metadata: Dict[str, str]


@dataclass
class IndexStatus:
    name: str
    model: str
    policy: str
    documents: int
    chunks: int


class VectorIndex:
    """Approximate nearest neighbor index backed by hnswlib."""

    def __init__(self, name: str, policy: ChunkingPolicy, model: EmbeddingModel) -> None:
        self.name = name
        self.policy = policy
        self.model = model
        self._records: List[ChunkRecord] = []
        self._document_ids: set[str] = set()
        self._hnsw: hnswlib.Index | None = None
        self._max_elements = 2048
        self._next_label = 0

    # ------------------------------------------------------------------
    def _ensure_index(self) -> None:
        if self._hnsw is not None:
            return
        self._hnsw = hnswlib.Index(space="cosine", dim=self.model.dimensions)
        self._hnsw.init_index(
            max_elements=self._max_elements,
            ef_construction=200,
            M=32,
        )
        self._hnsw.set_ef(64)

    def _grow_if_needed(self, additional: int) -> None:
        if not self._hnsw:
            return
        required = self._next_label + additional
        if required <= self._max_elements:
            return
        while self._max_elements < required:
            self._max_elements *= 2
        self._hnsw.resize_index(self._max_elements)

    # ------------------------------------------------------------------
    def add_document(self, doc_id: str, text: str, *, metadata: Dict[str, str]) -> None:
        chunks = self.policy.chunk(text)
        vectors: List[np.ndarray] = []
        labels: List[int] = []
        for index, chunk_text in enumerate(chunks):
            chunk_id = f"{doc_id}:{index}"
            self._records.append(
                ChunkRecord(
                    chunk_id=chunk_id,
                    doc_id=doc_id,
                    text=chunk_text,
                    metadata={"order": str(index), **metadata},
                )
            )
            embedding = np.array(self.model.embed_text(chunk_text), dtype=np.float32)
            vectors.append(embedding)
            labels.append(self._next_label)
            self._next_label += 1
        if vectors:
            self._ensure_index()
            self._grow_if_needed(len(vectors))
            self._hnsw.add_items(np.vstack(vectors), labels)
            self._document_ids.add(doc_id)

    def query(self, text: str, top_k: int = 5) -> List[Tuple[float, ChunkRecord]]:
        if not self._hnsw or self._next_label == 0:
            return []
        vector = np.array(self.model.embed_text(text), dtype=np.float32).reshape(1, -1)
        labels, distances = self._hnsw.knn_query(vector, k=min(top_k, self._next_label))
        results: List[Tuple[float, ChunkRecord]] = []
        for label, dist in zip(labels[0], distances[0]):
            if label < len(self._records):
                results.append((1.0 - dist, self._records[label]))
        return results

    def status(self) -> IndexStatus:
        return IndexStatus(
            name=self.name,
            model=self.model.name,
            policy=self.policy.name,
            documents=len(self._document_ids),
            chunks=len(self._records),
        )


class IndexManager:
    """Tracks multiple indexes (per model × chunking strategy)."""

    def __init__(self) -> None:
        self._indexes: Dict[str, VectorIndex] = {}

    def get_or_create(self, name: str, *, policy: ChunkingPolicy, model: EmbeddingModel) -> VectorIndex:
        if name not in self._indexes:
            self._indexes[name] = VectorIndex(name, policy, model)
        return self._indexes[name]

    def reset(self, name: str) -> None:
        self._indexes.pop(name, None)

    def list_status(self) -> List[IndexStatus]:
        return [index.status() for index in self._indexes.values()]

    def __contains__(self, name: str) -> bool:
        return name in self._indexes


__all__ = ["ChunkRecord", "IndexStatus", "VectorIndex", "IndexManager"]
