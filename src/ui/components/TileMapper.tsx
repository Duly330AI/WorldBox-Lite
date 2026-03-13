import { useMemo, useState } from "react";
import { useWorldStore } from "../store";

const REQUIRED_KEYS = [
  { key: "terrain.0", label: "Grass (terrain 0)" },
  { key: "terrain.5", label: "Water (terrain 5)" },
  { key: "terrain.2", label: "Sand (terrain 2)" },
  { key: "features.100", label: "Forest (feature 100)" },
  { key: "features.110", label: "Fire (feature 110)" },
  { key: "entities.300", label: "House (building 300)" },
  { key: "entities.201", label: "Worker (201)" },
  { key: "entities.200", label: "Scout (200)" },
  { key: "entities.202", label: "Archer (202)" },
  { key: "entities.203", label: "Axeman (203)" }
];

export function TileMapper() {
  const assetSpec = useWorldStore((s) => s.assetSpec);
  const tilesetImages = useWorldStore((s) => s.tilesetImages);
  const [selectedKey, setSelectedKey] = useState(REQUIRED_KEYS[0].key);
  const [assigned, setAssigned] = useState<Record<string, { x: number; y: number }>>({});

  const tileset = assetSpec?.tilesets.find((t) => t.name === "kenney");
  const image = tileset ? tilesetImages[tileset.name] : undefined;
  const tileSize = tileset?.tile_size ?? 16;
  const spacing = tileset?.spacing ?? 1;
  const columns = tileset?.columns ?? 57;

  const scaled = useMemo(() => {
    if (!image) return { w: 0, h: 0 };
    const scale = 0.5;
    return { w: Math.floor(image.width * scale), h: Math.floor(image.height * scale), scale };
  }, [image]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !tileset) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scale = scaled.scale ?? 0.5;
    const rawX = Math.floor((event.clientX - rect.left) / scale);
    const rawY = Math.floor((event.clientY - rect.top) / scale);
    const stride = tileSize + spacing;
    const x = Math.floor(rawX / stride) * stride;
    const y = Math.floor(rawY / stride) * stride;
    setAssigned((prev) => ({ ...prev, [selectedKey]: { x, y } }));
  };

  const applyMapping = () => {
    if (!assetSpec) return;
    const next = JSON.parse(JSON.stringify(assetSpec));
    for (const [key, value] of Object.entries(assigned)) {
      const [group, id] = key.split(".");
      if (!next.mappings[group]) next.mappings[group] = {};
      next.mappings[group][id] = {
        tileset: group === "entities" ? "characters" : "kenney",
        x: value.x,
        y: value.y,
        w: tileSize,
        h: tileSize,
        desc: next.mappings[group]?.[id]?.desc ?? ""
      };
    }
    const blob = new Blob([JSON.stringify(next, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asset_spec.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!assetSpec || !tileset || !image) return null;

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 8,
        padding: 8,
        background: "#fafafa"
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Tile Mapper</div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #ddd" }}>
          <canvas
            width={scaled.w}
            height={scaled.h}
            onClick={handleClick}
            ref={(el) => {
              if (!el || !image) return;
              const ctx = el.getContext("2d");
              if (!ctx) return;
              ctx.imageSmoothingEnabled = false;
              ctx.clearRect(0, 0, el.width, el.height);
              ctx.drawImage(image, 0, 0, el.width, el.height);
            }}
            style={{ width: scaled.w, height: scaled.h, imageRendering: "pixelated", cursor: "crosshair" }}
          />
        </div>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 11, marginBottom: 6 }}>Select slot, then click tile:</div>
          {REQUIRED_KEYS.map((slot) => (
            <label key={slot.key} style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
              <input
                type="radio"
                name="tile-slot"
                checked={selectedKey === slot.key}
                onChange={() => setSelectedKey(slot.key)}
              />{" "}
              {slot.label}
              {assigned[slot.key] ? ` → (${assigned[slot.key].x}, ${assigned[slot.key].y})` : ""}
            </label>
          ))}
          <button style={{ marginTop: 8 }} onClick={applyMapping}>
            Export asset_spec.json
          </button>
          <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
            Downloaded file replaces `specs/asset_spec.json`.
          </div>
        </div>
      </div>
    </div>
  );
}
