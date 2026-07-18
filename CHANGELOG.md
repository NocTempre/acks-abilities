# Changelog

## 0.1.0

- Initial scaffold from acks-module-template.
- **Ability effect model** — `AbilityExtras` DataModel stored at
  `flags["acks-abilities"].extras`: classification meta (`category`, `general`,
  `repeatable`, `powerValue`, `deprecated`, `requires`, `choice`) plus the
  structured, level-aware `effects[]` and `defenses`, built from the shared
  acks-lib field-builders (`requires acks-lib`).
- **ACKS Ability sheet** — adds a *Mechanics* tab to the system's ability sheet
  rendering every structured effect in prose form (bonuses, grants, requires,
  proficiency grants, limitations, spell-likes, resources, defenses, choices),
  plus the classification header. Registered at `ready`, since
  `CONFIG.Item.sheetClasses` is not yet populated at `init`.
- **Retired-content notices** — an ability carried over from an earlier edition
  shows the acks-lib severity as a caution/info banner with its tooltip, and
  names its ACKS II successor (`replacedBy`) when one exists.
- Exposes `globalThis.acksAbilities` + `game.modules.get("acks-abilities").api`
  (`AbilityExtras`, `getExtras(item)`).

Effect rows are display-only for now — edit them through the flag until the
authoring UI lands.
