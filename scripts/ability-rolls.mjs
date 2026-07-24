/**
 * Roll helpers — now a THIN DELEGATION LAYER over the system.
 *
 * These used to be the module's own roll engine, because the core ability item
 * carried exactly one roll (`roll` / `rollType` / `rollTarget`) and most ACKS
 * proficiencies offer several. The system now stores every roll in
 * `system.rolls` and resolves them itself, so there is one implementation and
 * the module keeps only the published names pointing at it.
 *
 * `rankOf`, `scalesFor` and `targetOf` remain on the public API (acks-equipment
 * reads `rankOf` for Armor Training). `rollAbility` is gone: rolling goes
 * through the item — `item.rollFormula({ key })`.
 *
 * @see foundryvtt-acks-core src/module/documents/item.mjs
 * @see foundryvtt-acks-core src/module/data/common/level-value.mjs
 */

/**
 * How many times an actor has this ability. The books rate several
 * proficiencies by rank ("if the character selects Animal Husbandry twice…"),
 * and taking it twice is how you hold rank 2 — so rank is the count of
 * same-named ability items the actor carries.
 *
 * Delegates to the system's own `item.rank`. The fallback covers a system too
 * old to define it; it is the same rule, not a second policy.
 */
export function rankOf(actor, item) {
  if (!actor || !item) return 1;
  if (actor === item.actor && typeof item.rank === "number") return item.rank;

  const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const mine = slug(item.name);
  return Math.max(1, actor.items.filter((i) => i.type === item.type && slug(i.name) === mine).length);
}

/** The scales a target may be keyed on, for this actor holding this item. */
export function scalesFor(actor, item) {
  if (actor && actor === item?.actor && item.rollScales) return item.rollScales;
  return {
    level: Number(actor?.system?.details?.level ?? actor?.system?.level ?? 1) || 1,
    rank: rankOf(actor, item),
  };
}

/**
 * Resolve a roll's target number, or null when it cannot be known here.
 *
 * Prefers the system's resolver (exposed at `game.acks.lib`), then acks-lib's
 * own — they are the same function, the system's copy being the upstreamed one.
 */
export function targetOf(roll, actor, item) {
  const resolve = globalThis.game?.acks?.lib?.resolveLevelValue ?? globalThis.acksLib?.resolveLevelValue;
  if (!resolve) return roll?.target?.flat ?? null;
  const scales = scalesFor(actor, item);
  return resolve(roll?.target, scales.level, scales);
}
