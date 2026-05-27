import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";

let registered = false;

export function registerCytoscapeExtensions() {
  if (registered) return;
  cytoscape.use(fcose);
  registered = true;
}

export { cytoscape };
