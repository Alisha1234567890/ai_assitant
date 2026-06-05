import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { registerCytoscapeExtensions, cytoscape } from "../../graph/cytoscapeSetup";
import {
  toCytoscapeElements,
  GRAPH_STYLESHEET,
  layoutForGraph,
  applyHubNodeSizes,
} from "../../utils/knowledgeMapElements";
import { IC } from "../../icons/Icons";
import { useTheme } from "../../context/ThemeContext";

registerCytoscapeExtensions();

const D = "div";

export default function KnowledgeGraphView({ graph, chatId, baseUrl, loading, initialFilter = "all" }) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLabels, setShowLabels] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(initialFilter);
  const [expandedNode, setExpandedNode] = useState(null);

  useEffect(() => {
    if (initialFilter) {
      setSelectedPdf(initialFilter);
    }
  }, [initialFilter]);


  const pdfOptions = useMemo(() => {
    const pdfs = new Set();
    (graph?.nodes || []).forEach((n) => {
      if (n.sourcePdf) pdfs.add(n.sourcePdf);
    });
    return ["all", ...Array.from(pdfs)];
  }, [graph]);

  const saveState = useCallback(async () => {
    if (!cyRef.current || !chatId || loading) return;
    try {
      setSaving(true);
      const cy = cyRef.current;
      const positions = {};
      cy.nodes().forEach((node) => {
        positions[node.id()] = node.position();
      });
      const viewport = {
        zoom: cy.zoom(),
        pan: cy.pan(),
      };
      await axios.put(`${baseUrl}/graph/${chatId}/state`, {
        positions,
        viewport,
        layoutComputed: true,
      });
    } catch (err) {
      console.error("Failed to save graph state:", err);
    } finally {
      setSaving(false);
    }
  }, [chatId, baseUrl, loading]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const isDark = theme === "dark";

    // Update graph styles based on theme (without overriding node colors!)
    cy.style()
      .selector("node")
      .style({
        "border-color": "#000000", // Always black border
      })
      .selector("node.pdf-cluster")
      .style({
        "color": isDark ? "#b0b0cc" : "#64748b",
      })
      .selector("edge")
      .style({
        "line-color": "#000000", // Always black edges
        "target-arrow-color": "#000000", // Always black arrows
        "text-background-color": isDark ? "#12121e" : "#ffffff",
        "color": "#000000", // Always black edge labels
      })
      .update();
  }, [theme]);

  useEffect(() => {
    if (!containerRef.current || !graph?.nodes) return;

    const elements = toCytoscapeElements(graph);
    console.log("[GraphView] Data nodes:", graph.nodes.length, "Edges:", graph.edges?.length);
    console.log("[GraphView] Transformed elements:", elements.length);

    const initCy = () => {
      const container = containerRef.current;
      if (!container) return;

      const { offsetWidth: width, offsetHeight: height } = container;
      console.log(`[GraphView] Container dimensions: ${width}x${height}`);

      if (width === 0 || height === 0) {
        console.warn("[GraphView] Container dimensions are 0, delaying initialization...");
        setTimeout(initCy, 100);
        return;
      }

      if (cyRef.current) {
        console.log("[GraphView] Updating existing instance...");
        const cy = cyRef.current;
        cy.elements().remove();
        cy.add(elements);

        const layout = cy.layout(layoutForGraph(graph));
        layout.one("layoutstop", () => {
          console.log("[GraphView] Layout finished");
          cy.resize();
          cy.fit(undefined, 50);
          applyHubNodeSizes(cy);
        });
        layout.run();
        return;
      }

      console.log("[GraphView] Initializing new Cytoscape instance...");
      try {
        const isDark = theme === "dark";
        cyRef.current = cytoscape({
          container: container,
          elements,
          style: GRAPH_STYLESHEET,
          layout: layoutForGraph(graph),
          wheelSensitivity: 0.2,
        });

        const cy = cyRef.current;

        // Initial theme application (without overriding node colors!)
        cy.style()
          .selector("node")
          .style({
            "border-color": "#000000", // Always black border
          })
          .selector("node.pdf-cluster")
          .style({
            "color": isDark ? "#b0b0cc" : "#64748b",
          })
          .selector("edge")
          .style({
            "line-color": "#000000", // Always black edges
            "target-arrow-color": "#000000", // Always black arrows
            "text-background-color": isDark ? "#12121e" : "#ffffff",
            "color": "#000000", // Always black edge labels
          })
          .update();

        cy.on("dragfree", "node", saveState);
        // Node tap/click to expand and show chunk text
        cy.on("tap", "node", (evt) => {
          const nodeData = evt.target.data();
          setExpandedNode({
            label: nodeData.label,
            sourcePdf: nodeData.sourcePdf,
            chunkText: nodeData.chunkText || "No chunk text available for this node"
          });
        });

        // Tooltip/Hover logic
        cy.on("mouseover", "node", (e) => {
          const node = e.target;
          node.addClass("highlight");
          node.neighborhood().addClass("highlight");
        });
        cy.on("mouseout", "node", (e) => {
          const node = e.target;
          node.removeClass("highlight");
          node.neighborhood().removeClass("highlight");
        });

        // Force resize and fit after initial render
        setTimeout(() => {
          cy.resize();
          cy.fit(undefined, 50);
          applyHubNodeSizes(cy);
          console.log("[GraphView] Initial fit complete. Rendered nodes:", cy.nodes().length);
        }, 200);

        if (graph.viewport) {
          cy.viewport(graph.viewport);
        }
      } catch (err) {
        console.error("[GraphView] Cytoscape initialization error:", err);
      }
    };

    initCy();

    return () => {
      // Keep instance alive for better performance across re-renders
    };
  }, [graph, saveState]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      const matches = cy.nodes().filter((n) =>
        n.data("label")?.toLowerCase().includes(lower)
      );
      cy.nodes().addClass("dim");
      matches.removeClass("dim").addClass("highlight");
      if (matches.length > 0) {
        cy.animate({ center: { eles: matches }, zoom: cy.zoom() }, { duration: 500 });
      }
    } else {
      cy.nodes().removeClass("dim highlight");
    }
  }, [searchTerm]);

  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.nodes().style("text-opacity", showLabels ? 1 : 0);
  }, [showLabels]);

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setExpandedNode(null);
      }
    };
    if (expandedNode) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedNode]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (selectedPdf === "all") {
      cy.nodes().removeClass("dim-hidden");
      cy.edges().removeClass("dim-hidden");
    } else {
      const lowerSelected = selectedPdf.toLowerCase();
      // Find nodes that belong to the PDF or are the PDF cluster itself
      const pdfNodes = cy.nodes().filter((n) => {
        const sourcePdf = (n.data("sourcePdf") || "").toLowerCase();
        const label = (n.data("label") || "").toLowerCase();
        const isCluster = n.data("nodeType") === "pdf_cluster";

        return sourcePdf === lowerSelected || (isCluster && label.includes(lowerSelected.replace(".pdf", "")));
      });

      cy.nodes().addClass("dim-hidden");
      pdfNodes.removeClass("dim-hidden");

      // Ensure parents of visible nodes are also visible
      pdfNodes.parents().removeClass("dim-hidden");

      cy.edges().addClass("dim-hidden");
      pdfNodes.connectedEdges().removeClass("dim-hidden");
    }

    // Give layout a moment to settle before fitting
    setTimeout(() => {
      if (cyRef.current) cyRef.current.fit(undefined, 60);
    }, 100);
  }, [selectedPdf]);




  const handleResetLayout = () => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.layout({ ...layoutForGraph(null), randomize: true }).run();
    setTimeout(saveState, 1000);
  };

  const handleCenter = () => {
    if (!cyRef.current) return;
    cyRef.current.animate({ fit: { padding: 50 } }, { duration: 500 });
  };

  return (
    <D className="km-graph-root">
      <D className="km-graph-toolbar">
        <D className="km-graph-search-wrap">
          <input
            type="text"
            className="km-graph-search"
            placeholder="Search concepts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="km-graph-search-clear" onClick={() => setSearchTerm("")}>
              <IC.X />
            </button>
          )}
        </D>

        <D className="km-graph-actions">
          <button className="km-btn-icon" onClick={handleCenter} title="Center Graph">
            <IC.Center />
          </button>
          <button className="km-btn-icon" onClick={handleResetLayout} title="Reset Layout">
            <IC.Refresh />
          </button>
          <button
            className={`km-btn-icon ${!showLabels ? "km-btn-off" : ""}`}
            onClick={() => setShowLabels(!showLabels)}
            title="Toggle Labels"
          >
            {showLabels ? <IC.Eye /> : <IC.EyeOff />}
          </button>


          <select
            className="km-graph-filter"
            value={selectedPdf}
            onChange={(e) => setSelectedPdf(e.target.value)}
          >
            {pdfOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt === "all" ? "All Documents" : opt.length > 20 ? opt.slice(0, 20) + "..." : opt}
              </option>
            ))}
          </select>

          {saving && <span className="km-graph-toolbar-saving">Saving...</span>}
        </D>
      </D>

      <D className="km-graph-body-only" ref={containerRef} />

      {/* Expanded Node Modal */}
      {expandedNode && (
        <D className="km-node-modal-overlay" onClick={() => setExpandedNode(null)}>
          <D className="km-node-modal" onClick={(e) => e.stopPropagation()}>
            <D className="km-node-modal-header">
              <D className="km-node-modal-title">{expandedNode.label}</D>
              {expandedNode.sourcePdf && (
                <D className="km-node-modal-source">Source: {expandedNode.sourcePdf}</D>
              )}
              <button
                className="km-node-modal-close"
                onClick={() => setExpandedNode(null)}
              >
                ✕
              </button>
            </D>
            <D className="km-node-modal-content">
              <p className="km-node-modal-chunk-text">{expandedNode.chunkText}</p>
            </D>
          </D>
        </D>
      )}
    </D>
  );
}
