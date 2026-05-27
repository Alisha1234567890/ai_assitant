import os
import uuid
import json
import re
import requests
import traceback
from typing import List
from fastapi import APIRouter, HTTPException, Header, Request
from datetime import datetime
from bson import ObjectId
from core.database import chat_collection
from models.schemas import KnowledgeMapRequest, GraphPositionsRequest, GraphBuildRequest
from services.rag_service import embed_model, GROQ_API_URL, GROQ_MODEL
import graph_engine as ge

router = APIRouter(tags=["graph"])

# Helper functions for graph building (moved from main.py)
async def _get_chat_pdf_graphs(chat_id: str) -> list:
    if not ObjectId.is_valid(chat_id):
        return []
    chat = await chat_collection.find_one({"_id": ObjectId(chat_id)})
    return (chat or {}).get("pdfGraphs", [])

async def _save_chat_pdf_graphs(chat_id: str, pdf_graphs: list, graph_positions: dict | None = None, graph_viewport: dict | None = None):
    update = {"pdfGraphs": ge.strip_embeddings_from_graph(pdf_graphs)}
    if graph_positions is not None:
        update["graphPositions"] = graph_positions
    if graph_viewport is not None:
        update["graphViewport"] = graph_viewport
    await chat_collection.update_one({"_id": ObjectId(chat_id)}, {"$set": update})

async def _build_pdf_graph_for_chat(chat_id: str, pdf_name: str, chunk_texts: list):
    if not chunk_texts or not ObjectId.is_valid(chat_id):
        return
    existing = await _get_chat_pdf_graphs(chat_id)
    color_idx = len([g for g in existing if g.get("pdfId") != ge.pdf_id_from_name(pdf_name)])
    new_sub = ge.build_pdf_subgraph(pdf_name, chunk_texts, embed_model, color_index=color_idx)
    merged_list = ge.upsert_pdf_graph(existing, new_sub)
    chat = await chat_collection.find_one({"_id": ObjectId(chat_id)}) or {}
    positions = chat.get("graphPositions", {})
    viewport = chat.get("graphViewport", {"zoom": 1, "pan": {"x": 0, "y": 0}})
    await _save_chat_pdf_graphs(chat_id, merged_list, positions, viewport)

async def _get_merged_graph_payload(chat_id: str) -> dict:
    chat = await chat_collection.find_one({"_id": ObjectId(chat_id)}) if ObjectId.is_valid(chat_id) else None
    pdf_graphs = (chat or {}).get("pdfGraphs", [])
    positions = (chat or {}).get("graphPositions", {})
    viewport = (chat or {}).get("graphViewport", {"zoom": 1, "pan": {"x": 0, "y": 0}})
    payload = ge.merge_chat_graph(pdf_graphs, embed_model)
    payload["positions"] = {**payload.get("positions", {}), **positions}
    payload["viewport"] = viewport
    payload["hasPositions"] = len(positions) > 0
    payload["layoutComputed"] = bool(
        (chat or {}).get("graphLayoutComputed") or payload["hasPositions"]
    )
    ge.apply_positions_to_nodes(payload["nodes"], payload["positions"])
    return payload

def _chunks_for_pdf_from_chat(chat: dict, pdf_name: str) -> list:
    documents = chat.get("documents", [])
    for meta in chat.get("pdfMeta", []):
        if meta.get("name") == pdf_name:
            s, c = meta.get("chunkStart", 0), meta.get("chunkCount", 0)
            return documents[s : s + c]
    return []

def _flatten_nodes_from_graphs(pdf_graphs: list) -> list:
    nodes = []
    for g in pdf_graphs:
        nodes.extend(g.get("nodes", []))
    return nodes

# API Routes
@router.get("/graph/{chatId}")
async def get_chat_graph(chatId: str):
    try:
        if not ObjectId.is_valid(chatId):
            return {"error": "Invalid Chat ID"}
        return await _get_merged_graph_payload(chatId)
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

