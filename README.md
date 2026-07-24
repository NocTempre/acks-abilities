# ACKS II — Abilities

Extended effect model and sheet for ACKS proficiencies, class powers, skills, and monster abilities.

A Foundry VTT module that extends the
[ACKS II game system](https://github.com/AutarchLLC/foundryvtt-acks-core).

## Installation

In Foundry: **Install Module** → paste the manifest URL:

```
https://github.com/NocTempre/acks-abilities/releases/latest/download/module.json
```

## Requirements

- Foundry VTT v14+
- ACKS II system (`acks`) v14+

## Integrating from another module

The model lives on the item at `flags["acks-abilities"].extras`. **Read it
through the API, not the raw flag** — the flag is storage, the API is the
contract, and the two have already diverged once.

```js
const api = game.modules.get("acks-abilities")?.api;   // or globalThis.acksAbilities
if (!api) return;                                       // degrade; never assume

const extras = api.getExtras(item);                     // an AbilityExtras instance
extras.category      // proficiency | classPower | skill | monsterAbility | …
extras.general       // the "(G)" general-proficiency marker
extras.effects       // typed acks-lib effect primitives
```

Rolls are **not** in this flag. Every throw an ability offers is system data:

```js
item.system.rolls                  // [{ key, label, formula, rollType, target, scale, … }]
await item.rollFormula({ key });   // roll one of them; omit `key` for the first
```

They lived in `extras.rolls` only while the core item could hold a single roll.
It now holds all of them, so there is one store and one roller — and no reason
for an ability's first throw to behave differently from its fourth.

### `qty` is not the effective rank

`extras.qty` is how many times the character **took** it — one item carrying a
count, never repeated copies. It is *not* the rank the mechanics read, and
treating it as one will be wrong for most of the corpus:

| ability | `qty` 2 means |
|---|---|
| Animal Husbandry | rank 2 of one thing |
| Weapon Proficiency | two different weapons |
| Art/Craft | a second discipline **or** a better first one |

So do not compute rank yourself:

```js
const rank   = api.rankOf(actor, item);          // the ability's own rule
const scales = api.scalesFor(actor, item);       // { level, rank }
const target = api.targetOf(roll, actor, item);  // resolved throw target, or null
```

These are now thin wrappers over the system's own `item.rank`, `item.rollScales`
and `item.rollTargetOf()`. Keep calling them: the wrapper is where per-ability
rank meaning will land, and it degrades gracefully on an older system.

`rankOf` currently returns the count, but it is the place where per-ability
meaning will land — and where "an alias grants +1 rank to its root" will be
applied. Calling it costs nothing now and keeps you correct later; reading
`extras.qty` directly does not.

### Selections — what each take chose

For the list-expanding half of the table above, the pick itself is data:
`extras.selections` is one string per take, order-aligned with `qty` —
Martial Training's weapon group, Weapon Focus's category, a Fighting Style
Specialization's style, Art's discipline. Rank-scaled abilities leave it
empty. It lives only on a **character's copy**; definitions stay
selection-free for the same reason they stay ownership-free.

Read picks through the API, never by parsing names:

```js
const picks = api.selectionsOf(item); // ["Axes"] — [] when none recorded
```

`selectionsOf` also absorbs the legacy convention of carrying the pick as a
"(X)" suffix on the item name (hand-made items, and the "(specialty)" suffix
the acks-content ability-provider stamps), so it is the single place that
interpretation lives. The vocabulary is deliberately free — the meaningful
token set is per-ability and printed in the book — so normalize before
matching (lowercase, alphanumeric fold), and treat an ability with takes but
no recorded picks as **unselected**, not as having picked nothing.

### Scoping — when a modifier applies

Whether a modifier applies to a *particular* roll (versus an alignment, within
an influence tone, against certain target kinds) is answered by **acks-lib**,
not here:

```js
const { applies, undetermined } = globalThis.acksLib.scopeApplies(effect, ctx);
```

Treat `undetermined` as distinct from `false`. A scope the context cannot
settle — an untyped target, no tone chosen — has not failed; collapsing the
two makes a bonus silently vanish against a target the GM merely hasn't
classified. Offer those as a manual toggle.

### Stability

`MODULE_ID`, `FLAG_EXTRAS`, `ABILITY_TYPE`, `getExtras`, `rankOf`,
`scalesFor`, `targetOf`, `selectionsOf` and `AbilityExtras` are the supported
surface.
Anything reached by importing `scripts/*.mjs` directly is internal and will
move without notice.

## Development

```
npm install
npm run build:packs   # rebuild compendium packs from packs/_source
npm run validate      # syntax / templates / JSON / packs / i18n checks
```

Releases are cut by pushing a `v<version>` tag matching `module.json`; GitHub
Actions builds and publishes `module.zip` + `module.json`.

This repo follows the shared ACKS module toolchain — see
`acks-module-template/docs/TOOLCHAIN.md` for conventions.

## License

**Code:** © NocTempre — proprietary; all rights reserved except as granted to
Autarch LLC under the **ACKS II App License**. This module is **not** open source
or Open Game Content, and no license is granted to copy, redistribute, or reuse
its code. See [`LICENSE`](LICENSE).

**ACKS II content** is used under the **ACKS II App License**. ACKS, ACKS II, and
Adventurer Conqueror King System are trademarks of **Autarch LLC**.

**Unofficial** — this is an unofficial fan module, not published or endorsed by
Autarch LLC.

**Registration #:** _[pending registration]_

**Requires:** Adventurer Conqueror King System II (ACKS II) _[name the specific
publication(s) this module needs]_. You must own them; this module is not a
substitute for the books and is free to use.
