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
import {
  FLAG_OVERRIDES, OVERRIDABLE_FIELDS, keyedEffects, overridesOf, orphanedKeys,
  applyOverrides, effectiveField, restoreEffect, advancedEditEnabled,
} from "./effect-overrides.mjs";
import { rollAbility, rollsOf, targetOf, scalesFor } from "./ability-rolls.mjs";

const T = `modules/${MODULE_ID}/templates`;

/**
 * A definition id ("def.power.longeval") reads as noise on a sheet, so show the
 * ability's own name when that ability is in the world. The id is what the data
 * holds and what survives a rename; this is display only, and falls back to the
 * id whenever the referenced ability has not been imported.
 */
function refName(ref) {
  if (!ref) return ref;
  const match = (i) => i.getFlag?.("acks-content", "cookbook")?.id === ref;
  const item = game.items?.find?.(match);
  if (item) return item.name;
  // acks-content can import into world compendiums instead of the sidebar, in
  // which case `game.items` is empty and every relation rendered as a raw id.
  // Only already-loaded packs are searched — this is a display nicety on a
  // synchronous render path, so it must not await anything; an unopened pack
  // still falls back to the id, exactly as before.
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item") continue;
    const hit = pack.contents?.find?.(match);
    if (hit) return hit.name;
  }
  return ref;
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
    if (v.kind === "perLevel" && v.base != null) {
      // `base === per` is the "N per level" shape — the value IS N x level, so
      // showing "0.5 (+0.5/level)" invites reading a +0.5 bonus at 1st level
      // when the rule gives 1. Say what it multiplies, and say the rounding:
      // "half class level (round up)" is the rule, "0.5" is not a bonus anyone
      // ever applies.
      const rounding = v.round ? ` ${label(V.VALUE_ROUNDING, v.round).toLowerCase()}` : "";
      if (v.base === v.per) return `${v.base}/level${rounding}`;
      return `${v.base} (${v.per >= 0 ? "+" : ""}${v.per}/level)${rounding}`;
    }
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
    case "attributeSubstitution": {
      // Which score feeds the roll, not how much it adds — so there is no
      // number to show, and a row that tried to print one would be wrong for
      // every character.
      const qual = [e.condition, e.notStacksWith?.length ? `does not stack with ${refs(e.notStacksWith)}` : ""]
        .filter(Boolean).join("; ");
      return {
        kind: label(V.EFFECT_TYPES, e.type),
        text: `${label(V.ATTRIBUTES, e.attribute)} instead of ${label(V.ATTRIBUTES, e.insteadOf)} on ${label(V.MODIFIER_TARGETS, e.target)}${qual ? ` (${qual})` : ""}`,
      };
    }
    case "conditionRemove": {
      const subject = e.appliesTo && e.appliesTo !== "self" ? `${label(V.EFFECT_SUBJECTS, e.appliesTo)}: ` : "";
      const conds = [...(e.conditions ?? [])].map((c) => label(V.CONDITION_KEYS, c)).join(", ");
      return {
        kind: label(V.EFFECT_TYPES, e.type),
        text: `${subject}cures ${conds || "—"}${e.condition ? ` (${e.condition})` : ""}`,
      };
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
  // THREE TABS, and each kind of thing lives on exactly one of them:
  //   description  what the ability is — prose, citation, and the properties
  //                that are not rolls (requirements, type, favourite)
  //   rolls        every throw it offers
  //   mechanics    everything that changes the game without being rolled — the
  //                extended effect model AND Foundry's Active Effects
  //
  // The system's own `effects` part is folded into mechanics rather than kept
  // as a fourth tab: two tabs both meaning "effects" was a distinction only the
  // implementation cared about. Core's description part is reused as-is — only
  // the details partial inside it is swapped (see _prepareDescriptionContext),
  // so the roll fields come off Description without restating core's template.
  const parts = { header: P.header, tabs: P.tabs };
  if (P.description) parts.description = P.description;
  parts.rolls = { template: `${T}/tab-rolls.hbs`, scrollable: [""] };
  parts.mechanics = { template: `${T}/tab-mechanics.hbs`, scrollable: [""] };

  const tabList = [];
  if (P.description) tabList.push({ id: "description", icon: "fa-solid fa-scroll", label: "ACKS.category.description" });
  tabList.push({ id: "rolls", icon: "fa-solid fa-dice-d20", label: "ACKS-ABILITIES.tab.rolls" });
  tabList.push({ id: "mechanics", icon: "fa-solid fa-gears", label: "ACKS-ABILITIES.tab.mechanics" });

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
      // Taken more than once while the book says it cannot be. That is a
      // contradiction in the data, not a preference, so it is drawn as one
      // rather than sitting quietly in a number field nobody re-reads.
      context.qtyConflict = !extras.repeatable && Number(extras.qty) > 1;
      // Selections edit as one comma-separated line (normalize() splits it).
      context.selectionsCSV = (extras.selections ?? []).join(", ");
      context.choices = {
        category: V.choicesOf?.(V.ABILITY_CATEGORIES ?? {}) ?? {},
      };
      // Effects are shown WITH their keys so each row can be scoped by the GM.
      // The stored effects already carry any override (the guard applies it on
      // write), so the row text reads as the ability actually behaves; the
      // record only says which rows were changed and what to restore.
      // Records already made keep applying whether or not this user is showing
      // the control that makes them — hiding a control must not revoke a
      // decision someone else made.
      const overrides = overridesOf(this.item);
      context.o = `flags.${MODULE_ID}.${FLAG_OVERRIDES}`;
      context.advancedEdit = advancedEditEnabled();
      context.effectRows = keyedEffects(extras.effects ?? []).map(({ key, effect: e }) => {
        const row = describeEffect(e, V);
        row.key = key;
        // Marked only when this row was deliberately pinned. An ordinary edit
        // is an ordinary document change, and a "this is not the book" badge
        // on it would be noise.
        row.overridden = !!overrides[key];
        // The flip itself: blank scope means the effect always applies.
        row.always = !(e.condition ?? "");
        // The always/conditional axis, editable. Blank means always — which is
        // why an override to "" is kept rather than treated as absent.
        row.condition = e.condition ?? "";
        row.appliesTo = e.appliesTo ?? "self";
        // Carry the whole ladder so the row can show every level, not a summary
        // that looks like the value only changes at a few of them.
        const bp = e.value?.breakpoints;
        if (isDenseLadder(bp)) {
          row.ladder = { levels: bp.map((b) => b.atLevel), values: bp.map((b) => `${b.value}+`) };
        }
        return row;
      });
      context.choices.appliesTo = V.choicesOf?.(V.EFFECT_SUBJECTS ?? {}) ?? {};
      // A record whose effect no longer exists. Surfaced, never dropped: a
      // vanished ruling is the failure persist mode exists to prevent.
      context.orphanedOverrides = orphanedKeys(extras.effects ?? [], overrides);
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
      // Read through rollsOf() — the single read path — so an ability whose
      // roll still lives in core's singleton fields presents identically.
      const scales = scalesFor(this.item.actor, this.item);
      context.rollRows = rollsOf(this.item).map((r, i) => {
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

    /**
     * Swap the details partial the system's description tab renders.
     *
     * Core's `description.hbs` pulls in `details-<type>.hbs` through a context
     * function, and for an ability that partial is mostly the roll block —
     * formula, type, target, blind, save. Those belong on the Rolls tab with
     * the ability's other throws; leaving the first one here made it look like
     * the only one, and left a bare "1d20 / = / 0" on every proficiency that
     * makes no throw at all.
     *
     * Only the pointer changes. Core's description template, its enrichment and
     * everything else about the tab are reused untouched.
     * @override
     */
    async _prepareDescriptionContext(context) {
      const prepared = await super._prepareDescriptionContext(context);
      prepared.getDetailsPartialPath = () => `${T}/details-ability.hbs`;
      return prepared;
    }

    /**
     * Foundry's Active Effects render INSIDE the mechanics tab, so the system's
     * effects context has to be prepared for a part the system does not know
     * carries them. Everything else defers to the system.
     * @override
     */
    async _preparePartContext(partId, context, options) {
      context = await super._preparePartContext(partId, context, options);
      if (partId === "mechanics") {
        context.tab = context.tabs[partId];
        // Reuse the system's own preparation — the Active Effects list is its
        // data, rendered through its partial, just on a different tab.
        if (typeof this._prepareEffectsContext === "function") {
          context = await this._prepareEffectsContext(context);
        }
      }
      return context;
    }

    /** @override */
    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
      for (const b of root?.querySelectorAll(".acks-abilities-roll-go") ?? []) {
        b.addEventListener("click", () => rollAbility(this.item, b.dataset.rollKey));
      }
      for (const b of root?.querySelectorAll(".acks-abilities-reset-override") ?? []) {
        b.addEventListener("click", () => this._resetOverride(b.dataset.key));
      }
      // "Always" is a view of the scope field, not a second source of truth:
      // ticking it clears the scope, unticking it hands focus to the box so
      // the next thing you do is say when. One value, two ways to reach it.
      for (const box of root?.querySelectorAll(".acks-abilities-always-toggle") ?? []) {
        box.addEventListener("change", () => {
          const text = box.closest(".acks-abilities-effect-scope")?.querySelector('input[type="text"]');
          if (!text) return;
          if (box.checked) {
            text.value = "";
            text.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            text.focus();
          }
        });
      }
    }

    /**
     * Drop one row's override and put the cookbook's own values back.
     *
     * Written as a single update carrying both the shortened record and the
     * restored effects: the guard would otherwise re-apply the override it is
     * being asked to remove.
     */
    async _resetOverride(key) {
      const record = overridesOf(this.item);
      const entry = record[key];
      if (!entry) return;
      delete record[key];
      const effects = keyedEffects(this.item.getFlag(MODULE_ID, FLAG_EXTRAS)?.effects ?? []).map(
        ({ key: k, effect }) => (k === key ? restoreEffect(effect, entry) : effect),
      );
      await this.item.update({
        [`flags.${MODULE_ID}.${FLAG_OVERRIDES}`]: { [`-=${key}`]: null, ...record },
        [`flags.${MODULE_ID}.${FLAG_EXTRAS}.effects`]: effects,
      });
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
        // The Rolls tab may be showing a roll that still lives in core's
        // singleton fields — rollsOf() folded it for display. Seed the merge
        // base with what was actually shown, so editing it MATERIALIZES it here
        // instead of writing a half-row over an empty array and losing the
        // fields the form did not render.
        if (!(stored.rolls ?? []).length) {
          const folded = rollsOf(this.item);
          if (folded.length) stored.rolls = foundry.utils.deepClone(folded);
        }
        const merged = foundry.utils.mergeObject(stored, raw, { inplace: false, overwrite: true, insertKeys: true });
        try {
          foundry.utils.setProperty(submitData, path, AbilityExtras.normalize(merged));
        } catch (err) {
          console.error(`${MODULE_ID} | extras normalization failed; saving merged data as-is`, err);
          foundry.utils.setProperty(submitData, path, merged);
        }
      }
      this._foldOverrides(submitData);
      return submitData;
    }

    /**
     * Write the per-row scope edits onto the effects being saved — and, only
     * in persist mode, also record them so a later re-import keeps them.
     *
     * The edit itself always lands: changing a field changes the value, which
     * is what editing a field should do. The RECORD is the opt-in half. A row
     * is recorded only when it actually differs from what the cookbook
     * generated, so the "this is a local ruling" marker stays meaningful
     * instead of appearing on every effect the first time a sheet is saved.
     */
    _foldOverrides(submitData) {
      const oPath = `flags.${MODULE_ID}.${FLAG_OVERRIDES}`;
      const submitted = foundry.utils.getProperty(submitData, oPath);
      if (!submitted || typeof submitted !== "object") return;
      // The generated baseline: the stored effects with any EXISTING override
      // undone via its `was`. Without this a row that was overridden once looks
      // unchanged forever, and clearing the field could never reset it.
      const previous = overridesOf(this.item);
      const generated = new Map(
        keyedEffects(this.item.getFlag(MODULE_ID, FLAG_EXTRAS)?.effects ?? []).map(({ key, effect }) => [
          key,
          previous[key] ? restoreEffect(effect, previous[key]) : effect,
        ]),
      );
      const record = {};
      const applied = {};
      for (const [key, patch] of Object.entries(submitted)) {
        const base = generated.get(key);
        if (!base || !patch || typeof patch !== "object") continue; // a row that is no longer there
        const set = {};
        const was = {};
        // The row's scope inputs live under `set`; `keep` sits beside them and
        // is the pin, not a field of the effect.
        const submittedFields = patch.set ?? {};
        for (const field of OVERRIDABLE_FIELDS) {
          if (!(field in submittedFields)) continue;
          const generatedValue = effectiveField(base, field);
          const value = submittedFields[field];
          // Compared against what the field EFFECTIVELY is, not against
          // undefined: a <select> always submits a value, and treating an
          // absent `appliesTo` as different from a submitted "self" would
          // stamp an override on every row of every sheet that is ever saved.
          if (String(generatedValue) === String(value)) continue;
          set[field] = value;
          was[field] = generatedValue;
        }
        if (!Object.keys(set).length) continue;
        applied[key] = { set, was };
        // PER-EDIT, and off unless asked for: this row is only recorded as an
        // import override when its pin is ticked. A previously pinned row stays
        // pinned while the control is hidden, so a user working at the plain
        // level cannot silently un-pin someone else's ruling.
        const pinned = "keep" in patch ? !!patch.keep : !!previous[key];
        if (pinned) record[key] = { set, was };
      }
      const ePath = `flags.${MODULE_ID}.${FLAG_EXTRAS}.effects`;
      const effects = foundry.utils.getProperty(submitData, ePath);
      if (Array.isArray(effects)) {
        // Every edit lands on the effects — changing a field changes the value,
        // pinned or not. Rebuilt from the generated baseline so clearing an
        // edit restores the book's value rather than the last text typed.
        const base = keyedEffects(effects).map(({ key, effect }) => generated.get(key) ?? effect);
        foundry.utils.setProperty(submitData, ePath, applyOverrides(base, applied));
      }
      // Only pinned rows are recorded. An unpinned edit is an ordinary change
      // that the next Update refreshes from the book, like every other
      // generated value — which is the honest default.
      foundry.utils.setProperty(submitData, oPath, record);
    }
  };
}