@router.post("/graph/build")
async def build_chat_graph(req: GraphBuildRequest):
    try:
        if not ObjectId.is_valid(req.chatId):
            return {"error": "Invalid Chat ID"}
        chat_doc = await chat_collection.find_one({"_id": ObjectId(req.chatId)})
        if not chat_doc:
            return {"error": "Chat not found"}
        pdfs = [req.pdfName] if req.pdfName else chat_doc.get("pdfs", [])
        for pdf_name in pdfs:
            chunks = _chunks_for_pdf_from_chat(chat_doc, pdf_name)
            if chunks:
                await _build_pdf_graph_for_chat(req.chatId, pdf_name, chunks)
        return await _get_merged_graph_payload(req.chatId)
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

@router.put("/graph/{chatId}/state")
async def save_graph_state(chatId: str, body: GraphPositionsRequest):
    try:
        if not ObjectId.is_valid(chatId):
            return {"error": "Invalid Chat ID"}
        pdf_graphs = await _get_chat_pdf_graphs(chatId)
        for n in _flatten_nodes_from_graphs(pdf_graphs):
            pos = body.positions.get(n["id"])
            if pos:
                n["position"] = {"x": float(pos["x"]), "y": float(pos["y"])}
        update_fields = {
            "graphPositions": body.positions,
            "graphLayoutComputed": bool(body.layoutComputed),
        }
        if body.viewport:
            update_fields["graphViewport"] = body.viewport
        await chat_collection.update_one({"_id": ObjectId(chatId)}, {"$set": update_fields})
        await _save_chat_pdf_graphs(chatId, pdf_graphs, body.positions, body.viewport)
        return {"saved": True, "nodeCount": len(body.positions)}
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

# Knowledge Map logic (moved from main.py)
def _slug_id(label: str, idx: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", (label or "node").lower()).strip("_") or "node"
    return f"{base}_{idx}"

def fallback_knowledge_map(question: str, answer: str | None = None) -> dict:
    text = f"{question} {answer or ''}"
    words = re.findall(r"[A-Za-z][A-Za-z0-9-]{2,}", text)
    seen, labels = set(), []
    for w in words:
        low = w.lower()
        if low in seen or low in {"the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "was"}:
            continue
        seen.add(low)
        labels.append(w[:40])
        if len(labels) >= 10:
            break
    if not labels:
        labels = [question[:40] or "Query"]
    nodes = [{"id": _slug_id(lb, i), "label": lb} for i, lb in enumerate(labels)]
    center = nodes[0]["id"]
    edges = [
        {"id": f"e_{i}", "source": center, "target": n["id"], "label": "relates to"}
        for i, n in enumerate(nodes[1:], start=1)
    ]
    return {"nodes": nodes, "edges": edges, "centerId": center}

def parse_knowledge_map_json(raw: str) -> dict | None:
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    nodes_in = data.get("nodes") or []
    edges_in = data.get("edges") or []
    nodes, id_set = [], set()
    for i, n in enumerate(nodes_in):
        if isinstance(n, str):
            label, nid = n, _slug_id(n, i)
        else:
            label = (n.get("label") or n.get("name") or f"Concept {i + 1}").strip()
            nid = (n.get("id") or _slug_id(label, i)).strip()
        if not label or nid in id_set:
            continue
        id_set.add(nid)
        nodes.append({"id": nid, "label": label[:80]})
    if not nodes:
        return None
    edges = []
    for i, e in enumerate(edges_in):
        src = e.get("source") if isinstance(e, dict) else None
        tgt = e.get("target") if isinstance(e, dict) else None
        if not src or not tgt or src not in id_set or tgt not in id_set:
            continue
        edges.append({
            "id": e.get("id") or f"edge_{i}",
            "source": src,
            "target": tgt,
            "label": (e.get("label") or "related to")[:40],
        })
    center = data.get("centerId")
    if center not in id_set:
        center = nodes[0]["id"]
    return {"nodes": nodes[:15], "edges": edges[:25], "centerId": center}

def call_groq_knowledge_map(question: str, answer: str | None, context: str | None = None) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return fallback_knowledge_map(question, answer)

    system_prompt = (
        "You build knowledge maps for semantic exploration. "
        "Return ONLY valid JSON (no markdown): "
        '{"nodes":[{"id":"unique_id","label":"Concept Name"}],"edges":[{"id":"e1","source":"id_a","target":"id_b","label":"relationship"}],"centerId":"main_node_id"}. '
        "Rules: 6-12 nodes; centerId is the main topic from the user question; "
        "edges are short verb phrases (e.g. causes, includes, defines); "
        "use snake_case ids; base concepts on the question and answer."
    )
    user_parts = [f"QUESTION:\n{question}"]
    if answer:
        user_parts.append(f"ANSWER:\n{answer[:2000]}")
    if context:
        user_parts.append(f"DOCUMENT CONTEXT:\n{context[:1500]}")

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n\n".join(user_parts)},
        ],
        "max_tokens": 800,
        "temperature": 0.3,
        "top_p": 0.9,
    }

    resp = requests.post(
        GROQ_API_URL,
        json=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=25,
    )
    data = resp.json()
    if "choices" not in data:
        return fallback_knowledge_map(question, answer)

    raw = data["choices"][0]["message"]["content"]
    parsed = parse_knowledge_map_json(raw)
    return parsed if parsed else fallback_knowledge_map(question, answer)

