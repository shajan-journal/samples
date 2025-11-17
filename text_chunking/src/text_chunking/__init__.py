"""Reference implementation for the text chunking PRD."""

from .corpus import CorpusManager, DocumentRecord
from .chunking import (
    ChunkingPolicy,
    SlidingWindowChunker,
    ParagraphChunker,
    WholeDocumentChunker,
)
from .embeddings import HashedEmbeddingModel, SentenceTransformerEmbeddingModel
from .index import IndexManager, IndexStatus
from .api import IndexingService

__all__ = [
    "CorpusManager",
    "DocumentRecord",
    "ChunkingPolicy",
    "SlidingWindowChunker",
    "ParagraphChunker",
    "WholeDocumentChunker",
    "HashedEmbeddingModel",
    "SentenceTransformerEmbeddingModel",
    "IndexManager",
    "IndexStatus",
    "IndexingService",
]
