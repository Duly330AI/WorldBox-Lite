import { useEffect, useState } from "react";
import { useWorldStore } from "../store";

export function EventLog() {
  const events = useWorldStore((s) => s.events);
  const loggingSpec = useWorldStore((s) => s.loggingSpec);
  const levels = loggingSpec?.config.levels ?? ["INFO", "DECISION", "COMBAT", "ECONOMY"];
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const level of levels) next[level] = true;
    setEnabled(next);
  }, [levels.join(",")]);

  const toggle = (level: string) => {
    if (level === "COMBAT") return;
    setEnabled((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const filtered = events.filter((e) => {
    const level = String(e.level ?? "INFO");
    if (level === "COMBAT") return true;
    return enabled[level] ?? true;
  });
  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 8,
        padding: 12,
        maxHeight: 260,
        overflowY: "auto",
        background: "#fafafa"
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Event Log</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {levels.map((level) => (
          <label key={level} style={{ fontSize: 11, cursor: level === "COMBAT" ? "default" : "pointer" }}>
            <input
              type="checkbox"
              checked={enabled[level] ?? true}
              onChange={() => toggle(level)}
              disabled={level === "COMBAT"}
              style={{ marginRight: 4 }}
            />
            {level}
          </label>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ color: "#666" }}>No events yet.</div>
      ) : (
        filtered
          .slice()
          .reverse()
          .map((e, idx) => {
            const type = String(e.event_type ?? "event");
            const highlight =
              type === "AI_PLAN_CHANGE" || type === "UNIT_ACTION" || type === "ECONOMY_UPDATE";
            return (
              <div
                key={idx}
                style={{
                  fontSize: 12,
                  padding: "4px 0",
                  color: highlight ? "#0b5" : "#333"
                }}
              >
                <span style={{ fontWeight: 600 }}>{type}</span>
                {typeof e.tick !== "undefined" ? ` • t:${String(e.tick)}` : ""}
                {e.action ? ` • ${String(e.action)}` : ""}
                {e.goal ? ` • ${String(e.goal)}` : ""}
                {typeof e.entity_id !== "undefined" ? ` • ent:${String(e.entity_id)}` : ""}
              </div>
            );
          })
      )}
    </div>
  );
}
