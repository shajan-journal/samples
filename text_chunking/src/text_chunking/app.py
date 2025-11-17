"""Command-line UX for the text chunking PRD."""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, List

from .api import IndexingService
from .ux import render_documents, render_index_status, render_query_results


def _default_corpus_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "data"


def handle_ingest(args: argparse.Namespace) -> None:
    service = IndexingService(Path(args.corpus))
    record = service.register_local(args.doc_id, Path(args.path), kind=args.kind)
    print(f"Registered {record.doc_id} -> {record.path}")


def handle_list(args: argparse.Namespace) -> None:
    service = IndexingService(Path(args.corpus))
    print(render_documents(service.corpus.list_documents()))


def handle_index(args: argparse.Namespace) -> None:
    service = IndexingService(Path(args.corpus))
    documents = args.documents.split(",") if args.documents else None
    status = service.build_index(
        model=args.model,
        policy=args.policy,
        documents=documents,
        name=args.name,
        window_chars=args.window_chars,
        overlap_chars=args.overlap_chars,
    )
    print(render_index_status([status]))


def handle_query(args: argparse.Namespace) -> None:
    service = IndexingService(Path(args.corpus))
    results = service.query(
        args.index,
        args.text,
        top_k=args.top_k,
        min_score=args.min_score,
    )
    print(render_query_results(results))


def handle_status(args: argparse.Namespace) -> None:
    service = IndexingService(Path(args.corpus))
    print(render_index_status(service.list_indexes()))


def handle_reset(args: argparse.Namespace) -> None:
    service = IndexingService(Path(args.corpus))
    service.reset_index(args.index)
    print(f"Index {args.index} has been cleared.")


def handle_demo(args: argparse.Namespace) -> None:
    corpus_dir = Path(args.corpus)
    corpus_dir.mkdir(parents=True, exist_ok=True)
    print(
        "Demo mode: No default documents are bundled. Register your own files via"
        " 'ingest', the web UI, or the upload/download forms."
    )
    service = IndexingService(corpus_dir)
    print(render_documents(service.corpus.list_documents()))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Vector index playground")
    parser.add_argument(
        "--corpus",
        default=str(_default_corpus_dir()),
        help="Directory where corpus metadata and downloads are stored",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="Register a local file")
    ingest.add_argument("--doc-id", required=True)
    ingest.add_argument("--path", required=True)
    ingest.add_argument("--kind", default="text")
    ingest.set_defaults(func=handle_ingest)

    sub_list = sub.add_parser("list", help="List corpus contents")
    sub_list.set_defaults(func=handle_list)

    index_cmd = sub.add_parser("index", help="Build an index")
    index_cmd.add_argument(
        "--model",
        required=True,
        choices=["text-mini", "text-e5", "text-bge", "text-hash"],
    )
    index_cmd.add_argument(
        "--policy",
        required=True,
        choices=["sliding", "paragraph", "document"],
    )
    index_cmd.add_argument("--documents", help="Comma-separated document ids", default=None)
    index_cmd.add_argument(
        "--window-chars",
        type=int,
        default=None,
        help="Sliding-window size in characters (defaults to 800)",
    )
    index_cmd.add_argument(
        "--overlap-chars",
        type=int,
        default=None,
        help="Sliding-window overlap in characters (defaults to 200)",
    )
    index_cmd.add_argument("--name", help="Override index name", default=None)
    index_cmd.set_defaults(func=handle_index)

    query = sub.add_parser("query", help="Query an index")
    query.add_argument("--index", required=True)
    query.add_argument("--text", required=True)
    query.add_argument("--top-k", type=int, default=5)
    query.add_argument("--min-score", type=float, default=None, help="Optional score threshold (0-1)")
    query.set_defaults(func=handle_query)

    status = sub.add_parser("status", help="Show index status")
    status.set_defaults(func=handle_status)

    reset = sub.add_parser("reset", help="Reset an index")
    reset.add_argument("--index", required=True)
    reset.set_defaults(func=handle_reset)

    demo = sub.add_parser("demo", help="Run a scripted demo")
    demo.set_defaults(func=handle_demo)

    return parser


def main(argv: List[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    Path(args.corpus).mkdir(parents=True, exist_ok=True)
    args.func(args)


if __name__ == "__main__":  # pragma: no cover
    main()
