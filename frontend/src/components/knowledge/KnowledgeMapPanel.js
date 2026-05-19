import React, { useMemo, useRef, useEffect } from "react";
import cytoscape from "cytoscape";

import { IC } from "../../icons/Icons";
import Dots from "../common/Dots";

import {
  toCytoscapeElements,
  CYTOSCAPE_STYLE,
  CYTOSCAPE_LAYOUT,
} from "../../utils/knowledgeMapElements";

const D = "div";

function destroyCy(cyRef) {
  const cy = cyRef.current;
  if (!cy) return;
  try {
    cy.stop();
    cy.destroy();
  } catch {
    /* already destroyed */
  }
  cyRef.current = null;
}

export default function KnowledgeMapPanel({
  graph,
  loading,
  error,
  question,
  onClose,
  onRefresh,
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  const elements = useMemo(() => toCytoscapeElements(graph), [graph]);

  const graphKey = useMemo(
    () => elements.map((el) => el.data?.id).join("|"),
    [elements]
  );

  useEffect(() => {
    const container = containerRef.current;

    if (loading || !container || elements.length === 0) {
      destroyCy(cyRef);
      return undefined;
    }

    destroyCy(cyRef);

    const cy = cytoscape({
      container,
      elements,
      style: CYTOSCAPE_STYLE,
      wheelSensitivity: 0.25,
      minZoom: 0.2,
      maxZoom: 3,
    });

    cyRef.current = cy;

    const layout = cy.layout({
      ...CYTOSCAPE_LAYOUT,
      animate: false,
    });
    layout.run();
    cy.fit(undefined, 40);

    const onResize = () => {
      if (cyRef.current) {
        try {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 40);
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      destroyCy(cyRef);
    };
  }, [graphKey, loading, elements]);

  return (
    <aside className="knowledge-pane" aria-label="Knowledge map explorer">
      <D className="knowledge-head">
        <D className="knowledge-head-text">
          <IC.Graph />
          <D>
            <h2 className="knowledge-title">Knowledge Map</h2>
            <p className="knowledge-sub">
              {question
                ? question.length > 48
                  ? question.slice(0, 48) + "…"
                  : question
                : "Semantic concept graph"}
            </p>
          </D>
        </D>

        <D className="knowledge-head-actions">
          <button
            type="button"
            className="knowledge-refresh"
            onClick={onRefresh}
            disabled={loading}
            title="Regenerate map"
          >
            Refresh
          </button>
          <button
            type="button"
            className="knowledge-close"
            onClick={onClose}
            title="Close graph panel"
          >
            <IC.Close />
          </button>
        </D>
      </D>

      <D className="knowledge-cyto-wrap">
        <D
          ref={containerRef}
          className="knowledge-cyto-root"
          style={{
            width: "100%",
            height: "100%",
            visibility: elements.length > 0 && !loading ? "visible" : "hidden",
          }}
        />

        {loading && (
          <D className="knowledge-overlay">
            <Dots />
            <span>Mapping concepts…</span>
          </D>
        )}

        {error && !loading && (
          <D className="knowledge-overlay knowledge-overlay-error">
            <span>{error}</span>
            <button type="button" className="knowledge-retry" onClick={onRefresh}>
              Retry
            </button>
          </D>
        )}

        {!loading && !error && elements.length === 0 && (
          <D className="knowledge-empty">
            <IC.Graph />
            <p>No concepts to display yet.</p>
          </D>
        )}
      </D>

      {graph?.nodes?.length > 0 && !loading && (
        <D className="knowledge-foot">
          <span>{graph.nodes.length} concepts</span>
          <span>{(graph.edges || []).length} relations</span>
        </D>
      )}
    </aside>
  );
}
