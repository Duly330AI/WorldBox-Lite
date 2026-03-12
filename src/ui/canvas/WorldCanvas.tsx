import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useWorldStore } from "../store";

const ID_COLORS: Record<number, string> = {
  0: "#4ade80",
  1: "#fbbf24",
  2: "#f59e0b",
  5: "#3b82f6",
  7: "#4b5563",
  8: "#ef4444"
};

export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spec = useWorldStore((s) => s.spec);
  const terrain = useWorldStore((s) => s.terrain);
  const buffers = useWorldStore((s) => s.buffers);
  const unitBehaviorSpec = useWorldStore((s) => s.unitBehaviorSpec);
  const paths = useWorldStore((s) => s.paths);
  const buildingOwners = useWorldStore((s) => s.buildingOwners);
  const setSelectedEntityId = useWorldStore((s) => s.setSelectedEntityId);
  const godTool = useWorldStore((s) => s.godTool);
  const worker = useWorldStore((s) => s.worker);
  const entityDebug = useWorldStore((s) => s.entityDebug);
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number; entityId: number | null } | null>(null);
  const isPaintingRef = useRef(false);
  const lastPaintRef = useRef<string | null>(null);
  const teamColors = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#14b8a6", "#eab308", "#64748b"];

  useEffect(() => {
    if (!spec || !terrain) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = spec.config.dimensions;
    const tileSize = spec.config.tile_size;
    canvas.width = width * tileSize;
    canvas.height = height * tileSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        const id = terrain[idx];
        ctx.fillStyle = ID_COLORS[id] ?? "#333333";
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    if (buffers) {
      ctx.fillStyle = "#064e3b";
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          if (buffers.feature[idx] === 100) {
            ctx.beginPath();
            ctx.arc(
              x * tileSize + tileSize / 2,
              y * tileSize + tileSize / 2,
              tileSize / 4,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
          if (buffers.feature[idx] === 110) {
            const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
            ctx.fillStyle = `rgba(255, 140, 0, ${pulse})`;
            ctx.beginPath();
            ctx.arc(
              x * tileSize + tileSize / 2,
              y * tileSize + tileSize / 2,
              tileSize / 3,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
      }
    }

    if (buffers) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          if (buffers.building[idx] === 300) {
            const owner = buildingOwners[idx] ?? 0;
            const teamColor = teamColors[owner % teamColors.length];
            ctx.fillStyle = "#8b5a2b";
            ctx.fillRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
            ctx.fillStyle = teamColor;
            ctx.font = "10px sans-serif";
            ctx.fillText("H", x * tileSize + tileSize / 2 - 3, y * tileSize + tileSize / 2 + 3);
          }
        }
      }
    }

    if (paths.length > 0) {
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      for (const p of paths) {
        if (!p.path || p.path.length < 2) continue;
        ctx.beginPath();
        const [sx, sy] = p.path[0];
        ctx.moveTo(sx * tileSize + tileSize / 2, sy * tileSize + tileSize / 2);
        for (let i = 1; i < p.path.length; i += 1) {
          const [x, y] = p.path[i];
          ctx.lineTo(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2);
        }
        ctx.stroke();
      }
    }

    if (buffers && unitBehaviorSpec) {
      const ids = buffers.entities.id as Uint32Array | undefined;
      const xs = buffers.entities.x as Uint16Array | undefined;
      const ys = buffers.entities.y as Uint16Array | undefined;
      const actionId = buffers.entities.current_action_id as Uint8Array | undefined;
      const progress = buffers.entities.action_progress as Uint8Array | undefined;
      const types = buffers.entities.type as Uint8Array | undefined;
      if (ids && xs && ys && actionId && progress) {
        const actionNameById = new Map<number, string>();
        for (const [name, def] of Object.entries(unitBehaviorSpec.actions)) {
          actionNameById.set(def.id, name);
        }
        for (let i = 0; i < ids.length; i += 1) {
          if (ids[i] === 0) continue;
          const x = xs[i];
          const y = ys[i];
          const px = x * tileSize;
          const py = y * tileSize;
          const faction = buffers.entities.faction_id as Uint8Array | undefined;
          const teamColor = faction ? teamColors[faction[i] % teamColors.length] : "#ffffff";
          if (types && (types[i] === 201 || types[i] === 200 || types[i] === 202 || types[i] === 203 || types[i] === 204)) {
            ctx.fillStyle = "#7c4a2d";
            ctx.beginPath();
            ctx.arc(
              px + tileSize / 2,
              py + tileSize / 2,
              tileSize / 4,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.strokeStyle = teamColor;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          if (actionId[i] > 0) {
            const pct = Math.min(1, progress[i] / 100);
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(px + 2, py + 2, (tileSize - 4) * pct, 4);
            const name = actionNameById.get(actionId[i]) ?? "";
            const label = name ? name[0] : "?";
            ctx.fillStyle = "#fff";
            ctx.font = "10px sans-serif";
            ctx.fillText(label, px + tileSize - 10, py + 12);
          }

          const health = (buffers.entities.health as Uint8Array)[i] ?? 0;
          if (health < 100) {
            ctx.fillStyle = "#ef4444";
            const pct = Math.max(0, Math.min(1, health / 100));
            ctx.fillRect(px + 2, py + tileSize - 4, (tileSize - 4) * pct, 3);
          }
        }
      }
    }

    if (godTool.tool && hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.setLineDash([4, 2]);
      const size = godTool.brushSize;
      const half = Math.floor(size / 2);
      const px = (hover.x - half) * tileSize;
      const py = (hover.y - half) * tileSize;
      ctx.strokeRect(px, py, size * tileSize, size * tileSize);
      ctx.setLineDash([]);
    }
  }, [spec, terrain, buffers, unitBehaviorSpec, paths, buildingOwners, godTool, hover]);

  const tileFromEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!spec || !buffers) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((event.clientX - rect.left) * scaleX) / spec.config.tile_size);
    const y = Math.floor(((event.clientY - rect.top) * scaleY) / spec.config.tile_size);
    return { x, y, px: event.clientX - rect.left, py: event.clientY - rect.top };
  };

  const sendBrushMutation = (x: number, y: number) => {
    if (!spec || !worker || !godTool.tool) return;
    const size = godTool.brushSize;
    const half = Math.floor(size / 2);
    const mutations: Array<{ x: number; y: number; terrain?: number; feature?: number; building?: number }> = [];
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= spec.config.dimensions.width || ty >= spec.config.dimensions.height) continue;
        if (godTool.tool === "lava") {
          mutations.push({ x: tx, y: ty, terrain: 8, feature: 0, building: 0 });
        } else if (godTool.tool === "water") {
          mutations.push({ x: tx, y: ty, terrain: 5, feature: 0, building: 0 });
        } else if (godTool.tool === "forest") {
          mutations.push({ x: tx, y: ty, feature: 100 });
        } else if (godTool.tool === "ignite") {
          mutations.push({ x: tx, y: ty, feature: 110 });
        }
      }
    }
    if (mutations.length > 0) {
      worker.postMessage({ type: "world_mutation", mutations });
    }
  };

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (godTool.tool) return;
    const tile = tileFromEvent(event);
    if (!tile || !buffers) return;
    const { x, y } = tile;
    const ids = buffers.entities.id as Uint32Array;
    const xs = buffers.entities.x as Uint16Array;
    const ys = buffers.entities.y as Uint16Array;
    for (let i = 0; i < ids.length; i += 1) {
      if (ids[i] === 0) continue;
      if (xs[i] === x && ys[i] === y) {
        setSelectedEntityId(i);
        return;
      }
    }
    setSelectedEntityId(null);
  };

  const updateHover = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!spec || !buffers) return;
    const tile = tileFromEvent(event);
    if (!tile) return;
    const ids = buffers.entities.id as Uint32Array;
    const xs = buffers.entities.x as Uint16Array;
    const ys = buffers.entities.y as Uint16Array;
    let found: number | null = null;
    for (let i = 0; i < ids.length; i += 1) {
      if (ids[i] === 0) continue;
      if (xs[i] === tile.x && ys[i] === tile.y) {
        found = i;
        break;
      }
    }
    setHover({ x: tile.x, y: tile.y, px: tile.px, py: tile.py, entityId: found });
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!godTool.tool) return;
    isPaintingRef.current = true;
    const tile = tileFromEvent(event);
    if (!tile) return;
    const key = `${tile.x},${tile.y},${godTool.tool},${godTool.brushSize}`;
    if (lastPaintRef.current !== key) {
      lastPaintRef.current = key;
      sendBrushMutation(tile.x, tile.y);
    }
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    updateHover(event);
    if (!isPaintingRef.current || !godTool.tool) return;
    const tile = tileFromEvent(event);
    if (!tile) return;
    const key = `${tile.x},${tile.y},${godTool.tool},${godTool.brushSize}`;
    if (lastPaintRef.current !== key) {
      lastPaintRef.current = key;
      sendBrushMutation(tile.x, tile.y);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => {
          isPaintingRef.current = false;
          lastPaintRef.current = null;
        }}
        onMouseLeave={() => {
          isPaintingRef.current = false;
          lastPaintRef.current = null;
          setHover(null);
        }}
        style={{
          width: "100%",
          maxWidth: 900,
          height: "auto",
          imageRendering: "pixelated",
          border: "1px solid #1c1c1c"
        }}
      />
      {hover && hover.entityId !== null ? (
        <div
          style={{
            position: "absolute",
            left: hover.px + 12,
            top: hover.py + 12,
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            padding: "4px 6px",
            borderRadius: 4,
            fontSize: 11,
            pointerEvents: "none",
            maxWidth: 160
          }}
        >
          <div>Unit #{hover.entityId}</div>
          <div>Goal: {entityDebug[hover.entityId]?.goal ?? "?"}</div>
        </div>
      ) : null}
    </div>
  );
}
