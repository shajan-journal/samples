"""Chunking policies for different indexing strategies."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence


def _tokenize(text: str) -> List[str]:
    return [token for token in text.split() if token]


@dataclass
class ChunkingPolicy:
    """Base class for chunking policies."""

    name: str

    def chunk(self, text: str) -> List[str]:  # pragma: no cover - interface
        raise NotImplementedError


@dataclass
class SlidingWindowChunker(ChunkingPolicy):
    DEFAULT_WINDOW_CHARS = 800
    DEFAULT_OVERLAP_CHARS = 200

    window_chars: int = DEFAULT_WINDOW_CHARS
    overlap_chars: int = DEFAULT_OVERLAP_CHARS

    def __init__(
        self,
        window_chars: int = DEFAULT_WINDOW_CHARS,
        overlap_chars: int = DEFAULT_OVERLAP_CHARS,
    ) -> None:
        super().__init__(name="sliding_window")
        if window_chars <= 0:
            raise ValueError("window_chars must be positive")
        if overlap_chars < 0:
            raise ValueError("overlap_chars cannot be negative")
        if overlap_chars >= window_chars:
            raise ValueError("overlap_chars must be smaller than window_chars")
        self.window_chars = window_chars
        self.overlap_chars = overlap_chars

    def chunk(self, text: str) -> List[str]:
        content = text.strip()
        if not content:
            return []
        chunks: List[str] = []
        step = self.window_chars - self.overlap_chars
        for start in range(0, len(content), step):
            window = content[start : start + self.window_chars].strip()
            if window:
                chunks.append(window)
        return chunks


@dataclass
class ParagraphChunker(ChunkingPolicy):
    def __init__(self) -> None:
        super().__init__(name="paragraph")

    def chunk(self, text: str) -> List[str]:
        return [para.strip() for para in text.split("\n\n") if para.strip()]


@dataclass
class WholeDocumentChunker(ChunkingPolicy):
    def __init__(self) -> None:
        super().__init__(name="whole_document")

    def chunk(self, text: str) -> List[str]:
        cleaned = text.strip()
        return [cleaned] if cleaned else []


def resolve_policy(name: str) -> ChunkingPolicy:
    name = name.lower()
    if name == "sliding" or name == "sliding_window":
        return SlidingWindowChunker()
    if name == "paragraph":
        return ParagraphChunker()
    if name in {"document", "whole", "whole_document"}:
        return WholeDocumentChunker()
    raise ValueError(f"Unknown chunking policy: {name}")


__all__ = [
    "ChunkingPolicy",
    "SlidingWindowChunker",
    "ParagraphChunker",
    "WholeDocumentChunker",
    "resolve_policy",
]
