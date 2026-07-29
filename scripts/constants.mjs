export const MODULE_ID = "acks-abilities";
export const LANG_PREFIX = "ACKS-ABILITIES";

/**
 * Namespacing (see acks-module-template docs/TOOLCHAIN.md — enforced by
 * tools/validate.mjs): identifiers in shared registries carry the module key.
 * MODULE_KEY prefixes pack document _ids (declared in module.json
 * flags.acks-abilities.idPrefix); NAMESPACE prefixes globalThis exposures,
 * custom hook names, and Handlebars helpers.
 */
export const MODULE_KEY = "acksAbil";
export const NAMESPACE = "acksAbilities";

/** The core `ability` item type this module extends (proficiencies/powers/skills). */
export const ABILITY_TYPE = "ability";
/** Flag key under flags["acks-abilities"] holding the extended effect model. */
export const FLAG_EXTRAS = "extras";

/**
 * Client setting: show the higher edit level on the Mechanics tab.
 *
 * Editing an effect's scope is an ordinary document change — the value
 * changes, and the next "Update Abilities" regenerates it from the cookbook
 * like every other generated value. That is the default and it needs no
 * ceremony.
 *
 * Deciding that a particular change should SURVIVE re-import is a different
 * act, made per edit and rarely. Turning this on reveals the per-row control
 * that makes that decision; it is off by default so the sheet does not invite
 * it, and it is per-user because it is about how you work, not about the world.
 */
export const SETTING_ADVANCED_EDIT = "advancedEffectEdit";
