import { useWorldStore } from "../store";

export function EventLog() {
  const events = useWorldStore((s) => s.events);
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
      {events.length === 0 ? (
        <div style={{ color: "#666" }}>No events yet.</div>
      ) : (
        events
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
