Hier ist die building_spec.json. Sie ist darauf ausgelegt, dass ein AI-Agent die Abhängigkeiten zwischen den freigeschalteten Technologien (aus deinem Tech-Tree) und den Bauprojekten (Städte/Produktion) direkt zuordnen kann.

2️⃣ building_spec.json
code
JSON
download
content_copy
expand_less
{
  "spec_id": "civ_buildings_v1",
  "version": "1.0",
  "description": "Definition aller baubaren Gebäude und deren Abhängigkeiten aus der Civilization IV Spezifikation.",
  "buildings": {
    "farm": { "cost": 60, "required_tech": "agriculture", "effect": { "food": 1 } },
    "mine": { "cost": 50, "required_tech": "mining", "effect": { "production": 1 } },
    "granary": { "cost": 60, "required_tech": "pottery", "effect": { "food_bonus": 2 } },
    "cottage": { "cost": 60, "required_tech": "pottery", "effect": { "commerce": 1 } },
    "library": { "cost": 90, "required_tech": "writing", "effect": { "beakers": 2 } },
    "forge": { "cost": 120, "required_tech": "metal_casting", "effect": { "production_bonus": 0.25 } },
    "courthouse": { "cost": 120, "required_tech": "code_of_laws", "effect": { "maintenance_reduction": 0.5 } },
    "bank": { "cost": 150, "required_tech": "banking", "effect": { "gold_bonus": 0.5 } },
    "factory": { "cost": 200, "required_tech": "assembly_line", "effect": { "production_bonus": 0.5 } },
    "nuclear_plant": { "cost": 300, "required_tech": "fission", "effect": { "production_bonus": 1.0 } },
    "hospital": { "cost": 250, "required_tech": "medicine", "effect": { "health_bonus": 3 } },
    "laboratory": { "cost": 250, "required_tech": "computers", "effect": { "beakers_bonus": 0.25 } },
    "hydro_plant": { "cost": 200, "required_tech": "plastics", "effect": { "production_bonus": 0.5 } }
  },
  "global_building_rules": {
    "can_build_multiple": false,
    "maintenance_cost_factor": 0.1,
    "requires_population": 1
  }
}
Wie der VS Code Agent das nutzen wird:

Bau-Validierung: Der Agent schreibt eine Methode canBuild(buildingName, cityState), die prüft:

Ist die required_tech bereits im WorldState der Fraktion erforscht?

Ist die Stadt groß genug (requires_population)?

Verfügt die Stadt über genug production (Hammer-Icon aus deinem Bild)?

KI-Wirtschaftsplanung: Der Agent sieht in der ai_agent_spec.json, dass ein granary (Kornkammer) Nahrung generiert. Wenn die KI-Fraktion ein SURVIVE- oder GROWTH-Goal hat, wird der Agent nun automatisch das granary als nächste Priorität in die build_queue der Stadt setzen.

Modularität: Falls du später ein Gebäude hinzufügen willst (wie "Colosseum" oder "Market"), musst du nur eine Zeile in dieses JSON einfügen – der Agent erkennt das automatisch und baut es in die Baumenüs ein.

Wie geht es weiter?

Damit die Simulation vollständig ist, brauchen wir nun das "Militär" und die "Spezialisten".
