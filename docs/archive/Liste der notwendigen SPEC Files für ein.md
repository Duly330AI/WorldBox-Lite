Liste der notwendigen SPEC Files für ein selbstlernendes Civilization‑/WorldBox‑Projekt
1️⃣ world_spec.json

Beschreibung: Definition der Weltkarte, Tiles, Terrain, Startbedingungen

Enthält: Größe der Welt, Terrainarten, Ressourcenarten, Tile-Effekte, Startpositionen der Völker

Ziel: Grundlage für alles – KI, Ressourcen, Einheiten

Abhängigkeiten: Alle anderen SPECs beziehen sich auf die Tiles/Map

2️⃣ entity_spec.json

Beschreibung: Definition aller Entitäten

Enthält:

Einheiten (Arbeiter, Militär, Späher, Spezial)

Gebäude

Ressourcen (Nahrung, Gold, Produktion, Energie)

Population-Objekte (Städte, Völker)

Ziel: Ermöglicht dem Agent, Objekte zu instanziieren, zu verschieben, zu verwalten

3️⃣ ai_agent_spec.json

Beschreibung: Verhalten und Entscheidungslogik der KI

Enthält:

Erkundung/Scouting-Strategien

Ressourcenmanagement (Sammeln, Verbrauch, Handel)

Bevölkerung und Einheitenmanagement

Militärische Taktiken

Lernfähige Logik (RL / Heuristiken)

Adaptive Forschung & Tech-Auswahl

Ziel: Kern-KI, die eigenständig Entscheidungen trifft

Abhängigkeiten: world_spec.json, entity_spec.json, tech_spec.json

4️⃣ tech_spec.json

Beschreibung: Technologiebaum (Tech Tree)

Enthält:

Alle Advances/Techs inkl. Era, Kategorie, Prerequisites

Unlocks: Einheiten, Gebäude, Wunder

Ziel: KI kann Technologien erforschen, strategisch priorisieren

5️⃣ simulation_spec.json

Beschreibung: Regeln für Simulationsschritte

Enthält:

Schrittweite (tick interval)

Ressourcensimulation (Ernte, Produktion, Verbrauch)

Ereignisse (Naturkatastrophen, zufällige Ereignisse)

Interaktionen zwischen KI und Welt

Ziel: Engine für Echtzeit-/Turn-basiertes Spiel

6️⃣ unit_behavior_spec.json

Beschreibung: Detaillierte Aktionen von Einheiten

Enthält:

Bewegung, Angriff, Aufbau, Spionage, Heilung

Terrainabhängigkeit, Reichweite, Sichtweite

Priorisierung von Aufgaben (z. B. Arbeiter vs. Militär)

Ziel: Realistische Simulation auf Tile-Ebene

7️⃣ city_spec.json

Beschreibung: Städte/Population & Wachstum

Enthält:

Bevölkerungswachstum

Ressourcenproduktion, Konsum

Stadtgebäude, Wunder, Arbeitszuweisung

Happiness/Satisfaction (optional)

Ziel: Städte als autonome Einheiten verwalten

8️⃣ event_spec.json

Beschreibung: Ereignisse & Quests

Enthält:

Naturkatastrophen (Flut, Dürre, Vulkanausbruch)

Militärische Konflikte

Technologieboni oder Forschungsausfälle

Ziel: Komplexität und Dynamik in die Simulation bringen

9️⃣ logging_spec.json

Beschreibung: Alles, was die KI oder Simulation protokolliert

Enthält:

Aktionen der KI

Ressourcenflüsse

Forschungsergebnisse

Kampf-/Einheitenaktionen

Ziel: Monitoring und Debugging, auch für Trainingsdaten

10️⃣ visualization_spec.json (optional)

Beschreibung: Darstellung der Welt, Städte, Einheiten, Ressourcen

Enthält:

Tilefarben, Icons für Einheiten und Gebäude

Animationen, Map-Rendering

Ziel: Agent kann Simulation visuell überprüfen

💡 Empfehlungen für den VS Code Agent

Modularer Aufbau:

Jedes SPEC-File unabhängig erstellen → einfaches Austauschen oder Updaten

Abhängigkeiten beachten:

world_spec.json → entity_spec.json → tech_spec.json → ai_agent_spec.json

simulation_spec.json & unit_behavior_spec.json greifen auf alle vorherigen Specs zu

KI-Lernschleifen:

Reinforcement Learning oder Heuristiken in ai_agent_spec.json

Feedback aus logging_spec.json

Start einfach:

Zuerst Lite-Version mit minimaler Welt & Einheiten

Danach Schrittweise Komplexität erhöhen

Validierung:

Jedes SPEC-File sollte Test-Simulationen bestehen können

Logs und Visualisierung helfen bei Debugging

"