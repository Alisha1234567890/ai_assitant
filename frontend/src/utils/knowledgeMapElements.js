/** Knowledge Map — Premium Light Theme with Compound Nodes */

const TOPIC_COLOR = "#1d4ed8"; // Deeper Blue for better contrast
const CONCEPT_COLOR = "#ffffff"; // White background
const BORDER_COLOR = "#94a3b8"; // Darker border for visibility
const TEXT_COLOR = "#0f172a"; // Darker text
const PDF_CLUSTER_BG = "rgba(241, 245, 249, 0.5)";


export function nodeDisplayColor(node, index = 0) {
  if (node.type === "topic") return TOPIC_COLOR;
  if (node.type === "pdf_cluster") return PDF_CLUSTER_BG;
  return CONCEPT_COLOR;
}

/** Organized semantic graph — supports PDF clusters (compound nodes) */
export function toCytoscapeElements(graph) {
  if (!graph?.nodes?.length) return [];

  const colorById = {};
  graph.nodes.forEach((n, i) => {
    colorById[n.id] = nodeDisplayColor(n, i);
  });

  const nodes = graph.nodes.map((n, i) => {
    const color = colorById[n.id];
    const isCluster = n.type === "pdf_cluster";
    
    const el = {
      data: {
        id: n.id,
        label: n.label || n.id,
        pdfId: n.pdfId || "",
        sourcePdf: n.sourcePdf || "",
        nodeType: n.type || "concept",
        color,
        parent: n.parent || undefined,
        sourcePage: n.sourcePage || 0,
      },
      classes: n.type === "topic" ? "topic" : isCluster ? "pdf-cluster" : "concept",
    };

    if (
      !isCluster &&
      typeof n.position?.x === "number" &&
      typeof n.position?.y === "number" &&
      !Number.isNaN(n.position.x) &&
      !Number.isNaN(n.position.y)
    ) {
      el.position = { x: n.position.x, y: n.position.y };
    }
    return el;
  });

  const nodeIds = new Set(nodes.map((n) => n.data.id));
  const edges = (graph.edges || [])
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    // Keep hierarchy edges for layout but maybe hide them visually if preferred
    // For now, let's keep all edges and style them differently
    .map((e, i) => ({
      data: {
        id: e.id || `edge_${i}`,
        source: e.source,
        target: e.target,
        label: e.label || "",
        edgeKind: e.kind || "intra",
        sourceColor: colorById[e.source] || TOPIC_COLOR,
      },
      classes: e.kind === "cross_pdf" ? "cross-edge" : e.kind === "hierarchy" ? "hierarchy-edge" : "intra-edge",
    }));

  return [...nodes, ...edges];
}

export function countDisplayEdges(graph) {
  return (graph?.edges || []).filter(
    (e) => e.kind !== "hierarchy" && e.label !== "contains"
  ).length;
}

/** Optimized fcose for natural spreading and readable clusters */
export const FCOS_LAYOUT = {
  name: "fcose",
  quality: "proof",
  animate: true,
  animationDuration: 1000,
  fit: true,
  padding: 60,
  randomize: true, 
  nodeRepulsion: 15000, 
  idealEdgeLength: 160,
  edgeElasticity: 0.45,
  gravity: 0.15, 
  gravityRange: 3.8,
  nestingFactor: 0.1,
  tile: true,
  packComponents: true,
  nodeDimensionsIncludeLabels: true,
  uniformNodeDimensions: false,
  sampleSize: 100, // Speed up for large graphs
  initialEnergyOnIncremental: 0.3,
};

export const GRID_LAYOUT = {
  name: "grid",
  fit: true,
  padding: 50,
  animate: true,
};

export const PRESET_LAYOUT = {
  name: "preset",
  fit: true,
  padding: 60,
  animate: true,
  animationDuration: 500,
};

export function layoutForGraph(graph) {
  if (!graph?.nodes?.length) return GRID_LAYOUT;

  const concepts = (graph?.nodes || []).filter((n) => n.type !== "pdf_cluster");
  const positioned = concepts.filter(
    (n) =>
      typeof n.position?.x === "number" &&
      typeof n.position?.y === "number"
  );
  
  const hasSaved = Boolean(graph?.layoutComputed) || (graph?.hasPositions && positioned.length > 0);

  // If we have a very small number of nodes and no connections, grid is safer
  if (graph.nodes.length < 3 && (!graph.edges || graph.edges.length === 0)) {
    return GRID_LAYOUT;
  }

  return hasSaved ? PRESET_LAYOUT : FCOS_LAYOUT;
}

