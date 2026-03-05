function setMode(mode) {
  state.mode = mode;
  if (mode !== "connect") {
    clearConnectSource();
  }

  connectBtn.classList.toggle("active", mode === "connect");

  if (mode === "connect") {
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

function syncEdgeTypeMenuSelection(edgeId) {
  if (!edgeTypeMenu) {
    return;
  }
  const edge = edgeId ? state.edges.get(edgeId) : null;
  const type = edge ? getEdgeType(edge.type) : "";
  const options = edgeTypeMenu.querySelectorAll(".edge-type-item");
  for (const option of options) {
    option.classList.toggle("active", option.dataset.edgeType === type);
  }
  syncEdgeMenuControls(edgeId);
}

function syncEdgeMenuControls(edgeId) {
  if (!edgeMenuFlipBtn) {
    return;
  }
  const edge = edgeId ? state.edges.get(edgeId) : null;
  edgeMenuFlipBtn.disabled = !edge || !isDirectedType(edge.type);
}

function getEdgeMenuClientPosition(edgeId) {
  const edge = state.edges.get(edgeId);
  if (!edge || typeof getEdgeEndpoints !== "function") {
    return null;
  }
  const points = getEdgeEndpoints(edge);
  if (!points) {
    return null;
  }
  const midX = (points.a.x + points.b.x) / 2;
  const midY = (points.a.y + points.b.y) / 2;
  const viewRect = viewport.getBoundingClientRect();
  return {
    x: viewRect.left + midX * state.camera.scale + state.camera.x,
    y: viewRect.top + midY * state.camera.scale + state.camera.y,
  };
}

function hideEdgeTypeMenu() {
  if (!edgeTypeMenu || !state.edgeMenu.open) {
    state.edgeMenu.open = false;
    state.edgeMenu.edgeId = null;
    return;
  }
  edgeTypeMenu.hidden = true;
  state.edgeMenu.open = false;
  state.edgeMenu.edgeId = null;
}

function positionEdgeTypeMenu(edgeId, clientX = null, clientY = null) {
  if (!edgeTypeMenu || !state.edges.has(edgeId)) {
    hideEdgeTypeMenu();
    return;
  }

  const viewRect = viewport.getBoundingClientRect();
  const menuPadding = 10;
  let nextClientX = clientX;
  let nextClientY = clientY;
  if (!Number.isFinite(nextClientX) || !Number.isFinite(nextClientY)) {
    const autoPos = getEdgeMenuClientPosition(edgeId);
    if (autoPos) {
      nextClientX = autoPos.x;
      nextClientY = autoPos.y;
    } else {
      nextClientX = viewRect.left + viewRect.width / 2;
      nextClientY = viewRect.top + viewRect.height / 2;
    }
  }
  const relX = nextClientX - viewRect.left;
  const relY = nextClientY - viewRect.top;

  edgeTypeMenu.style.left = "0px";
  edgeTypeMenu.style.top = "0px";

  const menuWidth = edgeTypeMenu.offsetWidth;
  const menuHeight = edgeTypeMenu.offsetHeight;
  const maxX = viewRect.width - menuWidth - menuPadding;
  const maxY = viewRect.height - menuHeight - menuPadding;

  const nextX = clamp(relX + 8, menuPadding, Math.max(menuPadding, maxX));
  const nextY = clamp(relY + 8, menuPadding, Math.max(menuPadding, maxY));

  edgeTypeMenu.style.left = `${nextX}px`;
  edgeTypeMenu.style.top = `${nextY}px`;
  syncEdgeTypeMenuSelection(edgeId);
}

function showEdgeTypeMenu(edgeId, clientX = null, clientY = null) {
  if (!edgeTypeMenu || !state.edges.has(edgeId)) {
    return;
  }
  edgeTypeMenu.hidden = false;
  state.edgeMenu.open = true;
  state.edgeMenu.edgeId = edgeId;
  positionEdgeTypeMenu(edgeId, clientX, clientY);
}

function clearSelectedNode() {
  if (!state.selectedNodeId) {
    hideCardColorMenu();
    hideTextStyleMenu();
    hideEdgeTypeMenu();
    return;
  }
  const selectedCard = state.nodeElements.get(state.selectedNodeId);
  if (selectedCard) {
    selectedCard.classList.remove("selected");
  }
  hideCardColorMenu();
  hideTextStyleMenu();
  hideEdgeTypeMenu();
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
  hideEdgeTypeMenu();
  hideCardColorMenu();
  if (state.textMenu.open && state.textMenu.nodeId !== nodeId) {
    hideTextStyleMenu();
  }
}

function syncDeleteEdgeButton() {
  deleteEdgeBtn.disabled = !state.selectedEdgeId;
}

function setEdgeType(edgeId, edgeType) {
  const edge = state.edges.get(edgeId);
  if (!edge) {
    return;
  }
  edge.type = getEdgeType(edgeType);
  refreshEdgeAppearance(edgeId);
  if (state.selectedEdgeId === edgeId) {
    state.currentEdgeType = getEdgeType(edge.type);
    syncDraftEdgeStyle();
  }
  if (state.edgeMenu.open && state.edgeMenu.edgeId === edgeId) {
    positionEdgeTypeMenu(edgeId);
  }
}

function clearSelectedEdge() {
  if (!state.selectedEdgeId) {
    syncDeleteEdgeButton();
    hideEdgeTypeMenu();
    return;
  }
  const prevSelectedId = state.selectedEdgeId;
  state.selectedEdgeId = null;
  refreshEdgeAppearance(prevSelectedId);
  hideEdgeTypeMenu();
  syncDeleteEdgeButton();
}

function selectEdge(edgeId, menuClientX = null, menuClientY = null) {
  if (!state.edgeElements.has(edgeId) || !state.edges.has(edgeId)) {
    return;
  }
  if (state.selectedEdgeId === edgeId) {
    if (state.edgeMenu.open) {
      positionEdgeTypeMenu(edgeId, menuClientX, menuClientY);
    } else {
      showEdgeTypeMenu(edgeId, menuClientX, menuClientY);
    }
    syncDeleteEdgeButton();
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
  syncDraftEdgeStyle();
  showEdgeTypeMenu(edgeId, menuClientX, menuClientY);
}
