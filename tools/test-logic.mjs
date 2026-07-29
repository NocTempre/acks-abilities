/**
 * Pure-logic tests for acks-abilities. Foundry-free: everything here is the
 * override layer's key/merge arithmetic, which is where a mistake silently
 * loses a GM's ruling.
 *
 * Usage: node tools/test-logic.mjs
 */
import assert from "node:assert/strict";
import {
  effectKey,
  keyedEffects,
  sanitizeOverrides,
  applyOverrides,
  refreshWas,
  restoreEffect,
  effectiveField,
  orphanedKeys,
  OVERRIDABLE_FIELDS,
} from "../scripts/effect-overrides.mjs";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

/** As the cookbook generates it: AC unconditional, saves scoped. */
const AURA = [
  { type: "modifier", target: "ac", mode: "add", value: { kind: "flat", flat: 1 } },
  { type: "modifier", target: "save", mode: "add", value: { kind: "flat", flat: 1 }, condition: "vs evil creatures" },
];
const AC = "modifier|ac||0";
const SAVE = "modifier|save||0";

/* ---------------------------------------------------------------- */
/*  keys                                                             */
/* ---------------------------------------------------------------- */

t("a key is readable and says what the effect is", () => {
  assert.equal(effectKey(AURA[0]), AC);
  assert.equal(effectKey({ type: "modifier", target: "save", forWhat: "Mortal Wounds" }, 0), "modifier|save|Mortal Wounds|0");
});

t("keys are stable across regeneration, and twins get distinct ordinals", () => {
  assert.deepEqual(
    keyedEffects(AURA).map((e) => e.key),
    keyedEffects(structuredClone(AURA)).map((e) => e.key),
  );
  assert.deepEqual(keyedEffects([AURA[0], { ...AURA[0] }]).map((e) => e.key), [AC, "modifier|ac||1"]);
});

t("a key survives an effect being added ELSEWHERE in the list", () => {
  // The failure an index-based key would have: a recipe gains a new effect and
  // every override below it lands on the wrong row.
  const keys = keyedEffects([{ type: "capability" }, ...AURA]).map((e) => e.key);
  assert.ok(keys.includes(AC) && keys.includes(SAVE));
});

/* ---------------------------------------------------------------- */
/*  the always/conditional axis                                      */
/* ---------------------------------------------------------------- */

t("always -> conditional: the override reaches the effect", () => {
  const out = applyOverrides(AURA, { [AC]: { set: { condition: "vs evil creatures" } } });
  assert.equal(out[0].condition, "vs evil creatures");
  assert.equal(out[0].value.flat, 1, "the value is untouched — only scope is overridable");
  assert.equal(out[1].condition, "vs evil creatures", "the other row is left alone");
});

t("conditional -> always: an override to blank is KEPT, not treated as absent", () => {
  const out = applyOverrides(AURA, { [SAVE]: { set: { condition: "" } } });
  assert.equal(out[1].condition, "", "clearing the scope is how an effect is made unconditional");
});

t("applyOverrides is pure", () => {
  const before = structuredClone(AURA);
  applyOverrides(AURA, { [AC]: { set: { condition: "x" } } });
  assert.deepEqual(AURA, before);
});

t("no record means the effects come back untouched", () => {
  assert.deepEqual(applyOverrides(AURA, {}), AURA);
  assert.deepEqual(applyOverrides(AURA, null), AURA);
});

/* ---------------------------------------------------------------- */
/*  what may be overridden                                           */
/* ---------------------------------------------------------------- */

t("only scope fields are accepted; a value or target change is refused", () => {
  const dirty = { [AC]: { set: { condition: "x", value: { kind: "flat", flat: 99 }, target: "damage", type: "throw" } } };
  assert.deepEqual(sanitizeOverrides(dirty), { [AC]: { set: { condition: "x" }, was: {} } });
  const out = applyOverrides(AURA, dirty);
  assert.equal(out[0].target, "ac", "target is what the book says the ability DOES");
  assert.equal(out[0].value.flat, 1);
});

