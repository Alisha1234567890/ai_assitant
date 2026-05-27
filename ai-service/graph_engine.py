"""
Production knowledge graph builder — per-PDF clusters, embedding similarity, incremental updates.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

import numpy as np

SIMILARITY_CROSS_PDF = 0.75 # Lowered for better connectivity
SIMILARITY_INTRA_PDF = 0.55 # Lowered to avoid "0 Relations" issue
MAX_CONCEPTS_PER_PDF = 14 
MIN_CONCEPTS = 4


TOPIC_COLOR = "#2563eb" # Modern Blue to match frontend
PDF_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"]



def pdf_id_from_name(pdf_name: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "_", (pdf_name or "pdf").lower()).strip("_") or "pdf"
    return f"pdf_{base[:48]}"


def _slug(label: str, idx: int) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (label or "concept").lower()).strip("_") or "concept"
    return f"{s[:32]}_{idx}"


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _extract_concept_labels(chunks: list[str], embed_model, max_concepts: int = MAX_CONCEPTS_PER_PDF) -> list[dict]:
    """Fast concept extraction via chunk embedding clustering (no LLM)."""
    if not chunks:
        return []

    texts = [c.strip()[:600] for c in chunks if c and len(c.strip()) > 40]
    if not texts:
        texts = [chunks[0][:200]] if chunks else []

    texts = texts[:40]
    emb = np.array(embed_model.encode(texts, show_progress_bar=False)).astype("float32")
    n = len(texts)
    k = min(max_concepts, max(MIN_CONCEPTS, n // 3))

    if n <= k:
        return [
            {"label": _title_from_chunk(t), "embedding": emb[i], "sourcePage": 1, "chunkIndex": i}
            for i, t in enumerate(texts[:max_concepts])
        ]

    try:
        from sklearn.cluster import KMeans
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels_idx = km.fit_predict(emb)
    except Exception:
        labels_idx = list(range(n))

    concepts = []
    seen_labels = set()
    for cluster_id in range(k):
        indices = [i for i, l in enumerate(labels_idx) if l == cluster_id]
        if not indices:
            continue
        centroid = emb[indices].mean(axis=0)
        best_i = max(indices, key=lambda i: _cosine_sim(emb[i], centroid))
        label = _title_from_chunk(texts[best_i])
        key = label.lower()[:40]
        if key in seen_labels:
            continue
        seen_labels.add(key)
        concepts.append({
            "label": label,
            "embedding": centroid,
            "sourcePage": best_i + 1,
            "chunkIndex": best_i,
            "type": "concept",
        })
        if len(concepts) >= max_concepts:
            break

    if not concepts:
        concepts.append({
            "label": _title_from_chunk(texts[0]),
            "embedding": emb[0],
            "sourcePage": 1,
            "chunkIndex": 0,
            "type": "concept",
        })
    concepts[0]["type"] = "topic"
    concepts[0]["color"] = TOPIC_COLOR
    return concepts


def _title_from_chunk(text: str) -> str:
    """Extract a very short 1-3 word topic from text."""
    text = re.sub(r"\s+", " ", text).strip()
    words = text.split()[:3] # Reduced from 8 to 3 words
    title = " ".join(words)
    if len(title) > 30: # Reduced from 48 to 30 chars
        title = title[:27] + "…"
    return title or "Concept"


def build_pdf_subgraph(
    pdf_name: str,
    chunk_texts: list[str],
    embed_model,
    color_index: int = 0,
) -> dict:
    """Build nodes/edges for one PDF cluster including compound parent."""
    pid = pdf_id_from_name(pdf_name)
    parent_id = f"cluster_{pid}"
    color = PDF_COLORS[color_index % len(PDF_COLORS)]

    concepts = _extract_concept_labels(chunk_texts, embed_model)
    nodes = [
        {
            "id": parent_id,
            "label": pdf_name.replace("_", " "),
            "pdfId": pid,
            "sourcePdf": pdf_name,
            "type": "pdf_cluster",
            "color": color,
            "position": None,
        }
    ]
    edges = []

    concept_ids = []
    for i, c in enumerate(concepts):
        nid = f"{pid}_{_slug(c['label'], i)}"
        concept_ids.append(nid)
        node_color = (
            TOPIC_COLOR
            if c.get("type") == "topic"
            else ("#1a6aff" if i % 2 == 0 else "#7b5ea7")
        )
        nodes.append({
            "id": nid,
            "label": c["label"],
            "pdfId": pid,
            "sourcePdf": pdf_name,
            "parent": parent_id,
            "sourcePage": c.get("sourcePage", 1),
            "type": c.get("type", "concept"),
            "color": node_color,
            "position": None,
            "createdAt": datetime.utcnow().isoformat(),
        })
        edges.append({
            "id": f"e_{parent_id}_{nid}",
            "source": parent_id,
            "target": nid,
            "label": "contains",
            "kind": "hierarchy",
        })

    embs = [c["embedding"] for c in concepts]
    for i in range(len(concept_ids)):
        for j in range(i + 1, len(concept_ids)):
            sim = _cosine_sim(embs[i], embs[j])
            if sim >= SIMILARITY_INTRA_PDF:
                edges.append({
                    "id": f"e_intra_{concept_ids[i]}_{concept_ids[j]}",
                    "source": concept_ids[i],
                    "target": concept_ids[j],
                    "label": "related",
                    "weight": round(sim, 3),
                    "kind": "intra",
                })

    return {
        "pdfId": pid,
        "pdfName": pdf_name,
        "nodes": nodes,
        "edges": edges,
        "viewport": {"zoom": 1, "pan": {"x": 0, "y": 0}},
        "layoutComputed": False,
        "updatedAt": datetime.utcnow().isoformat(),
    }


def pdf_centroid_embedding(pdf_graph: dict, embed_model) -> np.ndarray | None:
    concept_nodes = [n for n in pdf_graph.get("nodes", []) if n.get("type") != "pdf_cluster"]
    if not concept_nodes:
        return None
    labels = [n["label"] for n in concept_nodes[:8]]
    return np.array(embed_model.encode(labels, show_progress_bar=False)).astype("float32").mean(axis=0)


def merge_cross_pdf_edges(pdf_graphs: list[dict], embed_model) -> list[dict]:
    """Only link PDF clusters when cross-document similarity > 0.80."""
    cross = []
    centroids = []
    for g in pdf_graphs:
        c = pdf_centroid_embedding(g, embed_model)
        if c is not None:
            parent = next((n for n in g["nodes"] if n.get("type") == "pdf_cluster"), None)
            if parent:
                centroids.append((g["pdfId"], parent["id"], c))

    for i in range(len(centroids)):
        for j in range(i + 1, len(centroids)):
            sim = _cosine_sim(centroids[i][2], centroids[j][2])
            if sim >= SIMILARITY_CROSS_PDF:
                cross.append({
                    "id": f"e_cross_{centroids[i][0]}_{centroids[j][0]}",
                    "source": centroids[i][1],
                    "target": centroids[j][1],
                    "label": "semantically linked",
                    "weight": round(sim, 3),
                    "kind": "cross_pdf",
                })
    return cross


def merge_chat_graph(pdf_graphs: list[dict], embed_model) -> dict:
    """Unified graph payload for Cytoscape."""
    all_nodes, all_edges = [], []
    positions = {}

    for g in pdf_graphs:
        all_nodes.extend(g.get("nodes", []))
        all_edges.extend(g.get("edges", []))
        for n in g.get("nodes", []):
            if n.get("position") and n["id"]:
                positions[n["id"]] = n["position"]

    all_edges.extend(merge_cross_pdf_edges(pdf_graphs, embed_model))

    chat_viewport = {"zoom": 1, "pan": {"x": 0, "y": 0}}
    layout_computed = all(
        g.get("layoutComputed") for g in pdf_graphs
    ) if pdf_graphs else False

    return {
        "pdfGraphs": pdf_graphs,
        "nodes": all_nodes,
        "edges": all_edges,
        "positions": positions,
        "viewport": chat_viewport,
        "layoutComputed": layout_computed,
        "hasPositions": len(positions) > 0,
    }


def upsert_pdf_graph(existing: list[dict], new_pdf: dict) -> list[dict]:
    pid = new_pdf["pdfId"]
    out = [g for g in existing if g.get("pdfId") != pid]
    out.append(new_pdf)
    return out


def apply_positions_to_nodes(nodes: list[dict], positions: dict) -> list[dict]:
    for n in nodes:
        pos = positions.get(n["id"])
        if pos:
            n["position"] = pos
    return nodes


def strip_embeddings_from_graph(pdf_graphs: list[dict]) -> list[dict]:
    """Remove non-serializable fields for MongoDB."""
    clean = []
    for g in pdf_graphs:
        cg = {
            "pdfId": g["pdfId"],
            "pdfName": g["pdfName"],
            "nodes": [{k: v for k, v in n.items() if k != "embedding"} for n in g.get("nodes", [])],
            "edges": g.get("edges", []),
            "viewport": g.get("viewport", {"zoom": 1, "pan": {"x": 0, "y": 0}}),
            "layoutComputed": g.get("layoutComputed", False),
            "updatedAt": g.get("updatedAt"),
        }
        clean.append(cg)
    return clean