def _find_saved_knowledge_map(chat_doc: dict, question: str) -> dict | None:
    q = question.strip()
    for m in reversed(chat_doc.get("knowledgeMaps", [])):
        if (m.get("question") or "").strip() == q and m.get("nodes"):
            return {
                "nodes": m["nodes"],
                "edges": m.get("edges", []),
                "centerId": m.get("centerId"),
                "mapId": m.get("id"),
                "fromCache": True,
                "saved": True,
            }
    return None

async def _save_knowledge_map_to_chat(chat_id: str, question: str, answer: str | None, graph: dict) -> str:
    map_id = str(uuid.uuid4())
    map_doc = {
        "id": map_id,
        "question": question.strip(),
        "answer": (answer or "")[:2000],
        "nodes": graph.get("nodes", []),
        "edges": graph.get("edges", []),
        "centerId": graph.get("centerId"),
        "createdAt": datetime.utcnow(),
    }
    await chat_collection.update_one(
        {"_id": ObjectId(chat_id)},
        {"$pull": {"knowledgeMaps": {"question": question.strip()}}},
    )
    await chat_collection.update_one(
        {"_id": ObjectId(chat_id)},
        {"$push": {"knowledgeMaps": map_doc}},
    )
    return map_id

def _serialize_knowledge_maps(maps: list | None) -> list:
    out = []
    for m in maps or []:
        entry = {
            "id": m.get("id"),
            "question": m.get("question", ""),
            "answer": m.get("answer", ""),
            "nodes": m.get("nodes", []),
            "edges": m.get("edges", []),
            "centerId": m.get("centerId"),
        }
        created = m.get("createdAt")
        if isinstance(created, datetime):
            entry["createdAt"] = created.isoformat()
        elif created:
            entry["createdAt"] = created
        out.append(entry)
    return out

@router.post("/knowledge-map")
async def knowledge_map(request: Request, req: KnowledgeMapRequest):
    try:
        chat_doc = None
        if req.chatId and ObjectId.is_valid(req.chatId):
            chat_doc = await chat_collection.find_one({"_id": ObjectId(req.chatId)})

        if chat_doc and not req.regenerate:
            cached = _find_saved_knowledge_map(chat_doc, req.question)
            if cached:
                return cached

        # Use RAG service for context
        from services.rag_service import retrieve_context
        context = ""
        if req.chatId and ObjectId.is_valid(req.chatId):
            context = retrieve_context(request.app.state, req.question, req.chatId)
        
        graph = call_groq_knowledge_map(req.question, req.answer, context)
        
        map_id = None
        if req.chatId and ObjectId.is_valid(req.chatId):
            map_id = await _save_knowledge_map_to_chat(req.chatId, req.question, req.answer, graph)
        
        graph["mapId"] = map_id
        graph["saved"] = bool(map_id)
        return graph
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}
