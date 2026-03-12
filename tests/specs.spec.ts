import { describe, expect, it } from "vitest";
import Ajv from "ajv/dist/2020";
import worldSchema from "../src/specs/schemas/world_spec.schema.json";
import stateSchema from "../src/specs/schemas/state_spec.schema.json";
import techSchema from "../src/specs/schemas/tech_spec.schema.json";
import unitBehaviorSchema from "../src/specs/schemas/unit_behavior_spec.schema.json";
import loggingSchema from "../src/specs/schemas/logging_spec.schema.json";
import combatSchema from "../src/specs/schemas/combat_spec.schema.json";
import entitySchema from "../src/specs/schemas/entity_spec.schema.json";
import worldSpec from "../specs/world_spec.json";
import stateSpec from "../specs/state_spec.json";
import techSpec from "../specs/tech_spec.json";
import unitBehaviorSpec from "../specs/unit_behavior_spec.json";
import loggingSpec from "../specs/logging_spec.json";
import combatSpec from "../specs/combat_spec.json";
import entitySpec from "../specs/entity_spec.json";

const ajv = new Ajv({ allErrors: true, strict: true });

describe("Spec validation", () => {
  it("world_spec validates", () => {
    const validate = ajv.compile(worldSchema);
    expect(validate(worldSpec)).toBe(true);
  });

  it("state_spec validates", () => {
    const validate = ajv.compile(stateSchema);
    expect(validate(stateSpec)).toBe(true);
  });

  it("tech_spec validates", () => {
    const validate = ajv.compile(techSchema);
    expect(validate(techSpec)).toBe(true);
  });

  it("unit_behavior_spec validates", () => {
    const validate = ajv.compile(unitBehaviorSchema);
    expect(validate(unitBehaviorSpec)).toBe(true);
  });

  it("logging_spec validates", () => {
    const validate = ajv.compile(loggingSchema);
    expect(validate(loggingSpec)).toBe(true);
  });

  it("combat_spec validates", () => {
    const validate = ajv.compile(combatSchema);
    expect(validate(combatSpec)).toBe(true);
  });

  it("entity_spec validates", () => {
    const validate = ajv.compile(entitySchema);
    expect(validate(entitySpec)).toBe(true);
  });
});
