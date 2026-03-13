import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorldStore } from "../store";

const ID_COLORS: Record<number, string> = {
  0: "#4ade80",
  1: "#fbbf24",
  2: "#f59e0b",
  5: "#3b82f6",
  7: "#4b5563",
  8: "#ef4444"
};

type SpriteAtlas = {
  image: HTMLCanvasElement;
  tileSize: number;
  mapping: Record<string, { x: number; y: number; w: number; h: number }>;
};

export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spec = useWorldStore((s) => s.spec);
  const terrain = useWorldStore((s) => s.terrain);
  const buffers = useWorldStore((s) => s.buffers);
  const unitBehaviorSpec = useWorldStore((s) => s.unitBehaviorSpec);
  const paths = useWorldStore((s) => s.paths);
  const buildingOwners = useWorldStore((s) => s.buildingOwners);
  const attackLines = useWorldStore((s) => s.attackLines);
  const setSelectedEntityId = useWorldStore((s) => s.setSelectedEntityId);
  const selectedEntityId = useWorldStore((s) => s.selectedEntityId);
  const godTool = useWorldStore((s) => s.godTool);
  const worker = useWorldStore((s) => s.worker);
  const entityDebug = useWorldStore((s) => s.entityDebug);
  const tick = useWorldStore((s) => s.tick);
  const tickIntervalMs = useWorldStore((s) => s.tickIntervalMs);
  const cameraTarget = useWorldStore((s) => s.cameraTarget);
  const setCameraTarget = useWorldStore((s) => s.setCameraTarget);
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number; entityId: number | null } | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number; dragging: boolean } | null>(null);
  const lastTickTimeRef = useRef<number>(performance.now());
  const prevPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const isPaintingRef = useRef(false);
  const lastPaintRef = useRef<string | null>(null);
  const teamColors = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#14b8a6", "#eab308", "#64748b"];

  const atlas = useMemo<SpriteAtlas>(() => {
    const tileSize = 32;
    const scale = tileSize / 16;
    const s = (n: number) => n * scale;
    const cols = 8;
    const rows = 4;
    const canvas = document.createElement("canvas");
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { image: canvas, tileSize, mapping: {} };
    }
    ctx.imageSmoothingEnabled = false;

    const drawTile = (
      col: number,
      row: number,
      draw: (c: CanvasRenderingContext2D, x: number, y: number) => void
    ) => {
      const x = col * tileSize;
      const y = row * tileSize;
      ctx.clearRect(x, y, tileSize, tileSize);
      draw(ctx, x, y);
    };

    const mapping: SpriteAtlas["mapping"] = {
      "terrain.0": { x: 0 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // grass
      "terrain.1": { x: 1 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // plains
      "terrain.2": { x: 2 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // sand
      "terrain.3": { x: 3 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // tundra
      "terrain.4": { x: 4 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // snow
      "terrain.5": { x: 5 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // water
      "terrain.6": { x: 6 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // ocean
      "terrain.7": { x: 7 * tileSize, y: 0 * tileSize, w: tileSize, h: tileSize }, // peak
      "terrain.8": { x: 0 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // lava
      "features.100": { x: 1 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // forest
      "features.110": { x: 2 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // fire
      "entities.200": { x: 3 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // scout
      "entities.201": { x: 4 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // worker
      "entities.202": { x: 5 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // archer
      "entities.203": { x: 6 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // axeman
      "entities.204": { x: 7 * tileSize, y: 1 * tileSize, w: tileSize, h: tileSize }, // swordsman
      "entities.300": { x: 0 * tileSize, y: 2 * tileSize, w: tileSize, h: tileSize }, // house
      "entities.210": { x: 0 * tileSize, y: 2 * tileSize, w: tileSize, h: tileSize } // city center (house sprite)
    };

    const dot = (c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };
    const strokeRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    // terrain
    drawTile(0, 0, (c, x, y) => {
      c.fillStyle = "#4ade80";
      c.fillRect(x, y, tileSize, tileSize);
      dot(c, x + s(4), y + s(5), s(1), "rgba(0,0,0,0.15)");
      dot(c, x + s(11), y + s(10), s(1), "rgba(0,0,0,0.12)");
      dot(c, x + s(7), y + s(12), s(1), "rgba(0,0,0,0.1)");
      strokeRect(c, x, y, tileSize, tileSize, "rgba(0,0,0,0.08)");
    });
    drawTile(1, 0, (c, x, y) => {
      c.fillStyle = "#fbbf24";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "rgba(0,0,0,0.12)";
      c.fillRect(x + s(2), y + s(3), s(5), s(3));
      c.fillRect(x + s(9), y + s(10), s(4), s(3));
      strokeRect(c, x, y, tileSize, tileSize, "rgba(0,0,0,0.1)");
    });
    drawTile(2, 0, (c, x, y) => {
      c.fillStyle = "#f59e0b";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "rgba(255,255,255,0.2)";
      c.fillRect(x + s(3), y + s(4), s(4), s(2));
      c.fillRect(x + s(9), y + s(10), s(3), s(2));
      dot(c, x + s(6), y + s(12), s(1), "rgba(0,0,0,0.15)");
    });
    drawTile(3, 0, (c, x, y) => {
      c.fillStyle = "#9ca3af";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "rgba(255,255,255,0.25)";
      c.fillRect(x + s(3), y + s(3), s(6), s(4));
      c.fillRect(x + s(8), y + s(9), s(5), s(3));
      strokeRect(c, x, y, tileSize, tileSize, "rgba(0,0,0,0.08)");
    });
    drawTile(4, 0, (c, x, y) => {
      c.fillStyle = "#e5e7eb";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "rgba(0,0,0,0.06)";
      c.fillRect(x + s(2), y + s(2), s(5), s(2));
      c.fillRect(x + s(9), y + s(9), s(4), s(2));
      strokeRect(c, x, y, tileSize, tileSize, "rgba(0,0,0,0.06)");
    });
    drawTile(5, 0, (c, x, y) => {
      c.fillStyle = "#3b82f6";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.fillRect(x + s(2), y + s(6), s(11), s(2));
      c.fillRect(x + s(4), y + s(11), s(8), s(1));
    });
    drawTile(6, 0, (c, x, y) => {
      c.fillStyle = "#1d4ed8";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "rgba(255,255,255,0.25)";
      c.fillRect(x + s(3), y + s(5), s(10), s(2));
      c.fillRect(x + s(2), y + s(11), s(7), s(1));
    });
    drawTile(7, 0, (c, x, y) => {
      c.fillStyle = "#4b5563";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "#9ca3af";
      c.beginPath();
      c.moveTo(x + s(3), y + s(13));
      c.lineTo(x + s(8), y + s(3));
      c.lineTo(x + s(13), y + s(13));
      c.closePath();
      c.fill();
      c.fillStyle = "#6b7280";
      c.fillRect(x + s(6), y + s(11), s(4), s(3));
    });
    drawTile(0, 1, (c, x, y) => {
      c.fillStyle = "#ef4444";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "rgba(0,0,0,0.2)";
      c.beginPath();
      c.arc(x + s(8), y + s(9), s(5), 0, Math.PI * 2);
      c.fill();
      dot(c, x + s(6), y + s(6), s(2), "rgba(255,255,255,0.35)");
    });

    // features
    drawTile(1, 1, (c, x, y) => {
      c.fillStyle = "#22c55e";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "#064e3b";
      c.beginPath();
      c.arc(x + s(8), y + s(7), s(5), 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#7c3e1d";
      c.fillRect(x + s(7), y + s(10), s(2), s(4));
      dot(c, x + s(5), y + s(6), s(1), "rgba(255,255,255,0.25)");
    });
    drawTile(2, 1, (c, x, y) => {
      c.fillStyle = "#1f2937";
      c.fillRect(x, y, tileSize, tileSize);
      c.fillStyle = "#f97316";
      c.beginPath();
      c.arc(x + s(7), y + s(8), s(4), 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#facc15";
      c.beginPath();
      c.arc(x + s(10), y + s(6), s(3), 0, Math.PI * 2);
      c.fill();
    });

    // entities
    const drawUnit = (col: number, row: number, color: string, mark: string) => {
      drawTile(col, row, (c, x, y) => {
        c.fillStyle = "rgba(0,0,0,0)";
        c.fillRect(x, y, tileSize, tileSize);
        c.fillStyle = color;
        c.beginPath();
        c.arc(x + s(8), y + s(6), s(3), 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#111827";
        c.fillRect(x + s(6), y + s(9), s(4), s(5));
        c.fillStyle = "#fff";
        c.font = `${Math.max(10, Math.floor(s(7)))}px sans-serif`;
        c.fillText(mark, x + s(5), y + s(15));
      });
    };
    drawUnit(3, 1, "#60a5fa", "S");
    drawUnit(4, 1, "#8b5a2b", "W");
    drawUnit(5, 1, "#10b981", "A");
    drawUnit(6, 1, "#f97316", "X");
    drawUnit(7, 1, "#a855f7", "M");

    // house
    drawTile(0, 2, (c, x, y) => {
      c.fillStyle = "#7c4a2d";
      c.fillRect(x + s(2), y + s(7), s(12), s(7));
      c.fillStyle = "#5a2e12";
      c.beginPath();
      c.moveTo(x + s(2), y + s(7));
      c.lineTo(x + s(8), y + s(3));
      c.lineTo(x + s(14), y + s(7));
      c.closePath();
      c.fill();
      c.fillStyle = "#fef3c7";
      c.fillRect(x + s(7), y + s(10), s(2), s(3));
      c.fillStyle = "#a16207";
      c.fillRect(x + s(4), y + s(10), s(2), s(2));
    });

    return { image: canvas, tileSize, mapping };
  }, []);

  const getSprite = (group: "terrain" | "features" | "entities", id: number) => {
    const key = `${group}.${id}`;
    const mapping = atlas.mapping[key];
    if (!mapping) return null;
    return { image: atlas.image, mapping, w: mapping.w, h: mapping.h };
  };

  useEffect(() => {
    if (!spec || !terrain) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;

    const draw = () => {
      const { width, height } = spec.config.dimensions;
      const tileSize = spec.config.tile_size;
      canvas.width = width * tileSize;
      canvas.height = height * tileSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const now = performance.now();
      const t = Math.min(1, Math.max(0, (now - lastTickTimeRef.current) / Math.max(1, tickIntervalMs)));

      ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.x, camera.y);
      ctx.clearRect(-camera.x / camera.scale, -camera.y / camera.scale, canvas.width / camera.scale, canvas.height / camera.scale);

      const explored = buffers?.explored as Uint8Array | undefined;
      const isExplored = (idx: number) => !explored || explored[idx] !== 0;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          const id = terrain[idx];
          const sprite = getSprite("terrain", id);
          if (sprite) {
            const { image, mapping, w, h } = sprite;
            ctx.drawImage(
              image,
              mapping.x,
              mapping.y,
              w,
              h,
              x * tileSize,
              y * tileSize,
              tileSize,
              tileSize
            );
          } else {
            ctx.fillStyle = ID_COLORS[id] ?? "#333333";
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
          if (!isExplored(idx)) {
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
        }
      }

    if (buffers) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          if (!isExplored(idx)) continue;
          if (buffers.feature[idx] === 100) {
            const sprite = getSprite("features", 100);
            if (sprite) {
              const { image, mapping, w, h } = sprite;
              ctx.drawImage(
                image,
                mapping.x,
                mapping.y,
                w,
                h,
                x * tileSize,
                y * tileSize,
                tileSize,
                tileSize
              );
            } else {
              ctx.fillStyle = "#064e3b";
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
          }
          if (buffers.feature[idx] === 110) {
            const sprite = getSprite("features", 110);
            if (sprite) {
              const { image, mapping, w, h } = sprite;
              ctx.drawImage(
                image,
                mapping.x,
                mapping.y,
                w,
                h,
                x * tileSize,
                y * tileSize,
                tileSize,
                tileSize
              );
            } else {
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
    }

    if (buffers) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          if (!isExplored(idx)) continue;
          if (buffers.building[idx] === 300) {
            const owner = buildingOwners[idx] ?? 0;
            const teamColor = teamColors[owner % teamColors.length];
            const sprite = getSprite("entities", 300);
            if (sprite) {
              const { image, mapping, w, h } = sprite;
              ctx.drawImage(
                image,
                mapping.x,
                mapping.y,
                w,
                h,
                x * tileSize,
                y * tileSize,
                tileSize,
                tileSize
              );
            } else {
              ctx.fillStyle = "#8b5a2b";
              ctx.fillRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
              ctx.fillStyle = teamColor;
              ctx.font = "10px sans-serif";
              ctx.fillText("H", x * tileSize + tileSize / 2 - 3, y * tileSize + tileSize / 2 + 3);
            }
          }
        }
      }
    }

    if (buffers?.ownership) {
      const ownership = buffers.ownership as Uint8Array;
      ctx.lineWidth = 2;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          const owner = ownership[idx];
          if (owner === 0) continue;
          if (!isExplored(idx)) continue;
          const color = teamColors[owner % teamColors.length];
          ctx.strokeStyle = color;
          const px = x * tileSize;
          const py = y * tileSize;
          const rightIdx = x + 1 < width ? idx + 1 : -1;
          const downIdx = y + 1 < height ? idx + width : -1;
          if (x === 0) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + tileSize);
            ctx.stroke();
          }
          if (y === 0) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + tileSize, py);
            ctx.stroke();
          }
          if (rightIdx === -1 || ownership[rightIdx] !== owner) {
            ctx.beginPath();
            ctx.moveTo(px + tileSize, py);
            ctx.lineTo(px + tileSize, py + tileSize);
            ctx.stroke();
          }
          if (downIdx === -1 || ownership[downIdx] !== owner) {
            ctx.beginPath();
            ctx.moveTo(px, py + tileSize);
            ctx.lineTo(px + tileSize, py + tileSize);
            ctx.stroke();
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

    if (attackLines.length > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      for (const line of attackLines) {
        const [sx, sy] = line.from;
        const [tx, ty] = line.to;
        ctx.beginPath();
        ctx.moveTo(sx * tileSize + tileSize / 2, sy * tileSize + tileSize / 2);
        ctx.lineTo(tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2);
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
          const prev = prevPositionsRef.current.get(i);
          const targetX = xs[i];
          const targetY = ys[i];
          const interpX = prev ? prev.x + (targetX - prev.x) * t : targetX;
          const interpY = prev ? prev.y + (targetY - prev.y) * t : targetY;
          const px = interpX * tileSize;
          const py = interpY * tileSize;
          const faction = buffers.entities.faction_id as Uint8Array | undefined;
          const teamColor = faction ? teamColors[faction[i] % teamColors.length] : "#ffffff";
          const idx = (Math.floor(targetY) * width) + Math.floor(targetX);
          if (explored && explored[idx] === 0) {
            continue;
          }
          if (types && (types[i] === 201 || types[i] === 200 || types[i] === 202 || types[i] === 203 || types[i] === 204 || types[i] === 210)) {
            const sprite = getSprite("entities", types[i]);
            if (sprite) {
              const { image, mapping, w, h } = sprite;
              ctx.drawImage(image, mapping.x, mapping.y, w, h, px, py, tileSize, tileSize);
            } else {
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
            }
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

          if (selectedEntityId !== null && selectedEntityId === i) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
            ctx.strokeStyle = `rgba(255,255,0,${0.4 + 0.4 * pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(
              px + tileSize / 2,
              py + tileSize / 2,
              tileSize / 2.2,
              tileSize / 3,
              0,
              0,
              Math.PI * 2
            );
            ctx.stroke();
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
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [spec, terrain, buffers, unitBehaviorSpec, paths, buildingOwners, attackLines, godTool, hover, camera, tickIntervalMs, selectedEntityId]);

  useEffect(() => {
    lastTickTimeRef.current = performance.now();
    if (!buffers) return;
    const ids = buffers.entities.id as Uint32Array | undefined;
    const xs = buffers.entities.x as Uint16Array | undefined;
    const ys = buffers.entities.y as Uint16Array | undefined;
    if (!ids || !xs || !ys) return;
    const next = new Map<number, { x: number; y: number }>();
    for (let i = 0; i < ids.length; i += 1) {
      if (ids[i] === 0) continue;
      next.set(i, { x: xs[i], y: ys[i] });
    }
    prevPositionsRef.current = next;
  }, [tick, buffers]);

  useEffect(() => {
    if (!cameraTarget || !spec) return;
    const tileSize = spec.config.tile_size;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const centerX = rect ? rect.width / 2 : tileSize;
    const centerY = rect ? rect.height / 2 : tileSize;
    setCamera((prev) => ({
      ...prev,
      x: -cameraTarget.x * tileSize * prev.scale + centerX,
      y: -cameraTarget.y * tileSize * prev.scale + centerY
    }));
    setCameraTarget(null);
  }, [cameraTarget, spec, setCameraTarget]);

  const tileFromEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!spec || !buffers) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const worldX = ((event.clientX - rect.left) * scaleX - camera.x) / camera.scale;
    const worldY = ((event.clientY - rect.top) * scaleY - camera.y) / camera.scale;
    const x = Math.floor(worldX / spec.config.tile_size);
    const y = Math.floor(worldY / spec.config.tile_size);
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

  const handleContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!worker || selectedEntityId === null) return;
    event.preventDefault();
    const tile = tileFromEvent(event);
    if (!tile) return;
    worker.postMessage({
      type: "set_forced_target",
      entityId: selectedEntityId,
      x: tile.x,
      y: tile.y
    });
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
    if (!godTool.tool && event.button === 0) {
      dragRef.current = { x: event.clientX, y: event.clientY, startX: camera.x, startY: camera.y, dragging: true };
      return;
    }
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
    if (dragRef.current?.dragging && !godTool.tool) {
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      setCamera((prev) => ({ ...prev, x: dragRef.current!.startX + dx, y: dragRef.current!.startY + dy }));
    }
    if (!isPaintingRef.current || !godTool.tool) return;
    const tile = tileFromEvent(event);
    if (!tile) return;
    const key = `${tile.x},${tile.y},${godTool.tool},${godTool.brushSize}`;
    if (lastPaintRef.current !== key) {
      lastPaintRef.current = key;
      sendBrushMutation(tile.x, tile.y);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      setCamera((prev) => {
        const nextScale = Math.min(3, Math.max(0.5, prev.scale + delta));
        return { ...prev, scale: nextScale };
      });
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onContextMenu={handleContextMenu}
        onMouseUp={() => {
          isPaintingRef.current = false;
          lastPaintRef.current = null;
          if (dragRef.current) dragRef.current.dragging = false;
        }}
        onMouseLeave={() => {
          isPaintingRef.current = false;
          lastPaintRef.current = null;
          if (dragRef.current) dragRef.current.dragging = false;
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
