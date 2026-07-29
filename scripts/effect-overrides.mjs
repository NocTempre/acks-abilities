/* global foundry, Hooks, game */
/**
 * Making an effect conditional (or unconditional) from the sheet.
 *
 * The primary thing is small: an effect's SCOPE is an editable field, so a
 * table that reads "+1 to AC and +1 to saves against evil creatures" as
 * scoping only the saves flips one control and moves on. No re-extraction, no
 * cookbook edit, no release. That is a plain document edit and it needs
 * nothing in this file.
 *
 * What IS here is the opt-in half, decided PER EDIT.
 *
 * ## Why persistence is a per-edit decision, not a behaviour
 *
 * acks-content's "Update Abilities" regenerates every ability from the
 * cookbook and the seat's own book — that is its job. So a hand edit is
 * normally temporary, exactly like every other generated value, and that is
 * the honest default: the book is the source, and refreshing from the book
 * gets you the book.
 *
 * Occasionally a table makes a real ruling it wants to keep. Then, and only
 * then, that ONE row is pinned as an import override: recorded here and
 * re-applied after regeneration. It is a per-row decision made at a higher
 * edit level the user engages deliberately (SETTING_ADVANCED_EDIT), never
 * something that happens because someone typed in a field — which is why
 * nothing in this file is consulted unless a record already exists, and a
 * record can only exist because someone asked for one.
 *
 * ## Why the effects array is rewritten either way
 *
 * The alternative — keep the generated effects pristine and merge edits at
 * read time — breaks the family's contract. acks-influence (and the
 * acks-equipment bridge) read `flags["acks-abilities"].extras.effects[]` as
 * PLAIN DATA and deliberately do not require this module: "readable whether or
 * not the sheet is installed". A read-time layer would be invisible to exactly
 * the consumers that turn an effect into a die roll, so a GM would flip a
 * condition and watch the roller ignore it.
 *
 * So `extras.effects` always holds the effective values and every existing
 * consumer keeps working unchanged. The record is a SEPARATE flag that only
 * exists to survive regeneration:
 *
 *   flags["acks-abilities"].overrides = { "<key>": { set: {…}, was: {…} } }
 *
 * ## A recorded edit is not the book
 *
 * Same doctrine as the unaudited banner: a local ruling must never read as the
 * printed one. A recorded row is marked on the sheet and carries a reset, and
 * `orphanedKeys()` reports records whose effect no longer exists rather than
 * dropping them silently. Un-recorded edits get no marker, because there is
 * nothing persistent to disclose.
 */
import { MODULE_ID, FLAG_EXTRAS, SETTING_ADVANCED_EDIT } from "./constants.mjs";

/**
 * Is the higher edit level showing for this user?
 *
 * Only governs whether the pin control is VISIBLE. Records already made keep
 * working with it off — hiding a control must not quietly revoke decisions
 * made with it. Defensive: absent during early init and in a test harness,
 * where the honest answer is "no".
 */
export function advancedEditEnabled() {
  try {
    return !!game.settings.get(MODULE_ID, SETTING_ADVANCED_EDIT);
  } catch {
    return false;
  }
}

/** Flag key under flags["acks-abilities"] holding the override record. */
export const FLAG_OVERRIDES = "overrides";

/**
 * The fields a GM may override.
 *
 * Deliberately NOT the whole effect. A value, a target or a type is what the
 * book says the ability DOES; changing those is authoring a different ability
 * and belongs in the cookbook. These are the fields that say WHEN and TO WHOM
 * it applies — the always/conditional axis and nothing else.
 *
 * `condition` is the free-text scope a human reads. The `vs*`/`tones`/
 * `optionalRule` fields are the machine-decidable half that `scopeApplies()`
 * in acks-lib acts on; a GM setting only `condition` gets a note on the sheet
 * and no automation, which is honest — prose cannot gate a roll.
 */
export const OVERRIDABLE_FIELDS = Object.freeze([
  "condition",
  "appliesTo",
  "mode",
  "vsKinds",
  "vsAlignment",
  "vsAlignmentMode",
  "tones",
  "optionalRule",
]);

/**
 * A stable identity for one effect within its ability.
 *
 * Type plus target plus activity, and an ordinal only to separate genuine
 * twins. Stable across regeneration (the same recipe produces the same shape)
 * and readable in stored data — `modifier|ac||0` says what it is, which
 * matters when the record outlives the session that made it.
 *
 * The ordinal is the known weak point: if a recipe later inserts a SECOND
 * `modifier|ac` before the existing one, an override keyed to ordinal 0 lands
 * on the new effect. Rare (most abilities carry one effect per target) and
 * visible when it happens, versus an index-based key which would be wrong the
 * first time any effect was added anywhere in the list.
 */
export function effectKey(effect, ordinal = 0) {
  const part = (v) => String(v ?? "").replace(/[|]/g, "");
  return `${part(effect?.type)}|${part(effect?.target)}|${part(effect?.forWhat)}|${ordinal}`;
}

/** Every effect paired with its key, ordinals assigned within each shape group. */
export function keyedEffects(effects) {
  const seen = new Map();
  return (effects ?? []).map((effect) => {
    const base = effectKey(effect, 0).slice(0, -1);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: effectKey(effect, n), effect };
  });
}

/**
 * What an absent field MEANS, so "unchanged" can be told from "overridden".
 *
 * A stored effect usually omits `appliesTo` entirely and the schema reads that
 * as `self` — but a <select> always submits something. Comparing a submitted
 * "self" against an absent field would mark every row on every sheet as
 * overridden the first time it was saved, and a marker that is on everything
 * says nothing.
 */
