/**
 * ACKS II — Abilities.
 *
 * Extends the core `ability` item (proficiencies / class powers / skills /
 * monster abilities) with a structured, level-aware EFFECT model stored at
 * `flags["acks-abilities"].extras` (see ability-extras.mjs) and — later — an
 * alternate ability sheet to view/edit it. Nothing mutates the acks system;
 * the effect vocabulary comes from acks-lib.
 */
import { MODULE_ID, FLAG_EXTRAS, ABILITY_TYPE } from "./constants.mjs";
import AbilityExtras from "./ability-extras.mjs";

Hooks.once("init", () => {
  // Public API for consumer modules (acks-content writes this flag on import;
  // other modules read the effect model to drive automation).
  const api = {
    MODULE_ID,
    FLAG_EXTRAS,
    ABILITY_TYPE,
    AbilityExtras,
    /** Read the extended effect model for an ability item (an AbilityExtras instance). */
    getExtras: (item) => AbilityExtras.fromItem(item),
  };
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;
  globalThis.acksAbilities = api;

  if (!globalThis.acksLib) {
    console.warn(`${MODULE_ID} | acks-lib not found — the effect vocabulary is unavailable; enable acks-lib.`);
  }
  console.log(`${MODULE_ID} | initialised (ability effect model ready)`);
});
