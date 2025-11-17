"""Console UX helpers."""
from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from .corpus import DocumentRecord
from .index import IndexStatus


def render_documents(documents: Iterable[DocumentRecord]) -> str:
    docs = list(documents)
    lines = [f"Corpus ({len(docs)} docs)"]
    if not docs:
        lines.append("  (empty)")
    else:
        for doc in docs:
            summary = f"- {doc.doc_id}: {doc.kind} ({doc.source})"
            if doc.description:
                summary += f" — {doc.description}"
            lines.append(summary)
    return "\n".join(lines)


def render_index_status(indexes: Iterable[IndexStatus]) -> str:
    indexes = list(indexes)
    if not indexes:
        return "No indexes have been built yet."
    lines = ["Indexes:"]
    for status in indexes:
        lines.append(
            f"- {status.name}: model={status.model} policy={status.policy} "
            f"chunks={status.chunks} docs={status.documents}"
        )
    return "\n".join(lines)


def render_query_results(results: List[Tuple[float, Dict[str, str]]]) -> str:
    if not results:
        return "No matches found."
    lines = ["Results:"]
    for score, record in results:
        preview = record["text"][:120].replace("\n", " ")
        lines.append(f"- {record['chunk_id']} score={score:.3f} -> {preview}")
    return "\n".join(lines)


__all__ = [
    "render_documents",
    "render_index_status",
    "render_query_results",
]
