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

function setMode(mode) {
  state.mode = mode;
  if (mode !== "connect") {
    clearConnectSource();
  }

  addCardBtn.classList.toggle("active", mode === "add");
  connectBtn.classList.toggle("active", mode === "connect");

  if (mode === "add") {
    statusPill.textContent = "Modus: Karte platzieren";
  } else if (mode === "connect") {
    statusPill.textContent = "Modus: Verknüpfen";
  } else {
    statusPill.textContent = "Modus: Bewegen";
  }
}

function setZoomLabel() {
  zoomPill.textContent = `${Math.round(state.camera.scale * 100)}%`;
}

function applyNodeAppearance(nodeId) {
  const node = state.nodes.get(nodeId);
  const card = state.nodeElements.get(nodeId);
  if (!node || !card) {
    return;
  }
  card.style.width = `${node.width}px`;
  card.style.height = `${node.height}px`;
  card.style.backgroundColor = node.color;
  updateEdgePositionsForNode(nodeId);
  if (state.textMenu.open && state.textMenu.nodeId === nodeId) {
    positionTextStyleMenu(nodeId);
  }
}

function renderCardColorPresets() {
  if (!cardColorPresets) {
    return;
  }
  cardColorPresets.innerHTML = "";
  for (const color of CARD_COLOR_PRESETS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "card-color-swatch";
    swatch.title = color;
    swatch.dataset.color = color;
    swatch.style.backgroundColor = color;
    cardColorPresets.appendChild(swatch);
  }
}

function syncCardColorMenuSelection(nodeId) {
  if (!cardColorPresets) {
    return;
  }
  const node = nodeId ? state.nodes.get(nodeId) : null;
  const color = node ? normalizeCardColor(node.color) : "";
  const swatches = cardColorPresets.querySelectorAll(".card-color-swatch");
  for (const swatch of swatches) {
    swatch.classList.toggle("active", swatch.dataset.color === color);
  }
}

function hideCardColorMenu() {
  if (!cardColorMenu || !state.colorMenu.open) {
    state.colorMenu.open = false;
    state.colorMenu.nodeId = null;
    return;
  }
  cardColorMenu.hidden = true;
  state.colorMenu.open = false;
  state.colorMenu.nodeId = null;
}

function showCardColorMenu(nodeId, clientX, clientY) {
  if (!cardColorMenu || !state.nodes.has(nodeId)) {
    return;
  }
  const viewRect = viewport.getBoundingClientRect();
  const menuPadding = 10;
  const relX = clientX - viewRect.left;
  const relY = clientY - viewRect.top;

  cardColorMenu.hidden = false;
  cardColorMenu.style.left = "0px";
  cardColorMenu.style.top = "0px";

  const menuWidth = cardColorMenu.offsetWidth;
  const menuHeight = cardColorMenu.offsetHeight;
  const maxX = viewRect.width - menuWidth - menuPadding;
  const maxY = viewRect.height - menuHeight - menuPadding;

  const nextX = clamp(relX + 8, menuPadding, Math.max(menuPadding, maxX));
  const nextY = clamp(relY + 8, menuPadding, Math.max(menuPadding, maxY));

  cardColorMenu.style.left = `${nextX}px`;
  cardColorMenu.style.top = `${nextY}px`;
  state.colorMenu.open = true;
  state.colorMenu.nodeId = nodeId;
  syncCardColorMenuSelection(nodeId);
}

function setNodeColor(nodeId, color) {
  const node = state.nodes.get(nodeId);
  if (!node) {
    return;
  }
  node.color = normalizeCardColor(color, node.color);
  applyNodeAppearance(nodeId);
  syncCardColorMenuSelection(nodeId);
}

function getEditingNodeId() {
  const active = document.activeElement;
  if (!active || !active.classList || !active.classList.contains("node-content")) {
    return null;
  }
  const card = active.closest(".node-card");
  return card?.dataset.nodeId || null;
}

function updateTextStyleButtonStates() {
  if (!textStyleMenu) {
    return;
  }
  const editingNodeId = getEditingNodeId() || state.textMenu.nodeId;
  const content = editingNodeId ? state.nodeContentElements.get(editingNodeId) : null;
  const computedAlign = content ? window.getComputedStyle(content).textAlign : "";

  const buttons = textStyleMenu.querySelectorAll(".text-style-btn");
  for (const button of buttons) {
    const cmd = button.dataset.cmd;
    if (!cmd) {
      continue;
    }
    let isActive = false;
    try {
      isActive = document.queryCommandState(cmd);
    } catch {
      isActive = false;
    }

    if (!isActive && (cmd === "justifyLeft" || cmd === "justifyCenter" || cmd === "justifyRight")) {
      if (cmd === "justifyLeft" && (computedAlign === "left" || computedAlign === "start")) {
        isActive = true;
      } else if (cmd === "justifyCenter" && computedAlign === "center") {
        isActive = true;
      } else if (cmd === "justifyRight" && (computedAlign === "right" || computedAlign === "end")) {
        isActive = true;
      }
    }

    button.classList.toggle("active", !!isActive);
  }
}

function hideTextStyleMenu() {
  if (!textStyleMenu || !state.textMenu.open) {
    state.textMenu.open = false;
    state.textMenu.nodeId = null;
    return;
  }
  textStyleMenu.hidden = true;
  state.textMenu.open = false;
  state.textMenu.nodeId = null;
}

