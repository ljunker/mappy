viewport.addEventListener("pointerdown", (event) => {
  if (event.target.closest("#card-color-menu") || event.target.closest("#edge-type-menu")) {
    return;
  }

  const onCard = event.target.closest(".node-card");
  if (!onCard) {
    clearSelectedEdge();
    clearSelectedNode();
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

viewport.addEventListener("dblclick", (event) => {
  if (event.button !== 0) {
    return;
  }
  if (
    event.target.closest(".node-card") ||
    event.target.closest("#card-color-menu") ||
    event.target.closest("#text-style-menu") ||
    event.target.closest("#edge-type-menu")
  ) {
    return;
  }

  event.preventDefault();
  const pos = screenToWorld(event.clientX, event.clientY);
  const cardPos = getDropCardPosition(pos.x, pos.y);
  createCard(cardPos.x, cardPos.y);
});

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
    hideEdgeTypeMenu();
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
  if (state.edgeMenu.open && state.selectedEdgeId) {
    positionEdgeTypeMenu(state.selectedEdgeId);
  }
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

if (edgeTypeMenu) {
  edgeTypeMenu.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  edgeTypeMenu.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  edgeTypeMenu.addEventListener("click", (event) => {
    const option = event.target.closest(".edge-type-item");
    if (!option) {
      return;
    }
    const edgeId = state.edgeMenu.edgeId || state.selectedEdgeId;
    if (!edgeId || !state.edges.has(edgeId)) {
      hideEdgeTypeMenu();
      return;
    }
    const nextType = getEdgeType(option.dataset.edgeType);
    setEdgeType(edgeId, nextType);
  });
}

window.addEventListener("pointerdown", (event) => {
  if (
    event.target.closest("#card-color-menu") ||
    event.target.closest("#text-style-menu") ||
    event.target.closest("#edge-type-menu")
  ) {
    return;
  }
  hideCardColorMenu();
  const editingNodeId = getEditingNodeId();
  if (!editingNodeId) {
    hideTextStyleMenu();
  }
});

connectBtn.addEventListener("click", () => {
  setMode(state.mode === "connect" ? "move" : "connect");
});

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

if (edgeMenuFlipBtn) {
  edgeMenuFlipBtn.addEventListener("click", () => {
    const edgeId = state.edgeMenu.edgeId || state.selectedEdgeId;
    if (!edgeId || !state.edges.has(edgeId)) {
      return;
    }
    flipEdgeDirection(edgeId);
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
renderCardColorPresets();

createCard(WORLD_CENTER - 130, WORLD_CENTER - 100);
createCard(WORLD_CENTER + 210, WORLD_CENTER - 10);
createEdge("N001", "N002");
