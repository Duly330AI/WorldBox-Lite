# PROJECT_TODO

## Phase 9 & 10 – Visualisierung, Interaktion & Kern-Loop
- [x] Terrain-Mapping in `WorldCanvas.tsx` mit exakten Farben (IDs 0,1,5,7)
- [x] Feature-Rendering: Wald (id 100) als dunkle Kreise (#064e3b)
- [x] Entity-Rendering: Worker (Type 201) als brauner Kreis mit weißem Rahmen
- [x] Seeding-Update: Forest-Cluster (Gruppen 5–10 Tiles)
- [x] Debug-Overlay: Progress-Bar + Action-Kürzel über der Einheit
- [x] Event-Log-Panel (letzte 20 Events, AI_PLAN_CHANGE/UNIT_ACTION hervorgehoben)
- [x] Manual Spawning: Button "Spawn Test-Worker"
- [x] Path-Visualisierung als dünne Linien
- [x] Unit Inspector (Stats, Goal/Plan, Action-Progress)
- [x] Home-Base Logic (home_x/home_y pro Faktion, Build-House nahe Home)
- [x] Resource Exhaustion: nächste Wald-Cluster werden gesucht
- [ ] Logging-Flush-Intervall aus `logging_spec.json` beziehen
- [ ] Buffer-Access über definierte Offsets (state_spec-konform, explizite Access-API)

## Notes
- `logging_spec.json` fehlt noch, um `flush_interval_ticks` zu nutzen.