function positionTextStyleMenu(nodeId) {
  if (!textStyleMenu || !state.nodes.has(nodeId)) {
    hideTextStyleMenu();
    return;
  }

  const cardEl = state.nodeElements.get(nodeId);
  if (!cardEl) {
    hideTextStyleMenu();
    return;
  }

  const viewRect = viewport.getBoundingClientRect();
  const cardRect = cardEl.getBoundingClientRect();
  const padding = 8;

  textStyleMenu.hidden = false;
  textStyleMenu.style.left = "0px";
  textStyleMenu.style.top = "0px";

  const menuWidth = textStyleMenu.offsetWidth;
  const menuHeight = textStyleMenu.offsetHeight;
  const maxX = viewRect.width - menuWidth - padding;
  const maxY = viewRect.height - menuHeight - padding;

  let x = cardRect.left - viewRect.left + (cardRect.width - menuWidth) / 2;
  let y = cardRect.top - viewRect.top - menuHeight - 8;

  if (y < padding) {
    y = cardRect.bottom - viewRect.top + 8;
  }

  x = clamp(x, padding, Math.max(padding, maxX));
  y = clamp(y, padding, Math.max(padding, maxY));

  textStyleMenu.style.left = `${x}px`;
  textStyleMenu.style.top = `${y}px`;
}

function showTextStyleMenu(nodeId) {
  if (!textStyleMenu || !state.nodes.has(nodeId)) {
    return;
  }
  state.textMenu.open = true;
  state.textMenu.nodeId = nodeId;
  positionTextStyleMenu(nodeId);
  updateTextStyleButtonStates();
}

function clearSelectedNode() {
  if (!state.selectedNodeId) {
    hideCardColorMenu();
    hideTextStyleMenu();
    return;
  }
  const selectedCard = state.nodeElements.get(state.selectedNodeId);
  if (selectedCard) {
    selectedCard.classList.remove("selected");
  }
  hideCardColorMenu();
  hideTextStyleMenu();
  state.selectedNodeId = null;
}

function selectNode(nodeId) {
  if (!state.nodes.has(nodeId)) {
    return;
  }
  if (state.selectedNodeId === nodeId) {
    return;
  }

  const prevNodeId = state.selectedNodeId;
  if (prevNodeId) {
    const prevEl = state.nodeElements.get(prevNodeId);
    if (prevEl) {
      prevEl.classList.remove("selected");
    }
  }

  state.selectedNodeId = nodeId;
  const nextEl = state.nodeElements.get(nodeId);
  if (nextEl) {
    nextEl.classList.add("selected");
  }

  if (state.selectedEdgeId) {
    clearSelectedEdge();
  }
  hideCardColorMenu();
  if (state.textMenu.open && state.textMenu.nodeId !== nodeId) {
    hideTextStyleMenu();
  }
}

function syncDeleteEdgeButton() {
  deleteEdgeBtn.disabled = !state.selectedEdgeId;
}

function syncEdgeTypeSelect() {
  if (!edgeTypeSelect) {
    return;
  }
  if (state.selectedEdgeId) {
    const edge = state.edges.get(state.selectedEdgeId);
    if (edge) {
      edgeTypeSelect.value = getEdgeType(edge.type);
      return;
    }
  }
  edgeTypeSelect.value = getEdgeType(state.currentEdgeType);
}

function setEdgeType(edgeId, edgeType) {
  const edge = state.edges.get(edgeId);
  if (!edge) {
    return;
  }
  edge.type = getEdgeType(edgeType);
  refreshEdgeAppearance(edgeId);
}

function clearSelectedEdge() {
  if (!state.selectedEdgeId) {
    syncDeleteEdgeButton();
    syncEdgeTypeSelect();
    return;
  }
  const prevSelectedId = state.selectedEdgeId;
  state.selectedEdgeId = null;
  refreshEdgeAppearance(prevSelectedId);
  syncDeleteEdgeButton();
  syncEdgeTypeSelect();
}

function selectEdge(edgeId) {
  if (!state.edgeElements.has(edgeId) || !state.edges.has(edgeId)) {
    return;
  }
  if (state.selectedEdgeId === edgeId) {
    syncDeleteEdgeButton();
    syncEdgeTypeSelect();
    return;
  }
  if (state.selectedNodeId) {
    clearSelectedNode();
  }
  const prevSelectedId = state.selectedEdgeId;
  clearSelectedEdge();
  state.selectedEdgeId = edgeId;
  if (prevSelectedId) {
    refreshEdgeAppearance(prevSelectedId);
  }
  refreshEdgeAppearance(edgeId);
  const edge = state.edges.get(edgeId);
  if (edge) {
    state.currentEdgeType = getEdgeType(edge.type);
  }
  syncDeleteEdgeButton();
  syncEdgeTypeSelect();
}

function applyCamera() {
  const { x, y, scale } = state.camera;
  world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  setZoomLabel();
  if (state.textMenu.open && state.textMenu.nodeId) {
    positionTextStyleMenu(state.textMenu.nodeId);
  }
}

function centerView() {
  const rect = viewport.getBoundingClientRect();
  state.camera.scale = 1;
  state.camera.x = rect.width / 2 - WORLD_CENTER;
  state.camera.y = rect.height / 2 - WORLD_CENTER;
  applyCamera();
}

function screenToWorld(clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - state.camera.x) / state.camera.scale,
    y: (sy - state.camera.y) / state.camera.scale,
  };
}

function getDropCardPosition(worldX, worldY) {
  const maxX = WORLD_SIZE - DEFAULT_CARD_WIDTH;
  const maxY = WORLD_SIZE - DEFAULT_CARD_HEIGHT;
  return {
    x: clamp(worldX - DEFAULT_CARD_WIDTH / 2, 0, maxX),
    y: clamp(worldY - DEFAULT_CARD_HEIGHT / 2, 0, maxY),
  };
}

