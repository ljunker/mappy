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
  syncFlipEdgeButton();
  syncEdgeTypeSelect();
}

function edgeExists(from, to, edgeType = state.currentEdgeType, excludedEdgeId = null) {
  const newDirected = isDirectedType(edgeType);
  for (const edge of state.edges.values()) {
    if (excludedEdgeId && edge.id === excludedEdgeId) {
      continue;
    }
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

function flipEdgeDirection(edgeId) {
  const edge = state.edges.get(edgeId);
  if (!edge || !isDirectedType(edge.type)) {
    return false;
  }

  const nextFrom = edge.to;
  const nextTo = edge.from;
  if (edgeExists(nextFrom, nextTo, edge.type, edge.id)) {
    alert("Diese Richtung existiert bereits.");
    return false;
  }

  edge.from = nextFrom;
  edge.to = nextTo;
  updateEdgePosition(edge);
  refreshEdgeAppearance(edgeId);
  syncFlipEdgeButton();
  return true;
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
