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
import AbilityExtras, { selectionsOf } from "./ability-extras.mjs";
import { createAbilitySheet } from "./ability-sheet.mjs";
import { rankOf, scalesFor, targetOf, rollsOf, rollAbility } from "./ability-rolls.mjs";
import { registerRollWrap } from "./roll-wrap.mjs";

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
    // Rank and target semantics, exposed because a consumer MUST NOT
    // re-derive them. What a count means is per-ability and changing (see
    // README, "qty is not the effective rank"), so a module that reads
    // extras.qty and treats it as rank will be wrong for every ability that
    // spends its count on a list rather than a rank. Ask here instead.
    rankOf,
    scalesFor,
    targetOf,
    // Every roll an ability offers, in one shape — this module's store, with
    // core's singleton folded in when it has not been edited here yet. THE read
    // path: never assemble an ability's rolls from `system.roll` yourself, or
    // you will see one throw where the book prints four.
    rollsOf,
    /** Roll one of them by key (omit the key for the first). */
    rollAbility,
    // The picks a character's copy records (Martial Training's weapon group,
    // Fighting Style Specialization's style, …). Reads the stored `selections`
    // array and absorbs the legacy "(X)" name-suffix convention — consumers
    // must never parse item names themselves.
    selectionsOf,
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
    foundry.applications.handlebars.loadTemplates([
      `modules/${MODULE_ID}/templates/tab-mechanics.hbs`,
      // Resolved dynamically by core's description.hbs, so it must be
      // pre-registered — a partial reached through a context function is not
      // discovered by the part loader.
      `modules/${MODULE_ID}/templates/details-ability.hbs`,
    ]);
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
  // Core's ability roller reaches only the FIRST roll. Wrapping it is what
  // makes the character sheet, the chat card and `item.use()` agree with this
  // module's sheet instead of quietly rolling something else.
  registerRollWrap();

  AcksAbilitySheet = createAbilitySheet(Base);
  // DEFAULT, because a sheet nobody selects shows nobody the mechanics — which
  // is the entire point of this module. Safe to default: it SUBCLASSES the
  // system's own ability sheet and keeps every tab it defines, so enabling this
  // module adds the Mechanics tab and takes nothing away. A GM who prefers the
  // plain sheet can still pick it per item in the sheet config.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, MODULE_ID, AcksAbilitySheet, {
    types: [ABILITY_TYPE],
    makeDefault: true,
    label: game.i18n.localize("ACKS-ABILITIES.sheet.ability"),
  });
  console.log(`${MODULE_ID} | ACKS Ability sheet registered (default for ${ABILITY_TYPE} items).`);
});
