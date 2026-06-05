
# Super optimized graph engine - minimal computational steps for instant uploads
import numpy as np
import re
from datetime import datetime
import hashlib

SIMILARITY_CROSS_PDF = 0.65
SIMILARITY_INTRA_PDF = 0.45
MAX_CONCEPTS_PER_PDF = 6
MIN_CONCEPTS = 4

TOPIC_COLOR = "#FF5722"
VIBRANT_COLORS = [
    "#FF6B35", "#8B5CF6", "#3B82F6", "#EC4899",
    "#10B981", "#F59E0B", "#06B6D4", "#EF4444", "#84CC16"
]

def pdf_id_from_name(pdf_name: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_]+", "_", pdf_name.lower()).strip("_") or "pdf"
    return f"{safe}_{hashlib.md5(pdf_name.encode()).hexdigest()[:6]}"

def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return np.dot(a, b) / (norm_a * norm_b)

def _title_from_chunk(text: str) -> str:
    words = re.findall(r"[A-Za-z][A-Za-z0-9]{2,}", text[:250])
    seen = set()
    candidates = []
    for w in words:
        low = w.lower()
        if low in seen or low in {"the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "was", "but", "not", "you"}:
            continue
        seen.add(low)
        candidates.append(w.title())
        if len(candidates) >= 3:
            break
    if not candidates:
        candidates = [text[:30].strip() or "Document Topic"]
    return " ".join(candidates[:2])

def _slug(label: str, idx: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_") or "node"
    return f"{base}_{idx}"

def _extract_concept_labels(chunks: list, embed_model, max_concepts: int = MAX_CONCEPTS_PER_PDF) -> list:
    if not chunks:
        return []
    texts = [c.strip()[:200] for c in chunks if c and len(c.strip()) > 30]
    if not texts:
        texts = [chunks[0][:150]] if chunks else ["Concept 1"]
    texts = texts[:15]
    
    # Simple frequency-based concept extraction (no ML)
    words = []
    for t in texts:
        words.extend(re.findall(r"[A-Za-z][A-Za-z0-9]{2,}", t))
    word_freq = {}
    stop_words = {"the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "was", "but", "not", "you", "they", "them", "their"}
    for w in words:
        low = w.lower()
        if low in stop_words:
            continue
        word_freq[low] = word_freq.get(low, 0) + 1
    sorted_words = sorted(word_freq.items(), key=lambda x: (-x[1], x[0]))[:max_concepts]
    concepts = []
    seen = set()
    for word, freq in sorted_words:
        if word in seen:
            continue
        seen.add(word)
        concepts.append({
            "label": word.title(),
            "sourcePage": 1,
            "chunkIndex": 0,
            "chunkText": texts[0] if texts else "",
            "type": "concept"
        })
        if len(concepts) >= max_concepts:
            break
    while len(concepts) < MIN_CONCEPTS:
        idx = len(concepts)
        concepts.append({
            "label": f"Key Idea {idx+1}",
            "sourcePage": 1,
            "chunkIndex": 0,
            "chunkText": texts[0] if texts else "",
            "type": "concept"
        })
    if concepts:
        concepts[0]["type"] = "topic"
        concepts[0]["color"] = TOPIC_COLOR
    return concepts

def build_pdf_subgraph(pdf_name: str, chunks: list, embed_model, color_index: int = 0) -> dict:
    pid = pdf_id_from_name(pdf_name)
    concepts = _extract_concept_labels(chunks, embed_model)
    if not concepts:
        return {"pdfId": pid, "pdfName": pdf_name, "nodes": [], "edges": []}
    
    nodes = []
    concept_ids = []
    for i, c in enumerate(concepts):
        nid = f"{pid}_{_slug(c['label'], i)}"
        concept_ids.append(nid)
        color = TOPIC_COLOR if c.get("type") == "topic" else VIBRANT_COLORS[(i + color_index) % len(VIBRANT_COLORS)]
        nodes.append({
            "id": nid,
            "label": c["label"],
            "pdfId": pid,
            "sourcePdf": pdf_name,
            "parent": pid,
            "sourcePage": c.get("sourcePage", 1),
            "type": c.get("type", "concept"),
            "color": color,
            "chunkText": c.get("chunkText", "")
        })
    
    edges = []
    topic_id = concept_ids[0] if concept_ids else None
    if topic_id:
        for i, cid in enumerate(concept_ids[1:], start=1):
            edges.append({
                "id": f"{pid}_e{i}",
                "source": topic_id,
                "target": cid,
                "label": "includes",
                "intraPdf": True,
                "weight": 1.0
            })
            if i > 1 and i < len(concept_ids):
                edges.append({
                    "id": f"{pid}_cx{i}",
                    "source": concept_ids[i-1],
                    "target": cid,
                    "label": "related to",
                    "intraPdf": True,
                    "weight": 0.7
                })
    
    return {
        "pdfId": pid,
        "pdfName": pdf_name,
        "nodes": nodes,
        "edges": edges
    }

def upsert_pdf_graph(existing_graphs: list, new_subgraph: dict) -> list:
    result = []
    inserted = False
    for g in existing_graphs:
        if g.get("pdfId") == new_subgraph.get("pdfId"):
            result.append(new_subgraph)
            inserted = True
        else:
            result.append(g)
    if not inserted:
        result.append(new_subgraph)
    return result

def merge_chat_graph(pdf_graphs: list, embed_model) -> dict:
    all_nodes = []
    all_edges = []
    for g in pdf_graphs:
        all_nodes.extend(g.get("nodes", []))
        all_edges.extend(g.get("edges", []))
    return {"nodes": all_nodes, "edges": all_edges, "positions": {}}

def apply_positions_to_nodes(nodes: list, pos_map: dict):
    for n in nodes:
        if pos_map and n["id"] in pos_map:
            n["position"] = pos_map[n["id"]]
    return nodes

def strip_embeddings_from_graph(graph_list: list) -> list:
    return graph_list