t("an entry with nothing overridable in it is dropped entirely", () => {
  assert.deepEqual(sanitizeOverrides({ [AC]: { set: { value: 5 } } }), {});
  assert.deepEqual(sanitizeOverrides({ "": { set: { condition: "x" } } }), {});
  assert.deepEqual(sanitizeOverrides({ [AC]: null }), {});
  assert.deepEqual(sanitizeOverrides({ [AC]: { was: { condition: "x" } } }), {}, "a `was` with no `set` is not an override");
});

t("every advertised field is actually accepted", () => {
  const set = Object.fromEntries(OVERRIDABLE_FIELDS.map((f) => [f, f === "vsKinds" || f === "tones" ? ["x"] : "x"]));
  assert.deepEqual(Object.keys(sanitizeOverrides({ k: { set } }).k.set).sort(), [...OVERRIDABLE_FIELDS].sort());
});

t("an absent field reads as its effective default, not as undefined", () => {
  // A <select> always submits something. Without this, saving any sheet would
  // stamp an appliesTo override on every row and the marker would mean nothing.
  assert.equal(effectiveField(AURA[0], "appliesTo"), "self");
  assert.equal(effectiveField(AURA[0], "condition"), "");
  assert.deepEqual(effectiveField(AURA[0], "vsKinds"), []);
});

/* ---------------------------------------------------------------- */
/*  surviving regeneration, and getting back                         */
/* ---------------------------------------------------------------- */

t("a regenerated ability keeps its override — the whole point", () => {
  // What acks-content's Update does: throw the effects away and rebuild them
  // from the cookbook. The record is separate, so it still applies.
  const record = { [AC]: { set: { condition: "vs evil creatures" } } };
  const regenerated = structuredClone(AURA);
  assert.equal(regenerated[0].condition, undefined, "the cookbook's own value has no scope");
  assert.equal(applyOverrides(regenerated, record)[0].condition, "vs evil creatures");
});

t("refreshWas captures the book's value on the way past", () => {
  // The one moment the generated value exists before being overwritten.
  const record = refreshWas(AURA, { [SAVE]: { set: { condition: "" } } });
  assert.equal(record[SAVE].was.condition, "vs evil creatures");
  // And it TRACKS the book: a later printing that changes the scope updates it.
  const reprinted = [AURA[0], { ...AURA[1], condition: "vs chaotic creatures" }];
  assert.equal(refreshWas(reprinted, record)[SAVE].was.condition, "vs chaotic creatures");
});

t("refreshWas keeps the last known value for an orphaned key", () => {
  const record = { "throw|save||0": { set: { condition: "x" }, was: { condition: "y" } } };
  assert.deepEqual(refreshWas(AURA, record)["throw|save||0"].was, { condition: "y" });
});

t("reset restores the book's value, not a blank", () => {
  const record = refreshWas(AURA, { [SAVE]: { set: { condition: "" } } });
  const overridden = applyOverrides(AURA, record)[1];
  assert.equal(overridden.condition, "", "overridden: unconditional");
  const back = restoreEffect(overridden, record[SAVE]);
  assert.equal(back.condition, "vs evil creatures", "reset: the book's scope is back");
});

t("reset DELETES a field the book never had, rather than blanking it", () => {
  const record = refreshWas(AURA, { [AC]: { set: { condition: "house rule" } } });
  const back = restoreEffect(applyOverrides(AURA, record)[0], record[AC]);
  assert.equal(back.condition, "", "the book's AC has no scope, and `was` recorded that");
});

t("the guard is inert with no record — an unpinned edit is just an edit", () => {
  // Nothing here runs unless a record exists, and a record only exists because
  // someone ticked the per-row pin. So the plain path costs nothing and
  // changes nothing: the next regeneration wins, as it should.
  const regenerated = structuredClone(AURA);
  assert.deepEqual(applyOverrides(regenerated, {}), regenerated);
  assert.deepEqual(refreshWas(regenerated, {}), {});
  assert.deepEqual(orphanedKeys(regenerated, {}), []);
});

t("an override with nowhere to land is reported, never silently dropped", () => {
  const record = { [AC]: { set: { condition: "x" } }, "throw|save||0": { set: { condition: "y" } } };
  assert.deepEqual(orphanedKeys(AURA, record), ["throw|save||0"]);
  assert.deepEqual(orphanedKeys(AURA, { [AC]: { set: { condition: "x" } } }), []);
});

console.log(`\n${n} tests passed`);