export const FIELD_DEFAULTS = Object.freeze({ appliesTo: "self" });

/** The effective value of an overridable field, for comparison. */
export const effectiveField = (effect, field) =>
  effect?.[field] ?? FIELD_DEFAULTS[field] ?? (field === "vsKinds" || field === "tones" ? [] : "");

/**
 * Keep only the fields a GM is allowed to change, dropping empty patches.
 *
 * A record entry is `{ set, was }`: the GM's values, and the generated values
 * they replaced. `was` exists because the effects array holds only the
 * EFFECTIVE result — once an override is applied the cookbook's own value is
 * gone from the item, so a Reset button with nothing to restore would leave
 * the effect blank until the next Update. The guard refreshes `was` every time
 * the ability is regenerated, so it tracks the book rather than going stale.
 */
export function sanitizeOverrides(raw) {
  const pick = (patch) => {
    const clean = {};
    for (const field of OVERRIDABLE_FIELDS) {
      if (!(field in (patch ?? {}))) continue;
      const value = patch[field];
      // An override to "" is meaningful — it is how a conditional effect is
      // made unconditional — so blanks are KEPT. Only a missing key means
      // "not overridden", which is why this tests `in` and not truthiness.
      clean[field] = Array.isArray(value) ? value.filter((v) => v !== "" && v != null) : value;
    }
    return clean;
  };
  const out = {};
  for (const [key, entry] of Object.entries(raw ?? {})) {
    if (!key || !entry || typeof entry !== "object") continue;
    const set = pick(entry.set);
    if (!Object.keys(set).length) continue;
    out[key] = { set, was: pick(entry.was) };
  }
  return out;
}

/** The override record stored on an item. */
export function overridesOf(item) {
  return sanitizeOverrides(item?.getFlag?.(MODULE_ID, FLAG_OVERRIDES) ?? {});
}

/**
 * Effects with the GM's overrides applied. Pure — returns a new array and
 * never mutates its input.
 */
export function applyOverrides(effects, overrides) {
  const record = sanitizeOverrides(overrides);
  if (!Object.keys(record).length) return [...(effects ?? [])];
  return keyedEffects(effects).map(({ key, effect }) => {
    const entry = record[key];
    return entry ? { ...effect, ...entry.set } : effect;
  });
}

/**
 * Capture what the generated effects say, for every field a record overrides.
 *
 * Run against the INCOMING (freshly regenerated) effects, before the overrides
 * are applied over them — that is the one moment the cookbook's own values are
 * in hand, so it is the only place `was` can be kept honest.
 */
export function refreshWas(effects, overrides) {
  const record = sanitizeOverrides(overrides);
  const byKey = new Map(keyedEffects(effects).map(({ key, effect }) => [key, effect]));
  const out = {};
  for (const [key, entry] of Object.entries(record)) {
    const effect = byKey.get(key);
    // No matching effect: keep the last known `was` rather than blanking it,
    // so an orphaned override can still be reset if the shape comes back.
    if (!effect) {
      out[key] = entry;
      continue;
    }
    const was = {};
    for (const field of Object.keys(entry.set)) was[field] = effectiveField(effect, field);
    out[key] = { set: entry.set, was };
  }
  return out;
}

/** An effect with one record entry undone — what Reset puts back. */
export function restoreEffect(effect, entry) {
  const restored = { ...effect };
  for (const field of Object.keys(entry?.set ?? {})) {
    if (entry.was && field in entry.was) restored[field] = entry.was[field];
    else delete restored[field];
  }
  return restored;
}

/**
 * Which keys in the record no longer match an effect.
 *
 * An orphan means the ability was re-extracted into a different shape (a recipe
 * changed, or the seat's printing differs) and the GM's intent no longer has
 * anywhere to land. Reported, never silently discarded — a vanished override is
 * exactly the failure this whole layer exists to prevent.
 */
export function orphanedKeys(effects, overrides) {
  const live = new Set(keyedEffects(effects).map((e) => e.key));
  return Object.keys(sanitizeOverrides(overrides)).filter((k) => !live.has(k));
}

/**
 * Re-apply the override record to any write that replaces the effects array.
 *
 * Registered as `preUpdateItem` so it catches acks-content's bulk Update, the
 * sheet's own save, and anything else that writes the flag. Mutating `changed`
 * (rather than updating again afterwards) keeps it to ONE database write and
 * leaves no window where the un-overridden values are what the world holds.
 *
 * The record is taken from the incoming change when the same write carries one
 * — that is the sheet saving an edit, where the new record must win over the
 * stored one.
 */
export function registerOverrideGuard() {
  Hooks.on("preUpdateItem", (item, changed) => {
    const incoming = foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAG_EXTRAS}.effects`);
    if (!Array.isArray(incoming)) return;
    const submitted = foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAG_OVERRIDES}`);
    const record = sanitizeOverrides(submitted ?? overridesOf(item));
    if (!Object.keys(record).length) return;
    // Capture the generated values BEFORE overwriting them — this is the only
    // moment they exist on the way past. Written back so Reset always has the
    // current book value to restore, even many Updates later.
    const refreshed = refreshWas(incoming, record);
    foundry.utils.setProperty(changed, `flags.${MODULE_ID}.${FLAG_OVERRIDES}`, refreshed);
    foundry.utils.setProperty(
      changed,
      `flags.${MODULE_ID}.${FLAG_EXTRAS}.effects`,
      applyOverrides(incoming, refreshed),
    );
  });
}
