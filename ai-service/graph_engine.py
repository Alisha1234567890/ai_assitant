
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
    concepts = []
    num_chunks = len(chunks)
    
    # Select chunks evenly from across the entire PDF
    selected_indices = []
    if num_chunks <= max_concepts:
        selected_indices = list(range(num_chunks))
    else:
        step = num_chunks / max_concepts
        selected_indices = [int(step * i) for i in range(max_concepts)]
    
    # Create a node for each selected chunk
    for i, chunk_idx in enumerate(selected_indices):
        chunk = chunks[chunk_idx]
        chunk_text = chunk.strip()
        if not chunk_text:
            continue
        
        # Make chunk text readable and not too long (max 350 chars, keep line breaks)
        if len(chunk_text) > 350:
            # Find the last space within 350 chars to cut cleanly
            cut_idx = chunk_text.rfind(' ', 0, 350)
            if cut_idx == -1:
                cut_idx = 350
            chunk_text = chunk_text[:cut_idx] + "..."
        
        # Extract a concept label from this specific chunk
        words = re.findall(r"[A-Za-z][A-Za-z0-9]{2,}", chunk_text[:250])
        stop_words = {"the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "was", "but", "not", "you", "they", "them", "their"}
        filtered_words = [w for w in words if w.lower() not in stop_words]
        
        label = "Key Idea"
        if filtered_words:
            label = " ".join(filtered_words[:2]).title()
        if len(label) < 2:
            label = f"Document Chunk {i+1}"
        
        concepts.append({
            "label": label,
            "sourcePage": 1,
            "chunkIndex": chunk_idx,
            "chunkText": chunk_text,  # Readable chunk text for this node!
            "type": "concept"
        })
        
        if len(concepts) >= max_concepts:
            break
    
    # Ensure we have at least MIN_CONCEPTS
    while len(concepts) < MIN_CONCEPTS:
        idx = len(concepts)
        fallback_idx = idx % num_chunks
        concepts.append({
            "label": f"Key Idea {idx+1}",
            "sourcePage": 1,
            "chunkIndex": fallback_idx,
            "chunkText": chunks[fallback_idx] if chunks else "",
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