function makeNodeId() {
  const id = `N${String(state.nextNodeId).padStart(3, "0")}`;
  state.nextNodeId += 1;
  return id;
}

function makeEdgeId() {
  const id = `E${String(state.nextEdgeId).padStart(3, "0")}`;
  state.nextEdgeId += 1;
  return id;
}

function updateIdCounterFromId(id, prefix) {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const match = id.match(pattern);
  if (!match) {
    return;
  }
  const numeric = Number.parseInt(match[1], 10);
  if (!Number.isFinite(numeric)) {
    return;
  }
  if (prefix === "N") {
    state.nextNodeId = Math.max(state.nextNodeId, numeric + 1);
    return;
  }
  if (prefix === "E") {
    state.nextEdgeId = Math.max(state.nextEdgeId, numeric + 1);
  }
}

function reserveNodeId(preferredId) {
  if (typeof preferredId !== "string" || preferredId.trim() === "") {
    return makeNodeId();
  }
  const candidate = preferredId.trim();
  if (state.nodes.has(candidate)) {
    return makeNodeId();
  }
  updateIdCounterFromId(candidate, "N");
  return candidate;
}

function reserveEdgeId(preferredId) {
  if (typeof preferredId !== "string" || preferredId.trim() === "") {
    return makeEdgeId();
  }
  const candidate = preferredId.trim();
  if (state.edges.has(candidate)) {
    return makeEdgeId();
  }
  updateIdCounterFromId(candidate, "E");
  return candidate;
}

function createCard(x, y, options = {}) {
  const width = sanitizeCardDimension(
    options.width ?? DEFAULT_CARD_WIDTH,
    CARD_MIN_WIDTH,
    CARD_MAX_WIDTH,
    DEFAULT_CARD_WIDTH
  );
  const height = sanitizeCardDimension(
    options.height ?? DEFAULT_CARD_HEIGHT,
    CARD_MIN_HEIGHT,
    CARD_MAX_HEIGHT,
    DEFAULT_CARD_HEIGHT
  );
  const color = normalizeCardColor(options.color ?? DEFAULT_CARD_COLOR);
  const initialHtml = typeof options.html === "string" ? options.html : "";

  const id = reserveNodeId(options.id);
  const node = { id, x, y, text: "", html: initialHtml, width, height, color };
  state.nodes.set(id, node);

  const card = document.createElement("article");
  card.className = "node-card";
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  card.dataset.nodeId = id;

  const actions = document.createElement("div");
  actions.className = "node-actions";

  const quickAddBtn = document.createElement("button");
  quickAddBtn.className = "node-action-btn quick-add-btn";
  quickAddBtn.type = "button";
  quickAddBtn.title = "Neue verbundene Karte ziehen";
  quickAddBtn.textContent = "+";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "node-action-btn delete-btn";
  deleteBtn.type = "button";
  deleteBtn.title = "Karte löschen";
  deleteBtn.textContent = "x";

  actions.append(quickAddBtn, deleteBtn);

  const content = document.createElement("div");
  content.className = "node-content";
  content.setAttribute("contenteditable", "true");
  content.spellcheck = false;
  if (initialHtml) {
    content.innerHTML = initialHtml;
    node.text = content.textContent || "";
    node.html = content.innerHTML;
  }

  const resizeHandle = document.createElement("button");
  resizeHandle.className = "resize-handle";
  resizeHandle.type = "button";
  resizeHandle.title = "Größe ziehen";

  card.append(actions, content, resizeHandle);
  nodesLayer.appendChild(card);
  state.nodeElements.set(id, card);
  state.nodeContentElements.set(id, content);
  applyNodeAppearance(id);

  card.addEventListener("pointerdown", (event) => {
    const onAction = !!event.target.closest(".node-action-btn");
    const onResize = !!event.target.closest(".resize-handle");
    if (event.button === 0 && !onAction && !onResize) {
      selectNode(id);
    }

    if (
      state.mode === "connect" &&
      event.button === 0 &&
      !onAction &&
      !onResize
    ) {
      event.preventDefault();
      handleConnectClick(id);
      return;
    }

    if (event.button !== 0 || onAction || onResize) {
      return;
    }

    const pointerId = event.pointerId;
    const startWorld = screenToWorld(event.clientX, event.clientY);
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startX = node.x;
    const startY = node.y;
    let isDragging = false;

    card.setPointerCapture(pointerId);

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      if (!isDragging) {
        const dragDistance = Math.hypot(
          moveEvent.clientX - startClientX,
          moveEvent.clientY - startClientY
        );
        if (dragDistance < 5) {
          return;
        }
        isDragging = true;
        card.classList.add("dragging");
        if (document.activeElement === content) {
          content.blur();
        }
      }

      moveEvent.preventDefault();
      const nowWorld = screenToWorld(moveEvent.clientX, moveEvent.clientY);
      const dx = nowWorld.x - startWorld.x;
      const dy = nowWorld.y - startWorld.y;
      node.x = startX + dx;
      node.y = startY + dy;
      card.style.left = `${node.x}px`;
      card.style.top = `${node.y}px`;
      updateEdgePositionsForNode(id);
    };

    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      card.releasePointerCapture(pointerId);
      card.classList.remove("dragging");
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      card.removeEventListener("pointercancel", onUp);
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);
  });

  card.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".resize-handle") || event.target.closest(".node-action-btn")) {
      return;
    }
    event.preventDefault();
    selectNode(id);
    hideTextStyleMenu();
    showCardColorMenu(id, event.clientX, event.clientY);
  });

  content.addEventListener("input", () => {
    node.text = content.textContent || "";
    node.html = content.innerHTML;
    updateEdgePositionsForNode(id);
    if (state.textMenu.open && state.textMenu.nodeId === id) {
      updateTextStyleButtonStates();
      positionTextStyleMenu(id);
    }
  });

  content.addEventListener("focus", () => {
    selectNode(id);
    showTextStyleMenu(id);
  });

  content.addEventListener("blur", () => {
    window.setTimeout(() => {
      const editingNodeId = getEditingNodeId();
      if (editingNodeId !== id) {
        hideTextStyleMenu();
      }
    }, 0);
  });

  content.addEventListener("keyup", () => {
    if (state.textMenu.open && state.textMenu.nodeId === id) {
      updateTextStyleButtonStates();
      positionTextStyleMenu(id);
    }
  });

  content.addEventListener("mouseup", () => {
    if (state.textMenu.open && state.textMenu.nodeId === id) {
      updateTextStyleButtonStates();
    }
  });

  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    removeNode(id);
  });

  quickAddBtn.addEventListener("pointerdown", (event) => {
    startQuickCreateDrag(event, id, quickAddBtn);
  });

  resizeHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectNode(id);
    hideCardColorMenu();

    const pointerId = event.pointerId;
    const start = screenToWorld(event.clientX, event.clientY);
    const startWidth = node.width;
    const startHeight = node.height;
    resizeHandle.setPointerCapture(pointerId);

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      const now = screenToWorld(moveEvent.clientX, moveEvent.clientY);
      const dx = now.x - start.x;
      const dy = now.y - start.y;
      node.width = sanitizeCardDimension(startWidth + dx, CARD_MIN_WIDTH, CARD_MAX_WIDTH, startWidth);
      node.height = sanitizeCardDimension(startHeight + dy, CARD_MIN_HEIGHT, CARD_MAX_HEIGHT, startHeight);
      applyNodeAppearance(id);
    };

    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      resizeHandle.releasePointerCapture(pointerId);
      resizeHandle.removeEventListener("pointermove", onMove);
      resizeHandle.removeEventListener("pointerup", onUp);
      resizeHandle.removeEventListener("pointercancel", onUp);
    };

    resizeHandle.addEventListener("pointermove", onMove);
    resizeHandle.addEventListener("pointerup", onUp);
    resizeHandle.addEventListener("pointercancel", onUp);
  });

  updateAllEdges();
  return id;
}

