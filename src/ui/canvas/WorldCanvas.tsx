import { useEffect, useRef } from "react";
import { useWorldStore } from "../store";

const DEFAULT_COLORS: Record<string, string> = {
  grass: "#6dbd45",
  plains: "#a4c76a",
  desert: "#d8c384",
  tundra: "#a6bda8",
  snow: "#e7eef3",
  water: "#4aa3c7",
  ocean: "#2e6fa1",
  peak: "#88939c"
};

export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spec = useWorldStore((s) => s.spec);
  const terrain = useWorldStore((s) => s.terrain);
  const buffers = useWorldStore((s) => s.buffers);
  const unitBehaviorSpec = useWorldStore((s) => s.unitBehaviorSpec);
  const paths = useWorldStore((s) => s.paths);

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

    const idToColor = new Map<number, string>();
    for (const [name, def] of Object.entries(spec.terrain_types)) {
      idToColor.set(def.id, DEFAULT_COLORS[name] ?? "#666666");
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        const id = terrain[idx];
        ctx.fillStyle = idToColor.get(id) ?? "#333333";
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
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
          ctx.fillStyle = "#222";
          ctx.fillRect(px + tileSize / 4, py + tileSize / 4, tileSize / 2, tileSize / 2);

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
        }
      }
    }
  }, [spec, terrain, buffers, unitBehaviorSpec, paths]);

  return (
    <canvas
      ref={canvasRef}
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
