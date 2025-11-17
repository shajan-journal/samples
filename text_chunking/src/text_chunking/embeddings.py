"""Embedding backends."""
from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from functools import cached_property
from typing import Iterable, List


@dataclass
class EmbeddingModel:
    """Abstract embedding model."""

    name: str

    @property
    def dimensions(self) -> int:  # pragma: no cover - interface
        raise NotImplementedError

    def embed_text(self, text: str) -> List[float]:  # pragma: no cover - interface
        raise NotImplementedError


class HashedEmbeddingModel(EmbeddingModel):
    """Deterministic hashing-based embedding (fallback for tables/images)."""

    def __init__(self, name: str, dimensions: int = 128) -> None:
        super().__init__(name=name)
        self._dimensions = dimensions

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def _vector_from_tokens(self, tokens: Iterable[str]) -> List[float]:
        vector = [0.0] * self.dimensions
        for token in tokens:
            digest = hashlib.sha256(f"{self.name}:{token}".encode("utf-8")).digest()
            bucket = int.from_bytes(digest[:4], "big") % self.dimensions
            vector[bucket] += 1.0
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]

    def embed_text(self, text: str) -> List[float]:
        tokens = [token.lower() for token in text.split() if token]
        return self._vector_from_tokens(tokens)


class TableEmbeddingModel(HashedEmbeddingModel):
    def __init__(self, dimensions: int = 128) -> None:
        super().__init__("table", dimensions=dimensions)

    def embed_text(self, text: str) -> List[float]:
        cells = [cell.strip().lower() for cell in text.replace("\t", "|").split("|")]
        return self._vector_from_tokens(cell for cell in cells if cell)


class ImageEmbeddingModel(HashedEmbeddingModel):
    def __init__(self, dimensions: int = 128) -> None:
        super().__init__("image", dimensions=dimensions)

    def embed_text(self, text: str) -> List[float]:
        return super().embed_text(f"image {text}")


class SentenceTransformerEmbeddingModel(EmbeddingModel):
    """Wrapper around sentence-transformers checkpoints."""

    def __init__(self, name: str, checkpoint: str) -> None:
        super().__init__(name=name)
        self.checkpoint = checkpoint
        self._model = None

    def _ensure_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.checkpoint)

    @cached_property
    def dimensions(self) -> int:
        self._ensure_model()
        return int(self._model.get_sentence_embedding_dimension())

    def embed_text(self, text: str) -> List[float]:
        self._ensure_model()
        vector = self._model.encode(text, normalize_embeddings=True)
        return vector.tolist()


__all__ = [
    "EmbeddingModel",
    "HashedEmbeddingModel",
    "SentenceTransformerEmbeddingModel",
    "TableEmbeddingModel",
    "ImageEmbeddingModel",
]