function removeNode(nodeId) {
  const el = state.nodeElements.get(nodeId);
  if (el) {
    el.remove();
  }
  state.nodeElements.delete(nodeId);
  state.nodeContentElements.delete(nodeId);
  state.nodes.delete(nodeId);
  if (state.selectedNodeId === nodeId) {
    state.selectedNodeId = null;
    hideCardColorMenu();
    hideTextStyleMenu();
  }
  if (state.textMenu.nodeId === nodeId) {
    hideTextStyleMenu();
  }
  if (state.connectSourceId === nodeId) {
    clearConnectSource();
  }

  for (const [edgeId, edge] of state.edges.entries()) {
    if (edge.from === nodeId || edge.to === nodeId) {
      removeEdge(edgeId);
    }
  }
}

function removeEdge(edgeId) {
  if (state.selectedEdgeId === edgeId) {
    state.selectedEdgeId = null;
  }
  const line = state.edgeElements.get(edgeId);
  const hitLine = state.edgeHitElements.get(edgeId);
  if (line) {
    line.remove();
  }
  if (hitLine) {
    hitLine.remove();
  }
  state.edgeElements.delete(edgeId);
  state.edgeHitElements.delete(edgeId);
  state.edges.delete(edgeId);
  syncDeleteEdgeButton();
  syncEdgeTypeSelect();
}

function edgeExists(from, to, edgeType = state.currentEdgeType) {
  const newDirected = isDirectedType(edgeType);
  for (const edge of state.edges.values()) {
    const sameDirection = edge.from === from && edge.to === to;
    const reverseDirection = edge.from === to && edge.to === from;
    const existingDirected = isDirectedType(edge.type);

    if (!newDirected) {
      if (sameDirection || reverseDirection) {
        return true;
      }
      continue;
    }

    if (!existingDirected && (sameDirection || reverseDirection)) {
      return true;
    }

    if (existingDirected && sameDirection) {
      return true;
    }
  }
  return false;
}

function createEdge(fromId, toId, edgeType = state.currentEdgeType, options = {}) {
  const normalizedType = getEdgeType(edgeType);
  const force = !!options.force;
  if (!state.nodes.has(fromId) || !state.nodes.has(toId)) {
    return;
  }
  if (!force && (fromId === toId || edgeExists(fromId, toId, normalizedType))) {
    return;
  }

  const edgeId = reserveEdgeId(options.id);
  if (state.edges.has(edgeId)) {
    return;
  }
  const edge = { id: edgeId, from: fromId, to: toId, type: normalizedType };
  state.edges.set(edgeId, edge);

  const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hitLine.classList.add("edge-hitbox");
  hitLine.dataset.edgeId = edgeId;
  hitLine.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectEdge(edgeId);
  });

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("edge-line");
  line.dataset.edgeId = edgeId;
  edgesLayer.appendChild(hitLine);
  edgesLayer.appendChild(line);
  state.edgeElements.set(edgeId, line);
  state.edgeHitElements.set(edgeId, hitLine);

  refreshEdgeAppearance(edgeId);
  updateEdgePosition(edge);
  return edgeId;
}

function getCardRect(nodeId) {
  const node = state.nodes.get(nodeId);
  const el = state.nodeElements.get(nodeId);
  if (!node || !el) {
    return null;
  }
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const cx = node.x + width / 2;
  const cy = node.y + height / 2;
  return {
    left: node.x,
    top: node.y,
    width,
    height,
    cx,
    cy,
  };
}

