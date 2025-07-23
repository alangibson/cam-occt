import { w as writable } from "./index2.js";
const stages = [
  { id: "import", name: "Import", description: "Import 2D drawing from file, cloud or AI" },
  { id: "modify", name: "Modify", description: "Modify drawing if needed" },
  { id: "program", name: "Program", description: "Configure and apply cutting operations" },
  { id: "export", name: "Export", description: "Render and export G-code" }
];
const currentStage = writable("import");
const project = writable({
  name: "Untitled Project",
  currentStage: "import",
  cutPaths: []
});
const applicationSettings = writable({
  units: "mm"
  // Default to millimeters
});
const viewerZoomLevel = writable(1);
const hoveredShapeInfo = writable(null);
const selectedShapeInfo = writable(null);
const drawingDimensions = writable(null);
const drawingLayers = writable([]);
export {
  drawingLayers as a,
  selectedShapeInfo as b,
  currentStage as c,
  drawingDimensions as d,
  applicationSettings as e,
  hoveredShapeInfo as h,
  project as p,
  stages as s,
  viewerZoomLevel as v
};
