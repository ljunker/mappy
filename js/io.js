function clearBoard() {
  hideCardColorMenu();
  hideTextStyleMenu();
  hideEdgeTypeMenu();
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