function getCardCenter(nodeId) {
  const rect = getCardRect(nodeId);
  if (!rect) {
    return null;
  }
  return { x: rect.cx, y: rect.cy };
}

function getCardBoundaryPoint(rect, towardPoint) {
  const dx = towardPoint.x - rect.cx;
  const dy = towardPoint.y - rect.cy;
  if (dx === 0 && dy === 0) {
    return { x: rect.cx, y: rect.cy };
  }

  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);

  return {
    x: rect.cx + dx * scale,
    y: rect.cy + dy * scale,
  };
}

function getEdgeEndpoints(edge) {
  const fromRect = getCardRect(edge.from);
  const toRect = getCardRect(edge.to);
  if (!fromRect || !toRect) {
    return null;
  }

  const fromCenter = { x: fromRect.cx, y: fromRect.cy };
  const toCenter = { x: toRect.cx, y: toRect.cy };
  const a = getCardBoundaryPoint(fromRect, toCenter);
  const b = getCardBoundaryPoint(toRect, fromCenter);
  return { a, b };
}

function updateEdgePosition(edge) {
  const line = state.edgeElements.get(edge.id);
  const hitLine = state.edgeHitElements.get(edge.id);
  if (!line) {
    return;
  }

  const points = getEdgeEndpoints(edge);
  if (!points) {
    return;
  }
  const { a, b } = points;

  line.setAttribute("x1", String(a.x));
  line.setAttribute("y1", String(a.y));
  line.setAttribute("x2", String(b.x));
  line.setAttribute("y2", String(b.y));

  if (hitLine) {
    hitLine.setAttribute("x1", String(a.x));
    hitLine.setAttribute("y1", String(a.y));
    hitLine.setAttribute("x2", String(b.x));
    hitLine.setAttribute("y2", String(b.y));
  }
}

function updateAllEdges() {
  for (const edge of state.edges.values()) {
    updateEdgePosition(edge);
  }
}

function updateEdgePositionsForNode(nodeId) {
  for (const edge of state.edges.values()) {
    if (edge.from === nodeId || edge.to === nodeId) {
      updateEdgePosition(edge);
    }
  }
}

function clearBoard() {
  hideCardColorMenu();
  hideTextStyleMenu();
  clearConnectSource();
  clearSelectedEdge();
  clearSelectedNode();

  for (const line of state.edgeElements.values()) {
    line.remove();
  }
  for (const hitLine of state.edgeHitElements.values()) {
    hitLine.remove();
  }
  for (const nodeEl of state.nodeElements.values()) {
    nodeEl.remove();
  }

  state.edges.clear();
  state.edgeElements.clear();
  state.edgeHitElements.clear();
  state.nodes.clear();
  state.nodeElements.clear();
  state.nodeContentElements.clear();

  state.nextNodeId = 1;
  state.nextEdgeId = 1;
}

function buildSnapshot() {
  const nodes = [];
  for (const [nodeId, node] of state.nodes.entries()) {
    const contentEl = state.nodeContentElements.get(nodeId);
    const html = contentEl ? contentEl.innerHTML : node.html || "";
    const text = contentEl ? contentEl.textContent || "" : node.text || "";
    nodes.push({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      color: normalizeCardColor(node.color),
      text,
      html,
    });
  }

  const edges = [];
  for (const edge of state.edges.values()) {
    edges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type: getEdgeType(edge.type),
    });
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    camera: {
      x: state.camera.x,
      y: state.camera.y,
      scale: state.camera.scale,
    },
    settings: {
      currentEdgeType: getEdgeType(state.currentEdgeType),
    },
    nodes,
    edges,
  };
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function getFileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function importSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Die Datei enthält keine gültigen Daten.");
  }
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
    throw new Error("Es fehlen Knoten- oder Verbindungsdaten.");
  }

  clearBoard();

  for (const rawNode of snapshot.nodes) {
    if (!rawNode || typeof rawNode !== "object") {
      continue;
    }
    const x = Number.isFinite(rawNode.x) ? rawNode.x : WORLD_CENTER - DEFAULT_CARD_WIDTH / 2;
    const y = Number.isFinite(rawNode.y) ? rawNode.y : WORLD_CENTER - DEFAULT_CARD_HEIGHT / 2;
    const html =
      typeof rawNode.html === "string"
        ? rawNode.html
        : typeof rawNode.text === "string"
          ? escapeHtml(rawNode.text).replaceAll("\n", "<br>")
          : "";
    createCard(x, y, {
      id: typeof rawNode.id === "string" ? rawNode.id : undefined,
      width: rawNode.width,
      height: rawNode.height,
      color: rawNode.color,
      html,
    });
  }

  for (const rawEdge of snapshot.edges) {
    if (!rawEdge || typeof rawEdge !== "object") {
      continue;
    }
    if (typeof rawEdge.from !== "string" || typeof rawEdge.to !== "string") {
      continue;
    }
    createEdge(rawEdge.from, rawEdge.to, rawEdge.type, {
      id: typeof rawEdge.id === "string" ? rawEdge.id : undefined,
      force: true,
    });
  }

  if (snapshot.camera && typeof snapshot.camera === "object") {
    const nextScale = clamp(
      Number.isFinite(snapshot.camera.scale) ? snapshot.camera.scale : 1,
      MIN_SCALE,
      MAX_SCALE
    );
    state.camera.scale = nextScale;
    state.camera.x = Number.isFinite(snapshot.camera.x) ? snapshot.camera.x : state.camera.x;
    state.camera.y = Number.isFinite(snapshot.camera.y) ? snapshot.camera.y : state.camera.y;
  }

  if (snapshot.settings && typeof snapshot.settings === "object") {
    state.currentEdgeType = getEdgeType(snapshot.settings.currentEdgeType);
  } else {
    state.currentEdgeType = DEFAULT_EDGE_TYPE;
  }

  setMode("move");
  applyCamera();
  updateAllEdges();
  syncEdgeTypeSelect();
  syncDraftEdgeStyle();
}

