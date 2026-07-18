# Changelog

## 0.1.0

- Initial scaffold from acks-module-template.
- **Ability effect model** — `AbilityExtras` DataModel stored at
  `flags["acks-abilities"].extras`: classification meta (`category`, `general`,
  `repeatable`, `powerValue`, `deprecated`, `requires`, `choice`) plus the
  structured, level-aware `effects[]` and `defenses`, built from the shared
  acks-lib field-builders (`requires acks-lib`).
- Exposes `globalThis.acksAbilities` + `game.modules.get("acks-abilities").api`
  (`AbilityExtras`, `getExtras(item)`). Alternate ability sheet pending.
