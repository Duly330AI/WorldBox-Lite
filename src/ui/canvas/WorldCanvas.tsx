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
  }, [spec, terrain]);

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
