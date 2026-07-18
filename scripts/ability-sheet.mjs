/* global foundry, game */
/**
 * The ACKS Abilities sheet is built at ready as a SUBCLASS of the system's own
 * registered `ability` item sheet, so it inherits the header, description and
 * Active Effects tabs verbatim and adds one **Mechanics** tab for the extended
 * effect model (`flags["acks-abilities"].extras`).
 *
 * NOTE the tab id is `mechanics`, not `effects` — the system already uses
 * `effects` for Foundry Active Effects, which are a different thing entirely.
 */
import { MODULE_ID, FLAG_EXTRAS } from "./constants.mjs";
import AbilityExtras from "./ability-extras.mjs";

const T = `modules/${MODULE_ID}/templates`;

/** Human-readable one-liner for an effect row. */
function describeEffect(e, V) {
  const label = (enumObj, key) => enumObj?.[key]?.label ?? key ?? "";
  const lv = (v) => {
    if (!v) return null;
    if (v.kind === "perLevel" && v.base != null) return `${v.base} (${v.per >= 0 ? "+" : ""}${v.per}/level)`;
    if (v.kind === "breakpoints" && v.breakpoints?.length) {
      return v.breakpoints.map((b) => `${b.value} @${b.atLevel}`).join(", ");
    }
    return v.flat ?? null;
  };
  const n = lv(e.value);
  const signed = (x) => (x == null ? "" : `${x >= 0 ? "+" : ""}${x}`);
  const refs = (a) => (a ?? []).join(", ");

  switch (e.type) {
    case "modifier":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${label(V.MODIFIER_TARGETS, e.target)} ${signed(n)}${e.forWhat ? ` (${e.forWhat})` : ""}` };
    case "throw":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${e.forWhat ? `${e.forWhat} ` : ""}throw ${n}+` };
    case "progressionAs":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `as ${label(V.PROGRESSION_CLASSES, e.as)} — ${label(V.PROGRESSION_LEVELS, e.atLevel)}` };
    case "proficiencyGrant":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${label(V.PROFICIENCY_DOMAINS, e.domain)} — ${label(V.PROFICIENCY_BREADTH, e.breadth)}${e.group ? ` (${e.group})` : ""}` };
    case "limitation":
      return { kind: label(V.EFFECT_TYPES, e.type), text: e.restriction || e.condition || "—" };
    case "requires":
    case "grants":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${refs(e.refs) || e.ref}${e.choose ? ` (choose ${e.choose})` : ""}` };
    case "modifies":
      return {
        kind: label(V.EFFECT_TYPES, e.type),
        text: `${refs(e.refs) || e.ref}: ${label(V.MODIFIER_TARGETS, e.target)} ${signed(n)} (${label(V.EFFECT_MODES, e.mode)})`,
      };
    case "spellLike":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${e.spell} — ${label(V.SPELL_LIKE_FREQ, e.frequency)}` };
    case "sense":
    case "movement":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${e.sense || e.mode || e.vision}${e.range ? ` ${e.range}'` : ""}` };
    default:
      return { kind: label(V.EFFECT_TYPES, e.type), text: e.note || e.condition || "—" };
  }
}

/**
 * @param {typeof foundry.applications.api.ApplicationV2} Base the system's ability sheet class
 */
export function createAbilitySheet(Base) {
  const P = Base.PARTS ?? {};
  const parts = { header: P.header, tabs: P.tabs };
  if (P.description) parts.description = P.description;
  parts.mechanics = { template: `${T}/tab-mechanics.hbs`, scrollable: [""] };
  if (P.effects) parts.effects = P.effects;

  const tabList = [];
  if (P.description) tabList.push({ id: "description", icon: "fa-solid fa-scroll", label: "ACKS.category.description" });
  tabList.push({ id: "mechanics", icon: "fa-solid fa-gears", label: "ACKS-ABILITIES.tab.mechanics" });
  if (P.effects) tabList.push({ id: "effects", icon: "fa-solid fa-sparkles", label: "ACKS.category.effects" });

  return class AcksAbilitySheet extends Base {
    static DEFAULT_OPTIONS = { classes: ["acks", "acks2", "item-v2", "acks-abilities"] };
    static PARTS = parts;
    static TABS = { primary: { tabs: tabList, initial: tabList[0].id } };

    tabGroups = { primary: tabList[0].id };

    /** @override */
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const V = globalThis.acksLib?.vocab ?? {};
      const extras = AbilityExtras.fromItem(this.item);
      context.extras = extras;
      context.x = `flags.${MODULE_ID}.${FLAG_EXTRAS}`;
      context.choices = {
        category: V.choicesOf?.(V.ABILITY_CATEGORIES ?? {}) ?? {},
      };
      context.effectRows = (extras.effects ?? []).map((e) => describeEffect(e, V));
      const d = extras.defenses ?? {};
      context.defenseRows = ["immunities", "resistances", "susceptibilities"]
        .map((k) => ({
          key: k,
          label: k.charAt(0).toUpperCase() + k.slice(1),
          damage: Array.from(d[k]?.damage ?? []),
          effects: Array.from(d[k]?.effects ?? []),
          conditions: Array.from(d[k]?.conditions ?? []),
        }))
        .filter((r) => r.damage.length || r.effects.length || r.conditions.length);
      context.libMissing = !globalThis.acksLib;
      return context;
    }

    /**
     * Merge submitted extras over the stored flag (unrendered fields survive)
     * and run them through the schema so blanks stay null, never 0.
     * @override
     */
    _prepareSubmitData(event, form, formData, updateData) {
      const submitData = super._prepareSubmitData(event, form, formData, updateData);
      const path = `flags.${MODULE_ID}.${FLAG_EXTRAS}`;
      const raw = foundry.utils.getProperty(submitData, path);
      if (raw && typeof raw === "object") {
        const stored = foundry.utils.deepClone(this.item.getFlag(MODULE_ID, FLAG_EXTRAS) ?? {});
        const merged = foundry.utils.mergeObject(stored, raw, { inplace: false, overwrite: true, insertKeys: true });
        try {
          foundry.utils.setProperty(submitData, path, AbilityExtras.normalize(merged));
        } catch (err) {
          console.error(`${MODULE_ID} | extras normalization failed; saving merged data as-is`, err);
          foundry.utils.setProperty(submitData, path, merged);
        }
      }
      return submitData;
    }
  };
}
