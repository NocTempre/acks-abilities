# Changelog

## 0.2.0

- **Aliases are real abilities.** An entry the books list under one name whose
  rules text is printed under another is now its own item, not a redirect. It
  carries `aliasOf` and shows what it points at, and — because two names for one
  capability do not stack — a non-stacking relation to that entry.
- **Renames are surfaced.** A copy that arrived under an older name records
  `conversionFrom` and shows a note naming it: "*Detect Traps* has been renamed
  for ACKS II." Cautions and infos keep their existing wording; all three now
  carry an icon.
- **Reroll and companion effects render** on the Mechanics tab. A companion says
  so even when its actor slot is still empty, so a seat without the citing book
  sees what the ability confers rather than nothing.
- Conditional values (a ladder keyed on Arcane Value rather than level) display
  with the scale named. Requires acks-lib ≥ 0.2.0.

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
