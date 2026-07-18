# Abilities — Design Model

Extends the core `ability` item — used for proficiencies, class powers, skills,
and monster abilities — with a structured, level-aware **effect model** and the
classification the ACKS books express, so an imported ability is a usable game
object (rollable, effect-bearing) even before its full prose is streamed.

- **Reuse**: the core `ability` item (name, description, proficiencytype,
  roll/rollType/rollTarget, requirements, save) and its sheet; the shared
  effect vocabulary + `LevelValue` + field-builders from **acks-lib** (`requires`).
- **Extend**: `flags["acks-abilities"].extras` — an `AbilityExtras` DataModel
  (blank numerics `null`, never 0): `category`, `general`, `repeatable`,
  `powerValue`, `deprecated`, `requires`, a `choice` branch, `effects[]` (the
  acks-lib typed primitives), and `defenses` (immunity/resistance/susceptibility).
- **Enhance**: an alternate ability sheet with an Effects tab (pending).
- **Invent**: nothing the system provides is duplicated.

## Decisions

- **2026-07-18 — flag-stored model, not a document sub-type** (mirrors
  acks-monsters): reuse the system's own `ability` item, add data via a flag
  DataModel + alternate sheet. Nothing mutates the acks system.
- **Effect vocabulary lives in acks-lib**, imported sibling-relative
  (`../../acks-lib/scripts/fields.mjs`) so it is one definition across the
  family. immunity/sense/movement/naturalAttack shapes are shared with the
  (deferred) monster migration.
- **Ownership is never stored here.** Which class or monster HAS an ability is
  defined by the container (a class/monster item lists its abilities), per the
  register model — the ability node is a reusable definition. `general` (the
  "(G)" marker) is the one membership fact tracked, because it is intrinsic.
- **Binding target for acks-content:** on import it writes this flag; the full
  literal prose stays a lazy `@PdfText` descriptor, the mechanical effect
  materializes per seat and persists here.
