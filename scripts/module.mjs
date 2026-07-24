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
import { rankOf, scalesFor, targetOf } from "./ability-rolls.mjs";

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
/**
 * Move rolls out of this module's flag and into `system.rolls`.
 *
 * They lived in the flag because the core ability item could hold exactly one
 * roll. It now holds all of them, so the flag copy is redundant — and a second
 * copy of the same data is how the sheet and the roller came to disagree.
 * Runs once per world: an item whose flag still carries rolls is rewritten, and
 * the flag key is unset so it cannot drift again.
 *
 * Only fills `system.rolls` when it is EMPTY. If the system already holds rolls
 * for that item, the system's copy is authoritative and the flag is discarded.
 */
async function migrateRollsToSystem() {
  if (!game.user.isGM) return 0;

  const stale = game.items.filter((i) => i.type === ABILITY_TYPE && (i.getFlag(MODULE_ID, FLAG_EXTRAS)?.rolls ?? []).length);
  const embedded = game.actors.flatMap((a) =>
    a.items.filter((i) => i.type === ABILITY_TYPE && (i.getFlag(MODULE_ID, FLAG_EXTRAS)?.rolls ?? []).length),
  );

  let moved = 0;
  for (const item of [...stale, ...embedded]) {
    const rolls = item.getFlag(MODULE_ID, FLAG_EXTRAS)?.rolls ?? [];
    try {
      // Write the rolls FIRST, then drop the flag copy — so an interrupted
      // migration leaves the data duplicated (harmless, retried next load)
      // rather than deleted.
      if (!(item.system.rolls ?? []).length) await item.update({ "system.rolls": rolls });
      await item.unsetFlag(MODULE_ID, `${FLAG_EXTRAS}.rolls`);
      moved++;
    } catch (err) {
      console.warn(`${MODULE_ID} | could not move rolls for "${item.name}"`, err);
    }
  }
  if (moved) console.log(`${MODULE_ID} | moved rolls into system.rolls on ${moved} item(s).`);
  return moved;
}

Hooks.once("ready", async () => {
  if (game.system?.id !== "acks") {
    console.warn(`${MODULE_ID} | active system is not "acks"; the ACKS Ability sheet expects acks ability items.`);
    return;
  }
  await migrateRollsToSystem();

  const Base = resolveAbilitySheetBase();
  if (!Base) {
    console.error(`${MODULE_ID} | could not resolve the acks ability sheet; ACKS Ability sheet NOT registered.`);
    return;
  }
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
