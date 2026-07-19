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
extras.rolls         // every throw the ability offers, each with its own target
```

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

`rankOf` currently returns the count, but it is the place where per-ability
meaning will land — and where "an alias grants +1 rank to its root" will be
applied. Calling it costs nothing now and keeps you correct later; reading
`extras.qty` directly does not.

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
`scalesFor`, `targetOf` and `AbilityExtras` are the supported surface.
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
