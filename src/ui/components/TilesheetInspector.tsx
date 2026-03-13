import { useEffect, useRef, useState } from "react";
import { useWorldStore } from "../store";

export function TilesheetInspector() {
  const assetSpec = useWorldStore((s) => s.assetSpec);
  const tilesetImages = useWorldStore((s) => s.tilesetImages);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const tileset = assetSpec?.tilesets.find((t) => t.name === "kenney");
    const image = tileset ? tilesetImages[tileset.name] : undefined;
    const canvas = canvasRef.current;
    if (!tileset || !image || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = 0.5;
    canvas.width = Math.floor(image.width * scale);
    canvas.height = Math.floor(image.height * scale);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }, [assetSpec, tilesetImages]);

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const tileset = assetSpec?.tilesets.find((t) => t.name === "kenney");
    const image = tileset ? tilesetImages[tileset.name] : undefined;
    const canvas = canvasRef.current;
    if (!tileset || !image || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / image.width;
    const spacing = tileset.spacing ?? 0;
    const stride = tileset.tile_size + spacing;
    const x = Math.floor((event.clientX - rect.left) / scale);
    const y = Math.floor((event.clientY - rect.top) / scale);
    const col = Math.floor(x / stride);
    const row = Math.floor(y / stride);
    const index = row * tileset.columns + col;
    if (index >= 0) setHoverIndex(index);
  };

  const handleClick = async () => {
    if (hoverIndex === null) return;
    setCopiedIndex(hoverIndex);
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(String(hoverIndex));
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 8,
        padding: 8,
        background: "#fafafa",
        width: 260
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Tilesheet Inspector</div>
      <div style={{ fontSize: 11, marginBottom: 6 }}>
        Hover index: {hoverIndex ?? "-"} {copiedIndex === hoverIndex ? "(copied)" : ""}
      </div>
      <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #ddd" }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMove}
          onClick={handleClick}
          style={{ width: "100%", imageRendering: "pixelated", cursor: "crosshair" }}
        />
      </div>
    </div>
  );
}
