/** Knowledge Map — Premium Light Theme with Compound Nodes */

const VIBRANT_COLORS = [
  "#FF6B35", // Bright Orange
  "#8B5CF6", // Vibrant Purple
  "#3B82F6", // Bright Blue
  "#EC4899", // Hot Pink
  "#10B981", // Teal Green
  "#F59E0B", // Amber Orange
  "#06B6D4", // Cyan
  "#EF4444", // Bright Red
  "#84CC16", // Lime Green
];
const TOPIC_COLOR = "#FF5722"; // Bold Orange
const BORDER_COLOR = "#000000"; // Black for high contrast
const TEXT_COLOR = "#FFFFFF"; // White text
const PDF_CLUSTER_BG = "rgba(255, 240, 230, 0.8)"; // Light Orange Cluster


export function nodeDisplayColor(node, index = 0) {
  if (node.type === "topic") return TOPIC_COLOR;
  if (node.type === "pdf_cluster") return PDF_CLUSTER_BG;
  if (node.color) return node.color; // Use backend color if available
  return VIBRANT_COLORS[index % VIBRANT_COLORS.length];
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
        chunkText: n.chunkText || "",
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
      "font-weight": 700,
      color: "#000000", // All node text is black now
      "text-wrap": "wrap",
      "text-max-width": 100,
      width: 70,
      height: 70,
      "background-color": "data(color)",
      "border-width": 3,
      "border-color": BORDER_COLOR,
      "overlay-opacity": 0,
      "transition-property": "background-color, border-color, border-width, width, height",
      "transition-duration": "0.3s",
      "box-shadow": "0 8px 12px -2px rgb(0 0 0 / 0.25)",
    },
  },
  {
    selector: "node.topic",
    style: {
      "background-color": TOPIC_COLOR,
      color: "#000000", // Topic node text is black too
      "border-color": "#000000",
      "border-width": 4,
      "font-weight": 800,
      "z-index": 10,
      width: 85,
      height: 85,
    },
  },
  {
    selector: "node.pdf-cluster",
    style: {
      shape: "round-rectangle",
      "background-color": PDF_CLUSTER_BG,
      "background-opacity": 0.7,
      "border-width": 2.5,
      "border-color": "#FF8A65",
      "border-style": "solid",
      label: "data(label)",
      "text-valign": "top",
      "text-halign": "center",
      "text-margin-y": -18,
      "font-size": 15,
      "font-weight": 800,
      color: "#374151",
      "padding": 50,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 5,
      "border-color": "#FFD700",
    },
  },
  {
    selector: "node.highlight",
    style: {
      "border-width": 5,
      "border-color": "#FFD700",
      "z-index": 99,
    },
  },
  {
    selector: "node.search-highlight",
    style: {
      "border-width": 6,
      "border-color": "#FFD700",
      "z-index": 100,
    },
  },
  {
    selector: "edge.search-highlight",
    style: {
      "line-color": "#FFD700",
      "target-arrow-color": "#FFD700",
      width: 4,
      opacity: 1,
      "z-index": 100,
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
      width: 2.5,
      "curve-style": "bezier",
      "line-color": "#000000",
      "target-arrow-color": "#000000",
      "target-arrow-shape": "triangle",
      "arrow-scale": 1.2,
      label: "data(label)",
      "font-size": 10,
      "font-family": "Inter, system-ui, sans-serif",
      "font-weight": 600,
      color: "#000000",
      "text-rotation": "autorotate",
      "text-margin-y": -10,
      "text-background-opacity": 1,
      "text-background-color": "#F9FAFB",
      "text-background-padding": 3,
      "text-background-shape": "round-rectangle",
      "opacity": 0.9,
    },
  },
  {
    selector: "edge.intra-edge",
    style: {
      "line-color": "#000000",
      "target-arrow-color": "#000000",
    },
  },
  {
    selector: "edge.cross-edge",
    style: {
      "line-style": "dashed",
      "line-color": TOPIC_COLOR,
      "target-arrow-color": TOPIC_COLOR,
      "width": 3,
      "opacity": 1,
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
      width: 4,
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
