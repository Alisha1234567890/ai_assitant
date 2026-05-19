/** Convert API graph { nodes, edges } → Cytoscape elements */

export function toCytoscapeElements(graph) {
  if (!graph?.nodes?.length) return [];

  const nodes = graph.nodes.map((n) => ({
    data: {
      id: String(n.id),
      label: n.label || n.id,
      group: n.group || "related",
    },
  }));

  const edges = (graph.edges || []).map((e, i) => ({
    data: {
      id: `e${i}`,
      source: String(e.source),
      target: String(e.target),
      label: e.label || "",
    },
  }));

  return [...nodes, ...edges];
}

export const CYTOSCAPE_STYLE = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "10px",
      "font-family": "'Plus Jakarta Sans', system-ui, sans-serif",
      "font-weight": 600,
      color: "#18182e",
      "text-wrap": "wrap",
      "text-max-width": "72px",
      width: "mapData(label, 4, 24, 42, 72)",
      height: "mapData(label, 4, 24, 42, 72)",
      "background-color": "#1a6aff",
      "border-width": 2,
      "border-color": "#ffffff",
      "border-opacity": 0.9,
      "text-outline-width": 2,
      "text-outline-color": "#ffffff",
      "text-outline-opacity": 0.85,
      "overlay-padding": 6,
    },
  },
  {
    selector: 'node[group = "core"]',
    style: {
      width: 64,
      height: 64,
      "font-size": "11px",
      "font-weight": 700,
      "z-index": 10,
      "background-color": "#f06500",
    },
  },
  {
    selector: 'node[group = "context"]',
    style: { "background-color": "#8b7ec8" },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "rgba(240, 101, 0, 0.35)",
      "target-arrow-color": "rgba(240, 101, 0, 0.45)",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      label: "data(label)",
      "font-size": "8px",
      "font-family": "'Plus Jakarta Sans', system-ui, sans-serif",
      color: "#a0a0b8",
      "text-rotation": "autorotate",
      "text-margin-y": -8,
    },
  },
  {
    selector: ":selected",
    style: {
      "border-width": 3,
      "border-color": "#f5b800",
    },
  },
];

export const CYTOSCAPE_LAYOUT = {
  name: "cose",
  animate: false,
  animationDuration: 0,
  nodeRepulsion: 8000,
  idealEdgeLength: 72,
  edgeElasticity: 0.45,
  nestingFactor: 0.1,
  gravity: 0.25,
  numIter: 1000,
  padding: 24,
};
