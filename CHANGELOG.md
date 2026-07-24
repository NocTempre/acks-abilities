# Changelog

## 0.8.0

**One roller, one store, three tabs.**

- **This module now owns core's ability roll path.** `AcksItem#rollFormula`
  reads `system.roll` / `rollType` / `rollTarget` directly and can only ever
  make one roll — so the character sheet, the chat card, `item.use()` and any
  macro reached an ability's *first* throw while the Rolls tab showed all four.
  `#rollFormula` and `#getTags` are wrapped (lib-wrapper, `ability` items only;
  everything else falls through) and routed to the same `rollAbility()` the
  sheet uses. New requirement: **lib-wrapper**.
- **An ability with no throw now shows itself instead of rolling.** Core means
  to do this — `use()` has the branch — but it tests `system.roll`, which
  defaults to `"1d20"` and is always truthy, so proficiencies that make no
  throw posted a d20 scored against a target of 0.
- **`rollsOf(item)` is the single read path**, on the public API. It returns
  this module's `extras.rolls`, folding core's singleton fields in for items it
  has not written — so nothing needs migrating and nothing writes a shadow copy
  back to core. A core record at its schema defaults is *not* a roll.
- **Tags show every roll**, and a ladder with no character to resolve against
  says so rather than printing the rung that happens to be first.
- **Three tabs: description, rolls, mechanics.** The roll fields come off the
  Description tab by swapping the details partial core resolves — core's
  description template itself is reused untouched. Foundry's Active Effects
  move into **Mechanics**, which previously sat beside a separate "Effects"
  tab: two tabs both meaning "effects" described the implementation, not the
  ability.

## 0.6.2

- Add the `url` field to the manifest (GitHub repo link), matching the rest of
  the family.

## 0.6.1

- **Integration instructions.** The README documented installation and nothing
  about how another module reads the model — so every consumer was guessing at
  the flag shape. Adds a contract: read through the API, not the raw flag.
- **`rankOf`, `scalesFor` and `targetOf` are now on the public API.** They
  were internal, which left a consumer no way to ask what a count MEANS
  without re-deriving it — and re-deriving it is wrong for every ability that
  spends its count on a list rather than a rank. `rankOf` is also where the
  per-ability rule and the alias rank-grant will land, so calling it now keeps
  a consumer correct later.
- README states which surface is supported and that anything imported from
  `scripts/*.mjs` is internal and will move.

## 0.6.0

- **An ability taken more than once is one row with a count.** New
  `extras.qty` — "Times Taken" — so three ranks of Animal Husbandry are one
  entry reading ×3, the way a stack of arrows is one inventory line, instead
  of three identical rows.
  - Shown only when it says something: silent on a non-repeatable ability
    sitting at 1, because "×1" on every sheet is noise.
  - **A count above 1 on a non-repeatable ability draws in red.** That
    combination is a contradiction in the data, and the silence rule would
    otherwise have hidden the one case worth seeing.
- **`qty` is not the effective rank, and conflating them is the bug.** `qty`
  is how many times *you took it*; the rank the mechanics read is
  `qty + Σ(granted ranks)`. Holding one ability by two names is not rank 2 by
  duplication — an alias grants "+1 rank of X" and the root absorbs it while
  its own count stays put, so the alias stays visible as a contributor rather
  than vanishing into an unexplained number.
- What a count MEANS is deliberately not modelled yet: another rank of one
  thing (Animal Husbandry), another pick from a list (Weapon Proficiency), or
  either (Art/Craft). `rankOf()` is one reading of qty — right for the first,
  wrong for the others — so it is left alone rather than rewritten into a
  confident lie.
- Requires acks-lib ≥ 0.6.0 for the scoping primitives.

## 0.5.0

- **Unverified mechanics say so.** Abilities whose mechanics were classified by
  the extraction scan rather than read against the printed page now show
  "Machine-classified — not yet chef-audited." on the Mechanics and Rolls tabs.
  A wrong sign or a missed bonus must read as a machine draft, never as the
  book's ruling — Blind Fighting prints a −2 that is a net *bonus* because it
  replaces a −4, and a scan cannot know that. The notice clears per ability as
  each one is signed off. Needs acks-content ≥ 0.15.0 to supply the flag.
- **A modifier says whose roll it is.** An effect carrying `appliesTo` of
  `opponent` or `ally` now leads with the subject instead of silently reading as
  the character's own. Hiding penalises the OPPONENT's surprise roll; rendered
  without the subject it looked like a penalty on the thief. Requires
  acks-lib ≥ 0.5.0.
- Removed a render path for `savePenalty`, a field acks-lib does not declare
  and nothing ever stored — found by the same audit.

## 0.4.0

- **A Rolls tab.** An ability is not one roll — Animal Husbandry diagnoses,
  cures, cures serious injury and extracts venom — and the core item carries a
  single roll/target that can only hold one of them. Each roll an ability offers
  now gets its own row and its own button, with its target resolved for the
  character holding it and its whole progression shown when the target varies.
- **Rank is understood.** Several proficiencies improve by how many times they
  have been taken rather than by level; a copy on an actor resolves its rank
  from how many of that ability the actor carries.
- Rolling reports success only when a target is actually known. On a shared
  world item there is no character to resolve a ladder against, so the roll
  stands on its own rather than being scored against a guess.

## 0.3.2

- **Modifier rows show their qualifier.** A bare "+4" claims a bonus always
  applies; most apply only while ambushing, negotiating or casting. A modifier
  marked situational now says so, one that supersedes a default reads "replaces
  the default", and one that negates a penalty reads "does not apply" instead of
  showing a meaningless +0.

## 0.3.1

- **A per-level progression renders as a table.** A ladder read off a printed
  per-level grid (a thief skill's fourteen levels) was being listed inline as
  "19 @1, 18 @2, 17 @3, …" — unreadable, and it read as though the value only
  changed at those points rather than at every level. Contiguous ladders now
  show a Level/Throw table with the span summarised above it; sparse ones
  (+1/+2/+3 at 1st/7th/13th) still list inline, which is what they are.

## 0.3.0

- **Capabilities.** An ability now records what it lets you *do* (`provides`),
  independently of the entry granting it, and the Mechanics tab shows them.
  A prerequisite written against a capability is met by any ability providing
  it, and holding one capability twice does not stack. Requires acks-lib >= 0.3.0.

## 0.2.1

- **The ACKS Ability sheet is now the default** for ability items. It registered
  correctly before but was not default, so the Mechanics tab was invisible
  unless a GM went and selected the sheet by hand. Safe to default: it subclasses
  the system's own ability sheet and keeps every tab that sheet defines, so this
  adds a tab and removes nothing. The plain sheet is still selectable per item.
- References read as names, not ids: "Its rules text is printed under *Longeval*"
  rather than `def.power.longeval`. Falls back to the id when the referenced
  ability is not in the world.
- Reroll rows no longer read "Reroll roll Attack Throw".

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
