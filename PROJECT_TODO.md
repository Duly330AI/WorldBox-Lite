# PROJECT_TODO

## Phase 9 & 10 – Visualisierung, Interaktion & Kern-Loop
- [x] Terrain-Mapping in `WorldCanvas.tsx` mit exakten Farben (IDs 0,1,5,7)
- [x] Feature-Rendering: Wald (id 100) als dunkle Kreise (#064e3b)
- [x] Entity-Rendering: Worker (Type 201) als brauner Kreis mit weißem Rahmen
- [x] Seeding-Update: Forest-Cluster (Gruppen 5–10 Tiles)
- [x] Debug-Overlay: Progress-Bar + Action-Kürzel über der Einheit
- [x] Event-Log-Panel (letzte 20 Events, AI_PLAN_CHANGE/UNIT_ACTION/ECONOMY_UPDATE hervorgehoben)
- [x] Manual Spawning: Button "Spawn Test-Worker"
- [x] Path-Visualisierung als dünne Linien
- [x] Unit Inspector (Stats, Goal/Plan, Action-Progress)
- [x] Home-Base Logic (home_x/home_y pro Faktion, Build-House nahe Home)
- [x] Resource Exhaustion: nächste Wald-Cluster werden gesucht

## Phase 11 & 12 – Zivilisation & Kreislauf
- [x] logging_spec.json + Schema + AJV Integration
- [x] StateView Access-Layer (StateView.ts)
- [x] Hunger-Tick (alle 5 Ticks +1)
- [x] Nutrition-Goal treibt GATHER_FOOD (Utility via hunger)
- [x] BUILD_HOUSE: nahe Home-Base, Holzverbrauch, building_buffer=300
- [x] House-Logic: alle 50 Ticks Worker-Spawn bis Limit
- [x] Building-Rendering (H-Symbol)
- [x] Global Dashboard (Faktion Rot: Menschen/Häuser/Holz)
- [x] Buffer-Zugriffe vollständig über StateView abstrahieren

## Phase 13, 14 & 15 – Krieg, Tod & Konsolidierung
- [x] combat_spec.json + Schema + AJV Integration
- [x] entity_spec.json + Schema + AJV Integration
- [x] Multi-Fraktions-Setup (2 Factions, 2 Worker + 1 Scout je Faction)
- [x] Kampfsystem (ATTACK, Schaden, UNIT_DIED)
- [x] Hate-Matrix + Gefahrenzonen im Pathfinding
- [x] Dashboard: Population & Militärstärke für beide Factions
- [x] EventLog Filter nach Leveln (INFO/DECISION/COMBAT)
- [x] CI Workflow (GitHub Actions: npm test)

## Phase 16, 17 & 18 – Natur, Taktik & Aggression
- [x] Combat-Counters in Schadensformel integriert
- [x] Waldwachstum, Feuer-Ausbreitung, Lava-Hitze im World-Loop
- [x] explored_buffer (Bitmask) + Fog-of-War Basis
- [x] Aggressions-Goals (DEFEND, ATTACK_ORDER) + Utility-Formeln
- [x] Team-Farben für Einheiten/Häuser, Health-Bars, Feuer-Rendering

## Phase 19, 20 & 21 – Gott-Modus, Sieg & Profiling
- [x] simulation_spec.json + Schema + Loader
- [x] Victory-System (Conquest) + MATCH_OVER Event
- [x] Final Knowledge Snapshot + Knowledge Viewer (Top-3)
- [x] God-Tools Brush-System (Lava/Forest/Water/Ignite)
- [x] PERF_STATS (avg_tick_ms, entity_count, pathfinding_calls)
- [x] Natur-Tests (fire, lava, treeGrowth)

## Notes
- combat_spec wird geladen und verwendet.
