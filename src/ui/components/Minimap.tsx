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

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spec = useWorldStore((s) => s.spec);
  const terrain = useWorldStore((s) => s.terrain);
  const buffers = useWorldStore((s) => s.buffers);
  const minimapBuffer = useWorldStore((s) => s.minimapBuffer);
  const setCameraTarget = useWorldStore((s) => s.setCameraTarget);

  useEffect(() => {
    if (!spec || !terrain) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (minimapBuffer) {
      const image = new ImageData(minimapBuffer, size, size);
      ctx.putImageData(image, 0, 0);
      return;
    }
    const { width, height } = spec.config.dimensions;
    const stepX = width / size;
    const stepY = height / size;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const tx = Math.floor(x * stepX);
        const ty = Math.floor(y * stepY);
        const idx = ty * width + tx;
        let color = ID_COLORS[terrain[idx]] ?? "#333";
        if (buffers?.feature[idx] === 110) color = "#f97316";
        else if (buffers?.feature[idx] === 100) color = "#14532d";
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [spec, terrain, buffers, minimapBuffer]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!spec) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = 64;
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * size);
    const worldX = Math.floor((x / size) * spec.config.dimensions.width);
    const worldY = Math.floor((y / size) * spec.config.dimensions.height);
    setCameraTarget({ x: worldX, y: worldY });
  };

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 8,
        padding: 8,
        background: "#fafafa",
        width: 96
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Minimap</div>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ width: 80, height: 80, imageRendering: "pixelated", cursor: "pointer" }}
      />
    </div>
  );
}
