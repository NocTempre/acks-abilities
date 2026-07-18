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
import { createAbilitySheet } from "./ability-sheet.mjs";

/** The dynamically-created sheet class (base is resolved at ready). */
let AcksAbilitySheet = null;

/** Resolve the system's default `ability` item sheet — our base to extend. */
function resolveAbilitySheetBase() {
  const registered = CONFIG.Item?.sheetClasses?.[ABILITY_TYPE] ?? {};
  const entries = Object.values(registered);
  return entries.find((e) => e.default)?.cls ?? entries[0]?.cls ?? null;
}

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
    get AcksAbilitySheet() {
      return AcksAbilitySheet;
    },
  };
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;
  globalThis.acksAbilities = api;

  if (!globalThis.acksLib) {
    console.warn(`${MODULE_ID} | acks-lib not found — the effect vocabulary is unavailable; enable acks-lib.`);
  }
  // Best-effort template preload (the base sheet's own parts preload with the system).
  try {
    foundry.applications.handlebars.loadTemplates([`modules/${MODULE_ID}/templates/tab-mechanics.hbs`]);
  } catch (err) {
    console.warn(`${MODULE_ID} | template preload skipped`, err);
  }
  console.log(`${MODULE_ID} | initialised (ability effect model ready)`);
});

/*
 * Sheet registration happens at READY, not init: Foundry defers every
 * DocumentSheetConfig.registerSheet call made before `game.ready` into a pending
 * queue, so CONFIG.Item.sheetClasses is EMPTY during init and the system's
 * ability sheet — our base class — can only be resolved here.
 */
Hooks.once("ready", () => {
  if (game.system?.id !== "acks") {
    console.warn(`${MODULE_ID} | active system is not "acks"; the ACKS Ability sheet expects acks ability items.`);
    return;
  }
  const Base = resolveAbilitySheetBase();
  if (!Base) {
    console.error(`${MODULE_ID} | could not resolve the acks ability sheet; ACKS Ability sheet NOT registered.`);
    return;
  }
  AcksAbilitySheet = createAbilitySheet(Base);
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, MODULE_ID, AcksAbilitySheet, {
    types: [ABILITY_TYPE],
    makeDefault: false,
    label: game.i18n.localize("ACKS-ABILITIES.sheet.ability"),
  });
  console.log(`${MODULE_ID} | ACKS Ability sheet registered.`);
});
