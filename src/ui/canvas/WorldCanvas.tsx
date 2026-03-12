import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";
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
            const teamColor = owner === 1 ? "#3b82f6" : "#ef4444";
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
          const teamColor = faction ? (faction[i] === 1 ? "#3b82f6" : "#ef4444") : "#ffffff";
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
  }, [spec, terrain, buffers, unitBehaviorSpec, paths]);

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!spec || !buffers) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX / spec.config.tile_size);
    const y = Math.floor((event.clientY - rect.top) * scaleY / spec.config.tile_size);
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

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width: "100%",
        maxWidth: 900,
        height: "auto",
        imageRendering: "pixelated",
        border: "1px solid #1c1c1c"
      }}
    />
  );
}
