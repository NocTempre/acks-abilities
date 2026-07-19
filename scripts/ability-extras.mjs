/* global foundry */
/**
 * AbilityExtras — the extended effect model the core ACKS `ability` item does
 * not carry. Stored at `item.flags["acks-abilities"].extras` (NOT a document
 * sub-type): the core ability item keeps owning name, description,
 * proficiencytype, roll/rollType/rollTarget, requirements and save; this adds
 * the structured, level-aware EFFECTS plus the classification meta the books
 * express (general flag, repeatable, custom-power cost, prerequisites, choice
 * branches, deprecation).
 *
 * Built from the shared acks-lib field-builders so the effect vocabulary is one
 * definition across the family (sibling-relative import — the side-by-side
 * layout the toolchain assumes; resolves under /modules/ at runtime).
 */
import { MODULE_ID, FLAG_EXTRAS } from "./constants.mjs";
import { num, str, bool, choice, refList, effectsField, defensesField, rollsField } from "../../acks-lib/scripts/fields.mjs";
import { ABILITY_CATEGORIES, CONVERSION_STATUS } from "../../acks-lib/scripts/vocab.mjs";

export default class AbilityExtras extends foundry.abstract.DataModel {
  /** Array-valued paths, reconstructed from FormDataExtended's numeric-keyed objects. */
  static ARRAY_PATHS = ["effects", "rolls", "choice.options"];

  static defineSchema() {
    const { SchemaField, ArrayField } = foundry.data.fields;
    return {
      // --- Classification (intrinsic; NEVER which class/monster owns it) ---
      category: choice(ABILITY_CATEGORIES, { initial: "proficiency" }),
      general: bool(), // the "(G)" general-proficiency marker
      repeatable: bool(), // "may be selected multiple times"
      powerValue: num(), // custom-power cost (0.5 / 1 / 1.5 / 2 / 3 / 5); powers only
      deprecated: bool(), // "removed from ACKS II" — still ingested, just flagged
      replacedBy: str(), // what supersedes it (a def id), so references can redirect
      // Set when the ability arrived from a converted/legacy source: `deleted`
      // (removed on purpose) reads as a caution, `absent` (merely omitted) as
      // info, `renamed` as a note. All three are surfaced.
      conversionStatus: choice(CONVERSION_STATUS),
      conversionFrom: str(), // the PRE-conversion name — what the older source called it
      // An alias is its OWN ability, not a redirect: the books list a name whose
      // text lives under another entry. It gets a real item (so it can be picked,
      // granted and shown), a pointer to where its text is, and — because the two
      // are the same capability — a non-stacking relation to the target.
      aliasOf: str(),
      // What this ability lets you DO, named independently of this entry, as
      // acks-lib `kw:` capability tokens. A prerequisite written against a
      // capability is satisfied by any ability providing it — which is what
      // makes a gate survive the books printing the same capability as a
      // proficiency, a skill, a class power and an alias. Two abilities sharing
      // a capability are the same capability twice, so they do not stack.
      provides: refList(),
      requires: str(), // prerequisite marker (detail lives in the lazy description)
      // --- A pick-one branch (Combat Trickery maneuver, Elementalism element…) ---
      choice: new SchemaField({
        prompt: str(),
        options: new ArrayField(new SchemaField({ label: str(), ref: str() })),
      }),
      // --- The rolls this ability offers ---
      // An ability is not one roll. Animal Husbandry diagnoses, cures, cures
      // serious injury and extracts venom — four rolls, three of them on their
      // own rank progression. The core item carries a single roll/rollTarget,
      // which cannot express that, so the set lives here and the Rolls tab
      // presents them individually.
      rolls: rollsField(),
      // --- The structured, level-aware effects (acks-lib vocabulary) ---
      effects: effectsField(),
      // --- Immunities / resistances / susceptibilities (mostly monster abilities) ---
      defenses: defensesField(),
    };
  }

  /* -------------------------------------------- */

  /** Build from an item's stored flag (lenient: never throws on stale data). */
  static fromItem(item) {
    const raw = item?.getFlag(MODULE_ID, FLAG_EXTRAS) ?? {};
    try {
      return AbilityExtras.fromSource(foundry.utils.deepClone(raw), { strict: false });
    } catch (err) {
      console.warn(`${MODULE_ID} | could not parse ability extras; using defaults`, err);
      return new AbilityExtras({});
    }
  }

  /**
   * Normalize raw form/flag input into a complete, cleaned extras object:
   * reconstructs arrays from FormDataExtended's numeric-keyed objects and runs
   * the whole thing through the schema (defaults + coercion, null-safe).
   */
  static normalize(raw) {
    const data = foundry.utils.deepClone(raw ?? {});
    for (const path of AbilityExtras.ARRAY_PATHS) {
      const value = foundry.utils.getProperty(data, path);
      if (value && !Array.isArray(value) && typeof value === "object") {
        foundry.utils.setProperty(data, path, Object.values(value));
      }
    }
    return AbilityExtras.fromSource(data, { strict: false }).toObject();
  }
}
