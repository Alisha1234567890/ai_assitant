import React, { useMemo } from "react";
import { IC } from "../../icons/Icons";
import Dots from "../common/Dots";
import KnowledgeGraphView from "./KnowledgeGraphView";
import { BASE } from "../../constants";
import { countDisplayEdges } from "../../utils/knowledgeMapElements";

const D = "div";

export default function KnowledgeMapPanel({
  graph,
  loading,
  error,
  chatId,
  onClose,
  onRefresh,
  fromCache,
  initialFilter,
}) {

  const conceptNodes = useMemo(
    () => (graph?.nodes || []).filter((n) => n.type !== "pdf_cluster"),
    [graph]
  );
  const nodeCount = conceptNodes.length;
  const edgeCount = countDisplayEdges(graph);

  const subtitle = useMemo(() => {
    const topic = conceptNodes.find((n) => n.type === "topic");
    if (graph?.question) {
      const q = graph.question;
      return q.length > 48 ? `"${q.slice(0, 48)}…"` : `"${q}"`;
    }
    if (topic?.label) {
      const l = topic.label;
      return l.length > 48 ? `"${l.slice(0, 48)}…"` : `"${l}"`;
    }
    return "Semantic Memory System";
  }, [graph, conceptNodes]);

  return (
    <aside className="knowledge-pane-modern" aria-label="Knowledge map">
      <D className="knowledge-head-modern">
        <D className="knowledge-head-content">
          <D className="knowledge-icon-badge">
            <IC.Graph />
          </D>
          <D>
            <h2 className="knowledge-title-modern">Knowledge Map</h2>
            <p className="knowledge-subtitle-modern">{subtitle}</p>
          </D>
        </D>
        <D className="knowledge-head-actions">
          {onRefresh && (
            <button
              type="button"
              className="knowledge-action-btn"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh layout"
            >
              {loading ? <Dots /> : "Refresh"}
            </button>
          )}
          <button type="button" className="knowledge-close-btn" onClick={onClose} title="Close">
            <IC.Close />
          </button>
        </D>
      </D>

      <D className="knowledge-graph-container">
        {error && !loading && (
          <D className="knowledge-error-overlay">
            <D className="knowledge-error-card">
              <span className="knowledge-error-msg">{error}</span>
              {onRefresh && (
                <button type="button" className="knowledge-retry-btn" onClick={onRefresh}>
                  Retry Mapping
                </button>
              )}
            </D>
          </D>
        )}
        {loading && !graph?.nodes?.length && (
          <D className="knowledge-loading-overlay">
            <D className="knowledge-loading-card">
              <Dots />
              <span className="knowledge-loading-text">Synthesizing semantic memory...</span>
            </D>
          </D>
        )}
        <KnowledgeGraphView graph={graph} chatId={chatId} baseUrl={BASE} loading={loading} initialFilter={initialFilter} />
      </D>


      {nodeCount > 0 && !loading && (
        <D className="knowledge-footer-modern">
          <D className="knowledge-stats">
            <D className="stat-item">
              <span className="stat-value">{nodeCount}</span>
              <span className="stat-label">Concepts</span>
            </D>
            <D className="stat-divider" />
            <D className="stat-item">
              <span className="stat-value">{edgeCount}</span>
              <span className="stat-label">Relations</span>
            </D>
          </D>
          {fromCache && (
            <D className="knowledge-status-badge">
              <D className="status-dot" />
              <span>Restored from memory</span>
            </D>
          )}
        </D>
      )}
    </aside>
  );
}

