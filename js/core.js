const WORLD_SIZE = 12000;
const WORLD_CENTER = WORLD_SIZE / 2;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.4;
const DEFAULT_CARD_WIDTH = 240;
const DEFAULT_CARD_HEIGHT = 130;
const DEFAULT_CARD_COLOR = "#ffffff";
const CARD_MIN_WIDTH = 140;
const CARD_MAX_WIDTH = 700;
const CARD_MIN_HEIGHT = 100;
const CARD_MAX_HEIGHT = 560;
const QUICK_CREATE_MIN_DRAG = 10;
const IMAGE_EXPORT_MARGIN = 80;
const IMAGE_EXPORT_SCALE = 2;
const IMAGE_EXPORT_MAX_PX = 8000;

const viewport = document.getElementById("viewport");
const world = document.getElementById("world");
const nodesLayer = document.getElementById("nodes-layer");
const edgesLayer = document.getElementById("edges-layer");
const addCardBtn = document.getElementById("add-card-btn");
const connectBtn = document.getElementById("connect-btn");
const cardColorMenu = document.getElementById("card-color-menu");
const cardColorPresets = document.getElementById("card-color-presets");
const textStyleMenu = document.getElementById("text-style-menu");
const edgeTypeSelect = document.getElementById("edge-type-select");
const exportDataBtn = document.getElementById("export-data-btn");
const importDataBtn = document.getElementById("import-data-btn");
const exportImageBtn = document.getElementById("export-image-btn");
const importFileInput = document.getElementById("import-file-input");
const flipEdgeBtn = document.getElementById("flip-edge-btn");
const deleteEdgeBtn = document.getElementById("delete-edge-btn");
const resetViewBtn = document.getElementById("reset-view-btn");
const statusPill = document.getElementById("status-pill");
const zoomPill = document.getElementById("zoom-pill");

const EDGE_TYPES = {
  solid: { dashed: false, directed: false },
  dashed: { dashed: true, directed: false },
  directed: { dashed: false, directed: true },
  "directed-dashed": { dashed: true, directed: true },
};
const DEFAULT_EDGE_TYPE = "directed";
const CARD_COLOR_PRESETS = [
  "#ffffff",
  "#fef3c7",
  "#fde68a",
  "#fee2e2",
  "#fecdd3",
  "#fce7f3",
  "#ede9fe",
  "#e0e7ff",
  "#dbeafe",
  "#cffafe",
  "#ccfbf1",
  "#dcfce7",
  "#d1fae5",
  "#f1f5f9",
  "#e5e7eb",
];

const state = {
  mode: "move",
  selectedNodeId: null,
  connectSourceId: null,
  selectedEdgeId: null,
  currentEdgeType: DEFAULT_EDGE_TYPE,
  quickCreate: {
    active: false,
    pointerId: null,
    sourceNodeId: null,
    startClientX: 0,
    startClientY: 0,
  },
  camera: { x: 0, y: 0, scale: 1 },
  isPanning: false,
  panPointerId: null,
  panStart: { x: 0, y: 0, camX: 0, camY: 0 },
  nextNodeId: 1,
  nextEdgeId: 1,
  nodes: new Map(),
  nodeElements: new Map(),
  nodeContentElements: new Map(),
  edges: new Map(),
  edgeElements: new Map(),
  edgeHitElements: new Map(),
  colorMenu: {
    open: false,
    nodeId: null,
  },
  textMenu: {
    open: false,
    nodeId: null,
  },
};

function createEdgeMarker(id, color) {
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", id);
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "7.5");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("markerUnits", "userSpaceOnUse");
  marker.setAttribute("orient", "auto");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
  path.setAttribute("fill", color);
  marker.appendChild(path);

  return marker;
}

const edgeDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
edgeDefs.appendChild(createEdgeMarker("edge-arrow", "#56708f"));
edgeDefs.appendChild(createEdgeMarker("edge-arrow-selected", "#dc2626"));
edgeDefs.appendChild(createEdgeMarker("edge-arrow-draft", "#0f766e"));

const draftEdge = document.createElementNS("http://www.w3.org/2000/svg", "line");
draftEdge.classList.add("edge-draft");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeCardDimension(value, min, max, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.round(clamp(next, min, max));
}

function normalizeCardColor(value, fallback = DEFAULT_CARD_COLOR) {
  if (typeof value !== "string") {
    return fallback;
  }
  const lowered = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(lowered)) {
    return lowered;
  }
  return fallback;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEdgeType(type) {
  return EDGE_TYPES[type] ? type : DEFAULT_EDGE_TYPE;
}

function isDirectedType(type) {
  return EDGE_TYPES[getEdgeType(type)].directed;
}

function isDashedType(type) {
  return EDGE_TYPES[getEdgeType(type)].dashed;
}

function applyEdgeTypeToLine(line, edgeType, isSelected) {
  const normalizedType = getEdgeType(edgeType);
  const dashed = isDashedType(normalizedType);
  const directed = isDirectedType(normalizedType);

  line.classList.toggle("selected", isSelected);
  line.classList.toggle("is-dashed", dashed);

  if (!directed) {
    line.removeAttribute("marker-end");
    return;
  }

  const markerId = isSelected ? "edge-arrow-selected" : "edge-arrow";
  line.setAttribute("marker-end", `url(#${markerId})`);
}

function refreshEdgeAppearance(edgeId) {
  const edge = state.edges.get(edgeId);
  const line = state.edgeElements.get(edgeId);
  if (!edge || !line) {
    return;
  }
  applyEdgeTypeToLine(line, edge.type, state.selectedEdgeId === edgeId);
}