function getExportBounds() {
  if (state.nodes.size === 0) {
    const rect = viewport.getBoundingClientRect();
    const minX = (-state.camera.x) / state.camera.scale;
    const minY = (-state.camera.y) / state.camera.scale;
    const width = rect.width / state.camera.scale;
    const height = rect.height / state.camera.scale;
    return {
      minX,
      minY,
      maxX: minX + width,
      maxY: minY + height,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of state.nodes.values()) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return { minX, minY, maxX, maxY };
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArrowHead(ctx, x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = 9;
  const width = 5;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - Math.cos(angle) * length + Math.sin(angle) * width,
    y2 - Math.sin(angle) * length - Math.cos(angle) * width
  );
  ctx.lineTo(
    x2 - Math.cos(angle) * length - Math.sin(angle) * width,
    y2 - Math.sin(angle) * length + Math.cos(angle) * width
  );
  ctx.closePath();
  ctx.fill();
}

function drawWrappedText(ctx, text, x, y, maxWidth, maxHeight, align) {
  const paragraphs = String(text || "").replace(/\r/g, "").split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = words.shift() || "";
    for (const word of words) {
      const candidate = `${line} ${word}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }

  const lineHeight = 20;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const visibleLines = lines.slice(0, maxLines);

  const alignMode =
    align === "left" || align === "start"
      ? "left"
      : align === "right" || align === "end"
        ? "right"
        : "center";
  ctx.textAlign = alignMode;
  ctx.textBaseline = "top";

  let drawX = x + maxWidth / 2;
  if (alignMode === "left") {
    drawX = x;
  } else if (alignMode === "right") {
    drawX = x + maxWidth;
  }

  visibleLines.forEach((line, index) => {
    ctx.fillText(line, drawX, y + index * lineHeight);
  });
}

function exportAsImage() {
  const bounds = getExportBounds();
  const originX = bounds.minX - IMAGE_EXPORT_MARGIN;
  const originY = bounds.minY - IMAGE_EXPORT_MARGIN;
  const worldWidth = Math.max(100, bounds.maxX - bounds.minX + IMAGE_EXPORT_MARGIN * 2);
  const worldHeight = Math.max(100, bounds.maxY - bounds.minY + IMAGE_EXPORT_MARGIN * 2);

  let scale = IMAGE_EXPORT_SCALE;
  const maxWorld = Math.max(worldWidth, worldHeight);
  if (maxWorld * scale > IMAGE_EXPORT_MAX_PX) {
    scale = IMAGE_EXPORT_MAX_PX / maxWorld;
  }
  scale = Math.max(0.5, scale);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(worldWidth * scale));
  canvas.height = Math.max(1, Math.round(worldHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas konnte nicht erstellt werden.");
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#f2f3f5";
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  const drawGrid = (step, color, width) => {
    const startX = Math.floor(originX / step) * step;
    const endX = originX + worldWidth;
    const startY = Math.floor(originY / step) * step;
    const endY = originY + worldHeight;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      const relX = x - originX;
      ctx.moveTo(relX, 0);
      ctx.lineTo(relX, worldHeight);
    }
    for (let y = startY; y <= endY; y += step) {
      const relY = y - originY;
      ctx.moveTo(0, relY);
      ctx.lineTo(worldWidth, relY);
    }
    ctx.stroke();
  };

  drawGrid(120, "#e2e8f0", 1);
  drawGrid(24, "#eef2f7", 1);

  for (const edge of state.edges.values()) {
    const points = getEdgeEndpoints(edge);
    if (!points) {
      continue;
    }
    const x1 = points.a.x - originX;
    const y1 = points.a.y - originY;
    const x2 = points.b.x - originX;
    const y2 = points.b.y - originY;
    const dashed = isDashedType(edge.type);
    const directed = isDirectedType(edge.type);

    ctx.strokeStyle = "#56708f";
    ctx.lineWidth = 2.4;
    ctx.setLineDash(dashed ? [9, 6] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (directed) {
      drawArrowHead(ctx, x1, y1, x2, y2, "#56708f");
    }
  }

  for (const [nodeId, node] of state.nodes.entries()) {
    const x = node.x - originX;
    const y = node.y - originY;
    drawRoundedRectPath(ctx, x, y, node.width, node.height, 14);
    ctx.fillStyle = normalizeCardColor(node.color);
    ctx.fill();
    ctx.strokeStyle = "#d2d9e3";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const contentEl = state.nodeContentElements.get(nodeId);
    const text = contentEl ? contentEl.innerText : node.text || "";
    const align = contentEl ? window.getComputedStyle(contentEl).textAlign : "center";
    ctx.fillStyle = "#1b1f24";
    ctx.font = '14px "Avenir Next", Avenir, "Segoe UI", sans-serif';
    drawWrappedText(ctx, text, x + 12, y + 34, node.width - 24, node.height - 48, align);
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("Bild konnte nicht exportiert werden.");
      return;
    }
    downloadBlob(`mappy-bild-${getFileTimestamp()}.png`, blob);
  }, "image/png");
}

function clearConnectSource() {
  if (!state.connectSourceId) {
    return;
  }
  const el = state.nodeElements.get(state.connectSourceId);
  if (el) {
    el.classList.remove("connect-source");
  }
  state.connectSourceId = null;
}

function handleConnectClick(nodeId) {
  if (!state.connectSourceId) {
    state.connectSourceId = nodeId;
    const sourceEl = state.nodeElements.get(nodeId);
    if (sourceEl) {
      sourceEl.classList.add("connect-source");
    }
    return;
  }

  const source = state.connectSourceId;
  clearConnectSource();
  createEdge(source, nodeId);
}

function setDraftEdgeVisible(isVisible) {
  draftEdge.classList.toggle("visible", isVisible);
}

function syncDraftEdgeStyle() {
  const edgeType = getEdgeType(state.currentEdgeType);
  draftEdge.classList.toggle("is-dashed", isDashedType(edgeType));
  if (isDirectedType(edgeType)) {
    draftEdge.setAttribute("marker-end", "url(#edge-arrow-draft)");
  } else {
    draftEdge.removeAttribute("marker-end");
  }
}

function updateDraftEdge(sourceNodeId, clientX, clientY) {
  const sourceCenter = getCardCenter(sourceNodeId);
  if (!sourceCenter) {
    setDraftEdgeVisible(false);
    return;
  }
  const target = screenToWorld(clientX, clientY);
  draftEdge.setAttribute("x1", String(sourceCenter.x));
  draftEdge.setAttribute("y1", String(sourceCenter.y));
  draftEdge.setAttribute("x2", String(target.x));
  draftEdge.setAttribute("y2", String(target.y));
}

function startQuickCreateDrag(event, sourceNodeId, quickAddBtn) {
  if (event.button !== 0) {
    return;
  }
  if (!state.nodes.has(sourceNodeId)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  selectNode(sourceNodeId);
  clearSelectedEdge();
  clearConnectSource();

  const pointerId = event.pointerId;
  state.quickCreate.active = true;
  state.quickCreate.pointerId = pointerId;
  state.quickCreate.sourceNodeId = sourceNodeId;
  state.quickCreate.startClientX = event.clientX;
  state.quickCreate.startClientY = event.clientY;

  quickAddBtn.setPointerCapture(pointerId);
  syncDraftEdgeStyle();
  setDraftEdgeVisible(true);
  updateDraftEdge(sourceNodeId, event.clientX, event.clientY);

  const onMove = (moveEvent) => {
    if (!state.quickCreate.active || moveEvent.pointerId !== pointerId) {
      return;
    }
    updateDraftEdge(sourceNodeId, moveEvent.clientX, moveEvent.clientY);
  };

  const finish = (endEvent, cancelled) => {
    if (endEvent.pointerId !== pointerId) {
      return;
    }
    if (quickAddBtn.hasPointerCapture(pointerId)) {
      quickAddBtn.releasePointerCapture(pointerId);
    }
    quickAddBtn.removeEventListener("pointermove", onMove);
    quickAddBtn.removeEventListener("pointerup", onUp);
    quickAddBtn.removeEventListener("pointercancel", onCancel);

    setDraftEdgeVisible(false);

    const dragDistance = Math.hypot(
      endEvent.clientX - state.quickCreate.startClientX,
      endEvent.clientY - state.quickCreate.startClientY
    );
    state.quickCreate.active = false;
    state.quickCreate.pointerId = null;
    state.quickCreate.sourceNodeId = null;

    if (cancelled || dragDistance < QUICK_CREATE_MIN_DRAG) {
      return;
    }
    if (!state.nodes.has(sourceNodeId)) {
      return;
    }

    const dropWorld = screenToWorld(endEvent.clientX, endEvent.clientY);
    const cardPos = getDropCardPosition(dropWorld.x, dropWorld.y);
    const createdNodeId = createCard(cardPos.x, cardPos.y);
    if (createdNodeId) {
      createEdge(sourceNodeId, createdNodeId);
    }
  };

  const onUp = (upEvent) => finish(upEvent, false);
  const onCancel = (cancelEvent) => finish(cancelEvent, true);

  quickAddBtn.addEventListener("pointermove", onMove);
  quickAddBtn.addEventListener("pointerup", onUp);
  quickAddBtn.addEventListener("pointercancel", onCancel);
}

function startPanning(event) {
  state.isPanning = true;
  state.panPointerId = event.pointerId;
  state.panStart.x = event.clientX;
  state.panStart.y = event.clientY;
  state.panStart.camX = state.camera.x;
  state.panStart.camY = state.camera.y;
  viewport.classList.add("panning");
  viewport.setPointerCapture(event.pointerId);
}

function stopPanning(pointerId) {
  if (!state.isPanning || pointerId !== state.panPointerId) {
    return;
  }
  state.isPanning = false;
  viewport.classList.remove("panning");
  viewport.releasePointerCapture(pointerId);
  state.panPointerId = null;
}

viewport.addEventListener("pointerdown", (event) => {
  if (event.target.closest("#card-color-menu")) {
    return;
  }

  const onCard = event.target.closest(".node-card");
  if (!onCard) {
    clearSelectedEdge();
    clearSelectedNode();
  }

  if (state.mode === "add" && !onCard && event.button === 0) {
    const pos = screenToWorld(event.clientX, event.clientY);
    const cardPos = getDropCardPosition(pos.x, pos.y);
    createCard(cardPos.x, cardPos.y);
    return;
  }

  if (onCard || event.button !== 0) {
    return;
  }

  startPanning(event);
});

viewport.addEventListener("pointermove", (event) => {
  if (!state.isPanning || event.pointerId !== state.panPointerId) {
    return;
  }
  const dx = event.clientX - state.panStart.x;
  const dy = event.clientY - state.panStart.y;
  state.camera.x = state.panStart.camX + dx;
  state.camera.y = state.panStart.camY + dy;
  applyCamera();
});

viewport.addEventListener("pointerup", (event) => stopPanning(event.pointerId));
viewport.addEventListener("pointercancel", (event) => stopPanning(event.pointerId));

viewport.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const worldX = (sx - state.camera.x) / state.camera.scale;
    const worldY = (sy - state.camera.y) / state.camera.scale;

    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const nextScale = clamp(state.camera.scale * factor, MIN_SCALE, MAX_SCALE);
    state.camera.scale = nextScale;
    state.camera.x = sx - worldX * nextScale;
    state.camera.y = sy - worldY * nextScale;
    applyCamera();
  },
  { passive: false }
);

window.addEventListener("keydown", (event) => {
  const activeElement = document.activeElement;
  const isEditingText =
    !!activeElement &&
    (activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA" ||
      activeElement.isContentEditable);

  if (!isEditingText && (event.key === "Delete" || event.key === "Backspace")) {
    if (state.selectedEdgeId) {
      event.preventDefault();
      removeEdge(state.selectedEdgeId);
      return;
    }
  }

  if (event.key === "Escape") {
    hideCardColorMenu();
    hideTextStyleMenu();
    setMode("move");
  }
});

window.addEventListener("resize", () => {
  if (!Number.isFinite(state.camera.x) || !Number.isFinite(state.camera.y)) {
    centerView();
  } else {
    applyCamera();
  }
  hideCardColorMenu();
  if (state.textMenu.open && state.textMenu.nodeId) {
    positionTextStyleMenu(state.textMenu.nodeId);
  }
});

if (cardColorPresets) {
  cardColorPresets.addEventListener("click", (event) => {
    const swatch = event.target.closest(".card-color-swatch");
    if (!swatch) {
      return;
    }
    const nodeId = state.colorMenu.nodeId;
    if (!nodeId || !state.nodes.has(nodeId)) {
      return;
    }
    const color = normalizeCardColor(swatch.dataset.color || "", DEFAULT_CARD_COLOR);
    setNodeColor(nodeId, color);
    hideCardColorMenu();
  });
}

if (textStyleMenu) {
  textStyleMenu.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  textStyleMenu.addEventListener("click", (event) => {
    const button = event.target.closest(".text-style-btn");
    if (!button) {
      return;
    }

    const cmd = button.dataset.cmd;
    if (!cmd) {
      return;
    }

    const editingNodeId = getEditingNodeId() || state.textMenu.nodeId;
    if (!editingNodeId) {
      hideTextStyleMenu();
      return;
    }
    const content = state.nodeContentElements.get(editingNodeId);
    if (!content) {
      hideTextStyleMenu();
      return;
    }

    content.focus();
    try {
      document.execCommand(cmd, false, null);
    } catch {
      return;
    }
    updateTextStyleButtonStates();
    positionTextStyleMenu(editingNodeId);
  });
}

window.addEventListener("pointerdown", (event) => {
  if (event.target.closest("#card-color-menu") || event.target.closest("#text-style-menu")) {
    return;
  }
  hideCardColorMenu();
  const editingNodeId = getEditingNodeId();
  if (!editingNodeId) {
    hideTextStyleMenu();
  }
});

addCardBtn.addEventListener("click", () => {
  setMode(state.mode === "add" ? "move" : "add");
});

connectBtn.addEventListener("click", () => {
  setMode(state.mode === "connect" ? "move" : "connect");
});

if (edgeTypeSelect) {
  edgeTypeSelect.addEventListener("change", () => {
    const nextType = getEdgeType(edgeTypeSelect.value);
    state.currentEdgeType = nextType;
    syncDraftEdgeStyle();
    if (state.selectedEdgeId) {
      setEdgeType(state.selectedEdgeId, nextType);
    }
    syncEdgeTypeSelect();
  });
}

if (exportDataBtn) {
  exportDataBtn.addEventListener("click", () => {
    try {
      const snapshot = buildSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      downloadBlob(`mappy-daten-${getFileTimestamp()}.json`, blob);
    } catch {
      alert("Daten konnten nicht exportiert werden.");
    }
  });
}

if (importDataBtn && importFileInput) {
  importDataBtn.addEventListener("click", () => {
    importFileInput.value = "";
    importFileInput.click();
  });

  importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files && importFileInput.files[0];
    importFileInput.value = "";
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      importSnapshot(parsed);
    } catch (error) {
      if (error instanceof Error && error.message) {
        alert(`Import fehlgeschlagen: ${error.message}`);
        return;
      }
      alert("Import fehlgeschlagen: Ungültige Datei.");
    }
  });
}

if (exportImageBtn) {
  exportImageBtn.addEventListener("click", () => {
    try {
      exportAsImage();
    } catch {
      alert("Bild konnte nicht exportiert werden.");
    }
  });
}

deleteEdgeBtn.addEventListener("click", () => {
  if (!state.selectedEdgeId) {
    return;
  }
  removeEdge(state.selectedEdgeId);
});

resetViewBtn.addEventListener("click", centerView);

edgesLayer.setAttribute("viewBox", `0 0 ${WORLD_SIZE} ${WORLD_SIZE}`);
edgesLayer.setAttribute("width", String(WORLD_SIZE));
edgesLayer.setAttribute("height", String(WORLD_SIZE));
edgesLayer.appendChild(edgeDefs);
edgesLayer.appendChild(draftEdge);

setMode("move");
centerView();
syncDeleteEdgeButton();
syncDraftEdgeStyle();
syncEdgeTypeSelect();
renderCardColorPresets();

createCard(WORLD_CENTER - 130, WORLD_CENTER - 100);
createCard(WORLD_CENTER + 210, WORLD_CENTER - 10);
createEdge("N001", "N002");