/** Premium node sizing with better label wrapping */
export function applyHubNodeSizes(cy) {
  if (!cy || cy.destroyed?.()) return;
  let maxDeg = 1;
  cy.nodes(":childless").forEach((n) => {
    maxDeg = Math.max(maxDeg, n.degree(false));
  });
  
  cy.nodes(":childless").forEach((node) => {
    const deg = node.degree(false);
    const isTopic = node.hasClass("topic");
    const size = isTopic
      ? Math.round(85 + (deg / maxDeg) * 15)
      : Math.round(60 + (deg / maxDeg) * 20);
    
    node.style("width", size);
    node.style("height", size);
    node.style("font-size", isTopic ? 12 : 10);
    node.style("text-max-width", size * 1.2);
  });
}

export const GRAPH_STYLESHEET = [
  {
    selector: "node",
    style: {
      shape: "ellipse",
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      "font-family": "Inter, system-ui, sans-serif",
      "font-weight": 600,
      color: TEXT_COLOR,
      "text-wrap": "wrap",
      "text-max-width": 80,
      width: 60,
      height: 60,
      "background-color": "data(color)",
      "border-width": 2,
      "border-color": BORDER_COLOR,
      "overlay-opacity": 0,
      "transition-property": "background-color, border-color, border-width, width, height",
      "transition-duration": "0.3s",
      "box-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    },
  },
  {
    selector: "node.topic",
    style: {
      "background-color": TOPIC_COLOR,
      color: "#ffffff",
      "border-color": "#1d4ed8",
      "font-weight": 700,
      "z-index": 10,
    },
  },
  {
    selector: "node.pdf-cluster",
    style: {
      shape: "round-rectangle",
      "background-color": PDF_CLUSTER_BG,
      "background-opacity": 0.4,
      "border-width": 1.5,
      "border-color": "#cbd5e1",
      "border-style": "dashed",
      label: "data(label)",
      "text-valign": "top",
      "text-halign": "center",
      "text-margin-y": -15,
      "font-size": 14,
      "font-weight": 700,
      color: "#64748b",
      "padding": 40,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 4,
      "border-color": TOPIC_COLOR,
    },
  },
  {
    selector: "node.highlight",
    style: {
      "border-width": 4,
      "border-color": TOPIC_COLOR,
      "z-index": 99,
    },
  },
  {
    selector: "node.dim",
    style: {
      opacity: 0.15,
    },
  },
  {
    selector: "node.dim-hidden",
    style: {
      display: "none",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "curve-style": "bezier",
      "line-color": "#cbd5e1",
      "target-arrow-color": "#cbd5e1",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      label: "data(label)",
      "font-size": 9,
      "font-family": "Inter, system-ui, sans-serif",
      "font-weight": 500,
      color: "#94a3b8",
      "text-rotation": "autorotate",
      "text-margin-y": -10,
      "text-background-opacity": 1,
      "text-background-color": "#ffffff",
      "text-background-padding": 2,
      "text-background-shape": "round-rectangle",
      "opacity": 0.6,
    },
  },
  {
    selector: "edge.intra-edge",
    style: {
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
    },
  },
  {
    selector: "edge.cross-edge",
    style: {
      "line-style": "dashed",
      "line-color": TOPIC_COLOR,
      "target-arrow-color": TOPIC_COLOR,
      "width": 2,
      "opacity": 0.8,
    },
  },
  {
    selector: "edge.hierarchy-edge",
    style: {
      display: "none", // Hide the "contains" edges visually but use them for layout
    },
  },
  {
    selector: "edge.highlight",
    style: {
      width: 3,
      opacity: 1,
      "line-color": TOPIC_COLOR,
      "target-arrow-color": TOPIC_COLOR,
    },
  },
  {
    selector: "edge.dim",
    style: {
      opacity: 0.05,
    },
  },
  {
    selector: "edge.dim-hidden",
    style: {
      display: "none",
    },
  },
];
