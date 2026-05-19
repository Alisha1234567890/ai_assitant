"""Lazy embeddings: SentenceTransformer when possible, TF-IDF fallback on low RAM."""

import os
import shutil
from pathlib import Path

import numpy as np

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", "1")

MODEL_NAME = "all-MiniLM-L6-v2"
_st_model = None
_backend = None  # "st" | "tfidf"


def _hf_cache_dir() -> Path | None:
    hub = Path.home() / ".cache" / "huggingface" / "hub"
    candidate = hub / f"models--sentence-transformers--{MODEL_NAME.replace('/', '--')}"
    return candidate if candidate.exists() else None


def _load_sentence_transformer():
    global _st_model
    from sentence_transformers import SentenceTransformer

    try:
        _st_model = SentenceTransformer(MODEL_NAME, device="cpu")
        print("[EMBED] SentenceTransformer loaded")
        return
    except OSError as e:
        print(f"[EMBED] Load failed ({e}), clearing cache and retrying once…")
        cache = _hf_cache_dir()
        if cache:
            shutil.rmtree(cache, ignore_errors=True)
        _st_model = SentenceTransformer(MODEL_NAME, device="cpu")
        print("[EMBED] SentenceTransformer loaded after cache clear")


def backend() -> str:
    global _backend
    if _backend is not None:
        return _backend
    try:
        _load_sentence_transformer()
        _backend = "st"
    except Exception as e:
        print(f"[EMBED] Using TF-IDF fallback ({e})")
        _backend = "tfidf"
    return _backend


def encode_texts(texts: list[str], vectorizer=None):
    """Return (vectors float32 ndarray, vectorizer for tfidf backend)."""
    if not texts:
        return np.zeros((0, 384), dtype="float32"), vectorizer

    if backend() == "st":
        vecs = _st_model.encode(
            texts,
            batch_size=8,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return np.asarray(vecs, dtype="float32"), None

    from sklearn.feature_extraction.text import TfidfVectorizer

    if vectorizer is None:
        vectorizer = TfidfVectorizer(max_features=384, stop_words="english")
        matrix = vectorizer.fit_transform(texts)
    else:
        matrix = vectorizer.transform(texts)
    dense = matrix.astype(np.float32).toarray()
    return dense, vectorizer


def encode_query(question: str, vectorizer=None) -> np.ndarray:
    if backend() == "st":
        return np.asarray(
            _st_model.encode([question], show_progress_bar=False),
            dtype="float32",
        )
    if vectorizer is None:
        raise RuntimeError("TF-IDF vectorizer missing for query encoding")
    return vectorizer.transform([question]).astype(np.float32).toarray()
