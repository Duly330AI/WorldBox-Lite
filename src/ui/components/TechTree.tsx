import { useMemo } from "react";
import { useWorldStore } from "../store";

const factionLabels: Record<number, string> = {
  0: "Rot",
  1: "Blau"
};

export function TechTree() {
  const techSpec = useWorldStore((s) => s.techSpec);
  const research = useWorldStore((s) => s.research);
  const worker = useWorldStore((s) => s.worker);

  const techEntries = useMemo(() => {
    if (!techSpec) return [] as Array<[string, { id: number; cost: number; prerequisites: string[] }]>;
    return Object.entries(techSpec.techs).map(([key, value]) => [key, value]);
  }, [techSpec]);

  const factionId = 0;
  const state = research[factionId];
  const current = state?.current ?? null;
  const progress = state?.progress ?? 0;
  const cost = state?.cost ?? 0;
  const known = new Set(state?.known ?? []);

  const handlePick = (techId: string) => {
    if (!worker) return;
    worker.postMessage({ type: "set_research_target", factionId, techId });
  };

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 8,
        padding: 12,
        background: "#fafafa"
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Tech Tree ({factionLabels[factionId] ?? `F${factionId}`})</div>
      {current ? (
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          Aktuell: {current} ({progress}/{cost})
          <div
            style={{
              height: 6,
              background: "#e5e7eb",
              borderRadius: 4,
              marginTop: 6,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                width: cost > 0 ? `${Math.min(100, (progress / cost) * 100)}%` : "0%",
                height: "100%",
                background: "#22c55e"
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, marginBottom: 8, color: "#666" }}>Keine Forschung aktiv.</div>
      )}
      <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {techEntries.map(([key, def]) => {
          const done = known.has(key);
          const disabled = done;
          return (
            <button
              key={key}
              onClick={() => handlePick(key)}
              disabled={disabled}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                fontSize: 12,
                border: "1px solid #333",
                borderRadius: 6,
                background: done ? "#d1fae5" : "#fff",
                color: done ? "#065f46" : "#111",
                cursor: disabled ? "default" : "pointer"
              }}
            >
              {key} (cost {def.cost})
            </button>
          );
        })}
      </div>
    </div>
  );
}
