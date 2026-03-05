const WORLD_SIZE = 12000;
const WORLD_CENTER = WORLD_SIZE / 2;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.4;
const DEFAULT_CARD_WIDTH = 240;
const DEFAULT_CARD_HEIGHT = 130;
const QUICK_CREATE_MIN_DRAG = 10;

const viewport = document.getElementById("viewport");
const world = document.getElementById("world");
const nodesLayer = document.getElementById("nodes-layer");
const edgesLayer = document.getElementById("edges-layer");
const addCardBtn = document.getElementById("add-card-btn");
const connectBtn = document.getElementById("connect-btn");
const deleteEdgeBtn = document.getElementById("delete-edge-btn");
const resetViewBtn = document.getElementById("reset-view-btn");
const statusPill = document.getElementById("status-pill");
const zoomPill = document.getElementById("zoom-pill");

const state = {
  mode: "move",
  connectSourceId: null,
  selectedEdgeId: null,
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
  edges: new Map(),
  edgeElements: new Map(),
  edgeHitElements: new Map(),
};

const draftEdge = document.createElementNS("http://www.w3.org/2000/svg", "line");
draftEdge.classList.add("edge-draft");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
    statusPill.textContent = "Modus: Verknuepfen";
  } else {
    statusPill.textContent = "Modus: Bewegen";
  }
}

function setZoomLabel() {
  zoomPill.textContent = `${Math.round(state.camera.scale * 100)}%`;
}

function syncDeleteEdgeButton() {
  deleteEdgeBtn.disabled = !state.selectedEdgeId;
}

function clearSelectedEdge() {
  if (!state.selectedEdgeId) {
    syncDeleteEdgeButton();
    return;
  }
  const selectedLine = state.edgeElements.get(state.selectedEdgeId);
  if (selectedLine) {
    selectedLine.classList.remove("selected");
  }
  state.selectedEdgeId = null;
  syncDeleteEdgeButton();
}

function selectEdge(edgeId) {
  if (!state.edgeElements.has(edgeId)) {
    return;
  }
  if (state.selectedEdgeId === edgeId) {
    syncDeleteEdgeButton();
    return;
  }
  clearSelectedEdge();
  state.selectedEdgeId = edgeId;
  const line = state.edgeElements.get(edgeId);
  if (line) {
    line.classList.add("selected");
  }
  syncDeleteEdgeButton();
}

function applyCamera() {
  const { x, y, scale } = state.camera;
  world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  setZoomLabel();
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

function createCard(x, y) {
  const id = makeNodeId();
  const node = { id, x, y, text: "" };
  state.nodes.set(id, node);

  const card = document.createElement("article");
  card.className = "node-card";
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  card.dataset.nodeId = id;

  const header = document.createElement("header");
  header.className = "node-header";

  const title = document.createElement("div");
  title.className = "node-title";
  title.innerHTML = `<strong>Karte</strong><span class="node-id">${id}</span>`;

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
  deleteBtn.title = "Karte loeschen";
  deleteBtn.textContent = "x";

  actions.append(quickAddBtn, deleteBtn);
  header.append(title, actions);

  const content = document.createElement("div");
  content.className = "node-content";
  content.setAttribute("contenteditable", "true");
  content.spellcheck = false;

  card.append(header, content);
  nodesLayer.appendChild(card);
  state.nodeElements.set(id, card);

  header.addEventListener("pointerdown", (event) => {
    if (state.mode === "connect") {
      if (event.target.closest(".node-action-btn")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handleConnectClick(id);
      return;
    }

    if (event.target.closest(".node-action-btn")) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const start = screenToWorld(event.clientX, event.clientY);
    const pointerId = event.pointerId;
    const startX = node.x;
    const startY = node.y;

    header.setPointerCapture(pointerId);

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      const now = screenToWorld(moveEvent.clientX, moveEvent.clientY);
      const dx = now.x - start.x;
      const dy = now.y - start.y;
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
      header.releasePointerCapture(pointerId);
      header.removeEventListener("pointermove", onMove);
      header.removeEventListener("pointerup", onUp);
      header.removeEventListener("pointercancel", onUp);
    };

    header.addEventListener("pointermove", onMove);
    header.addEventListener("pointerup", onUp);
    header.addEventListener("pointercancel", onUp);
  });

  card.addEventListener("pointerdown", (event) => {
    if (state.mode === "connect" && !event.target.closest(".node-action-btn")) {
      event.preventDefault();
      handleConnectClick(id);
    }
  });

  content.addEventListener("input", () => {
    node.text = content.textContent || "";
    updateEdgePositionsForNode(id);
  });

  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    removeNode(id);
  });

  quickAddBtn.addEventListener("pointerdown", (event) => {
    startQuickCreateDrag(event, id, quickAddBtn);
  });

  content.focus();
  updateAllEdges();
  return id;
}

function removeNode(nodeId) {
  const el = state.nodeElements.get(nodeId);
  if (el) {
    el.remove();
  }
  state.nodeElements.delete(nodeId);
  state.nodes.delete(nodeId);
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
}

function edgeExists(from, to) {
  for (const edge of state.edges.values()) {
    const sameDirection = edge.from === from && edge.to === to;
    const reverseDirection = edge.from === to && edge.to === from;
    if (sameDirection || reverseDirection) {
      return true;
    }
  }
  return false;
}

function createEdge(fromId, toId) {
  if (!state.nodes.has(fromId) || !state.nodes.has(toId)) {
    return;
  }
  if (fromId === toId || edgeExists(fromId, toId)) {
    return;
  }

  const edgeId = makeEdgeId();
  const edge = { id: edgeId, from: fromId, to: toId };
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

  updateEdgePosition(edge);
}

function getCardCenter(nodeId) {
  const node = state.nodes.get(nodeId);
  const el = state.nodeElements.get(nodeId);
  if (!node || !el) {
    return null;
  }
  return {
    x: node.x + el.offsetWidth / 2,
    y: node.y + el.offsetHeight / 2,
  };
}

function updateEdgePosition(edge) {
  const line = state.edgeElements.get(edge.id);
  const hitLine = state.edgeHitElements.get(edge.id);
  if (!line) {
    return;
  }

  const a = getCardCenter(edge.from);
  const b = getCardCenter(edge.to);
  if (!a || !b) {
    return;
  }

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
  clearSelectedEdge();
  clearConnectSource();

  const pointerId = event.pointerId;
  state.quickCreate.active = true;
  state.quickCreate.pointerId = pointerId;
  state.quickCreate.sourceNodeId = sourceNodeId;
  state.quickCreate.startClientX = event.clientX;
  state.quickCreate.startClientY = event.clientY;

  quickAddBtn.setPointerCapture(pointerId);
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
  const onCard = event.target.closest(".node-card");
  if (!onCard) {
    clearSelectedEdge();
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
    setMode("move");
  }
});

window.addEventListener("resize", () => {
  if (!Number.isFinite(state.camera.x) || !Number.isFinite(state.camera.y)) {
    centerView();
  } else {
    applyCamera();
  }
});

addCardBtn.addEventListener("click", () => {
  setMode(state.mode === "add" ? "move" : "add");
});

connectBtn.addEventListener("click", () => {
  setMode(state.mode === "connect" ? "move" : "connect");
});

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
edgesLayer.appendChild(draftEdge);

setMode("move");
centerView();
syncDeleteEdgeButton();

createCard(WORLD_CENTER - 130, WORLD_CENTER - 100);
createCard(WORLD_CENTER + 210, WORLD_CENTER - 10);
createEdge("N001", "N002");
