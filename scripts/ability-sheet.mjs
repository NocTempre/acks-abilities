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
import { rollAbility, targetOf, scalesFor } from "./ability-rolls.mjs";

const T = `modules/${MODULE_ID}/templates`;

/**
 * A definition id ("def.power.longeval") reads as noise on a sheet, so show the
 * ability's own name when that ability is in the world. The id is what the data
 * holds and what survives a rename; this is display only, and falls back to the
 * id whenever the referenced ability has not been imported.
 */
function refName(ref) {
  if (!ref) return ref;
  const item = game.items?.find?.((i) => i.getFlag?.("acks-content", "cookbook")?.id === ref);
  return item?.name ?? ref;
}

/**
 * A breakpoint ladder that came from a printed PER-LEVEL table: contiguous
 * levels, one value each, long enough that listing it inline is noise. Read
 * off a table, it should be shown as a table.
 */
function isDenseLadder(bp) {
  if (!bp || bp.length < 4) return false;
  return bp.every((b, i) => i === 0 || b.atLevel === bp[i - 1].atLevel + 1);
}

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = Math.abs(n) % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** Human-readable one-liner for an effect row. */
function describeEffect(e, V) {
  const label = (enumObj, key) => enumObj?.[key]?.label ?? key ?? "";
  const lv = (v) => {
    if (!v) return null;
    if (v.kind === "perLevel" && v.base != null) return `${v.base} (${v.per >= 0 ? "+" : ""}${v.per}/level)`;
    if (v.kind === "breakpoints" && v.breakpoints?.length) {
      // A ladder read off a printed PER-LEVEL table has a value for every level
      // in its range. Listing all fourteen inline is unreadable and, worse,
      // reads as though the value only changes at those points — so summarise
      // the span here and let the row render the full table underneath.
      if (isDenseLadder(v.breakpoints)) {
        const first = v.breakpoints[0];
        const last = v.breakpoints[v.breakpoints.length - 1];
        return `${first.value}+ at ${ordinal(first.atLevel)} to ${last.value}+ at ${ordinal(last.atLevel)}`;
      }
      return v.breakpoints.map((b) => `${b.value} @${b.atLevel}`).join(", ");
    }
    // A conditional ladder reads off a scale rather than level, so name it.
    if (v.kind === "conditional" && v.breakpoints?.length) {
      const scale = V?.VALUE_SCALES?.[v.on]?.label ?? v.on;
      return v.breakpoints.map((b) => `${b.value} @${scale} ${b.atLevel}+`).join(", ");
    }
    return v.flat ?? null;
  };
  const n = lv(e.value);
  const signed = (x) => (x == null ? "" : `${x >= 0 ? "+" : ""}${x}`);
  const refs = (a) => (a ?? []).map(refName).join(", ");

  switch (e.type) {
    case "modifier": {
      // A situational bonus must SAY so — a bare "+4" claims it always applies,
      // and most of these apply only while ambushing, negotiating, casting…
      // WHOSE roll this hits LEADS the line when it is not the character's
      // own: "-2 to surprise" and "the opponent: -2 to surprise" are opposite
      // abilities, and reading that off the tail of a qualifier list is too
      // easy to miss.
      const subject = e.appliesTo && e.appliesTo !== "self" ? `${label(V.EFFECT_SUBJECTS, e.appliesTo)}: ` : "";
      const qual = [e.forWhat, e.condition === "situational" ? "situational" : e.condition, e.mode === "replace" ? "replaces the default" : "", e.mode === "set" ? "does not apply" : ""]
        .filter(Boolean).join("; ");
      const amount = e.mode === "set" ? "" : ` ${signed(n)}`;
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${subject}${label(V.MODIFIER_TARGETS, e.target)}${amount}${qual ? ` (${qual})` : ""}` };
    }
    case "throw": {
      // A dense-ladder summary already reads "19+ at 1st to …" — appending the
      // target-number "+" to that would double it.
      const span = isDenseLadder(e.value?.breakpoints);
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${e.forWhat ? `${e.forWhat} ` : ""}throw ${n}${span ? "" : "+"}` };
    }
    case "progressionAs":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `as ${label(V.PROGRESSION_CLASSES, e.as)} — ${label(V.PROGRESSION_LEVELS, e.atLevel)}` };
    case "proficiencyGrant":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${label(V.PROFICIENCY_DOMAINS, e.domain)} — ${label(V.PROFICIENCY_BREADTH, e.breadth)}${e.group ? ` (${e.group})` : ""}` };
    case "limitation":
      return { kind: label(V.EFFECT_TYPES, e.type), text: e.restriction || e.condition || "—" };
    case "requires":
    case "grants":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${refs(e.refs) || refName(e.ref)}${e.choose ? ` (choose ${e.choose})` : ""}` };
    case "modifies":
      return {
        kind: label(V.EFFECT_TYPES, e.type),
        text: `${refs(e.refs) || refName(e.ref)}: ${label(V.MODIFIER_TARGETS, e.target)} ${signed(n)} (${label(V.EFFECT_MODES, e.mode)})`,
      };
    case "spellLike":
      return { kind: label(V.EFFECT_TYPES, e.type), text: [e.spell, label(V.SPELL_LIKE_FREQ, e.frequency)].filter(Boolean).join(" — ") };
    case "sense":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${label(V.SENSE_TYPES, e.sense) || e.vision}${e.range ? ` ${e.range}'` : ""}` };
    case "movement":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${label(V.MOVEMENT_TYPES, e.movementMode)}${n != null ? ` ${n}'` : ""}` };
    case "spellcastingMod":
      return {
        kind: label(V.EFFECT_TYPES, e.type),
        // No `savePenalty` here. This branch rendered one, but acks-lib's
        // effectField declares no such field, so the value could never survive
        // validation to reach the sheet — a display path with no storage
        // behind it, found by chef audit. A save penalty an ability imposes on
        // its targets is a `modifier` with `appliesTo: "opponent"`.
        text: [e.school, e.casterLevelDelta ? `${signed(e.casterLevelDelta)} caster levels` : ""]
          .filter(Boolean).join(", ") || "—",
      };
    case "resource":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${e.action || ""} ${label(V.RESOURCE_KINDS, e.resource)}${e.amount ? ` ×${e.amount}` : ""}`.trim() };
    case "economic":
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${e.amount ?? ""}${e.unit || ""}${e.period ? ` per ${e.period}` : ""}`.trim() || "—" };
    case "reroll": {
      const total = V.rerollTotal?.(e) ?? 2;
      const what = e.forWhat || label(V.MODIFIER_TARGETS, e.target) || "the roll";
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${what} ${total}× — ${label(V.REROLL_KEEP, e.keep) || "Keep the Better"}` };
    }
    case "companion": {
      // The slot exists whether or not the creature has been loaded: a seat
      // without the citing book still sees what the ability confers.
      const who = e.actorUuid ? e.note || e.actorUuid : e.note || refName(e.ref) || "creature";
      const state = e.actorUuid ? "" : " (not yet loaded)";
      return { kind: label(V.EFFECT_TYPES, e.type), text: `${e.amount > 1 ? `${e.amount}× ` : ""}${who}${state}` };
    }
    case "capability":
      return { kind: label(V.EFFECT_TYPES, e.type), text: label(V.SPELL_LIKE_FREQ, e.frequency) || e.note || "see description" };
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
  parts.rolls = { template: `${T}/tab-rolls.hbs`, scrollable: [""] };
  parts.mechanics = { template: `${T}/tab-mechanics.hbs`, scrollable: [""] };
  if (P.effects) parts.effects = P.effects;

  const tabList = [];
  if (P.description) tabList.push({ id: "description", icon: "fa-solid fa-scroll", label: "ACKS.category.description" });
  tabList.push({ id: "rolls", icon: "fa-solid fa-dice-d20", label: "ACKS-ABILITIES.tab.rolls" });
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
      // The count earns a row only when it carries information: a repeatable
      // ability the character could take again, or a count already above 1.
      // A non-repeatable ability sitting at 1 says nothing, and "x1" on every
      // sheet is noise. Above 1 always shows — including on a NON-repeatable
      // ability, where the combination is a data fault and hiding it would
      // hide the fault.
      context.showQty = !!extras.repeatable || Number(extras.qty) > 1;
      context.choices = {
        category: V.choicesOf?.(V.ABILITY_CATEGORIES ?? {}) ?? {},
      };
      context.effectRows = (extras.effects ?? []).map((e) => {
        const row = describeEffect(e, V);
        // Carry the whole ladder so the row can show every level, not a summary
        // that looks like the value only changes at a few of them.
        const bp = e.value?.breakpoints;
        if (isDenseLadder(bp)) {
          row.ladder = { levels: bp.map((b) => b.atLevel), values: bp.map((b) => `${b.value}+`) };
        }
        return row;
      });
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
      // One row per roll the ability offers. A target that varies shows its
      // whole ladder, because the number alone would be a lie at other ranks.
      const scales = scalesFor(this.item.actor, this.item);
      context.rollRows = (extras.rolls ?? []).map((r, i) => {
        const key = r.key || `roll${i}`;
        const target = targetOf(r, this.item.actor, this.item);
        const bp = r.target?.breakpoints ?? [];
        const varies = bp.length > 1;
        const suffix = r.rollType === "below" ? "-" : r.rollType === "result" ? "" : "+";
        return {
          key,
          label: r.label || game.i18n.localize("ACKS-ABILITIES.roll.unnamed"),
          display: target == null ? (varies ? "—" : "?") : `${target}${suffix}`,
          condition: r.condition,
          ladder: varies
            ? {
                scaleLabel: V.VALUE_SCALES?.[r.scale]?.label ?? r.scale ?? "Level",
                steps: bp.map((b) => b.atLevel),
                values: bp.map((b) => `${b.value}${suffix}`),
              }
            : null,
        };
      });
      context.scales = scales;
      context.libMissing = !globalThis.acksLib;
      // Converted content still imports; it just carries a notice. Removed-on-
      // purpose reads as a caution, merely-omitted as info, and a RENAME is
      // marked too — it resolved, but the reader's book calls it something else,
      // so the notice names it. Wording and icon come from acks-lib.
      const statusKey = extras.conversionStatus || (extras.deprecated ? "deleted" : "");
      const status = statusKey ? V.CONVERSION_STATUS?.[statusKey] : null;
      const CLS = { caution: "warning", info: "info", note: "info" };
      context.notice = status
        ? {
            severity: status.severity,
            cls: CLS[status.severity] ?? "info",
            icon: status.icon,
            label: status.label,
            tip: V.conversionTip?.(statusKey, extras.conversionFrom || this.item.name) ?? status.tip,
            replacedBy: extras.replacedBy ? refName(extras.replacedBy) : "",
          }
        : null;
      // An alias is a real ability whose text lives under another entry. Say so
      // — otherwise the two look like accidental duplicates.
      context.aliasOf = extras.aliasOf ? refName(extras.aliasOf) : null;
      // Capabilities read better as the thing they stand for than as raw
      // tokens: "kw:sensingevil" is the Sensing Evil capability.
      context.provides = (extras.provides ?? []).map((token) => {
        const slug = String(token).replace(/^kw:/, "");
        const owner = game.items?.find?.((i) => {
          const id = i.getFlag?.("acks-content", "cookbook")?.id;
          return id && !i.getFlag("acks-abilities", "extras")?.aliasOf && V.capabilityForId?.(id) === token;
        });
        return { token, label: owner?.name ?? slug };
      });
      return context;
    }

    /** @override */
    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
      for (const b of root?.querySelectorAll(".acks-abilities-roll-go") ?? []) {
        b.addEventListener("click", () => rollAbility(this.item, b.dataset.rollKey));
      }
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
