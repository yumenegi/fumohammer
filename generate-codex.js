#!/usr/bin/env node
// Regenerates codex.md from characters.yaml, the single source of truth for roster data.
const fs = require('fs');
const path = require('path');
const yaml = require('./js-yaml.min.js');

const YAML_PATH = path.join(__dirname, 'characters.yaml');
const OUT_PATH = path.join(__dirname, 'codex.md');

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `|${headers.map(() => '---').join('|')}|`;
  const body = rows.map(r => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

const note = s => s === undefined || s === '' ? '—' : s;

function renderCharacter(c) {
  const stats = mdTable(['Stat', 'Value'], [
    ['HP', c.hp], ['Spirit (max cap)', c.spirit], ['Speed', c.speed], ['Defense', c.defense],
  ]);
  const danmaku = mdTable(
    ['Name', 'Tier', 'Spirit Cost', 'Range', 'Damage', 'Type', 'Notes'],
    c.danmaku.map(m => [m.name, m.tier, m.cost, `${m.range}cm`, m.damage, m.type, note(m.notes)])
  );
  const melee = mdTable(
    ['Name', 'Tier', 'Spirit Cost', 'Damage', 'Type', 'Notes'],
    c.melee.map(m => [m.name, m.tier, m.cost, m.damage, m.type, note(m.notes)])
  );
  const spellCards = mdTable(
    ['Name', 'Spirit Cost', 'Uses/Game', 'Tier', 'Range', 'Type', 'Effect'],
    c.spellCards.map(s => [s.name, s.cost, s.uses, s.tier, `${s.range}cm`, s.type, s.effect])
  );

  return `### ${c.name}
- **Native Faction:** ${c.nativeFaction}
- **Zone Affinity:** ${c.zoneAffinity}
- **Lore blurb:** ${c.lore}

${stats}

**Danmaku Moves**
${danmaku}

**Melee Moves**
${melee}

**Spell Cards**
${spellCards}
`;
}

const HEADER = `# FUMOHAMMER CODEX
### Character Roster — Draft v0.1

> Companion document to [README.md](README.md) — see Section 9 (Character Cards) and Section 10 (Roster) there for how these cards plug into the systems. This file holds the actual stat blocks; the rulebook only defines what the fields mean.

> **Note on numbers:** stats are capped at 12 (README.md Section 4.1), and the values below use a damage range consistent with that cap. Whether these specific numbers are actually balanced — i.e. whether fumos die at a reasonable pace — isn't something to solve on paper; that's exactly what the first playtest is for.

> **Status effects:** README.md Section 7.6 defines the Frozen, Frostbite, Burnt, Sealed, Cursed, Blessed, and Weaken keywords, but each application's *duration* (in rounds, capped at 3) is set here on the specific move or Spell Card that inflicts it — write it directly into that move's Notes/Effect column, e.g. "Applies Frostbite for 2 rounds."

> **Range:** plain cm distances now, no templates (README.md Section 6.2) — every Danmaku move and Spell Card below lists its range in cm. Melee range is a fixed 10cm for everyone and isn't listed per-move.

> **Type:** every attack has a Type — "direct" (single target), "small arc" (90 degree), "large arc" (180 degree), or "annihilate" (full circle). Arc types are centered on the attacker's facing; see README.md Section 4.3.1 for the full rules. Every character in this roster is currently "direct" only — no one's been reclassified to use an arc yet.

---

## Card Template

Copy this block for any new character.

**[Name]**
- **Native Faction:** Gensokyolites / Lunarians / Flexible — flavor + triggers the match bonus in README.md Section 9.2. Does not restrict which team the fumo can actually be assigned to.
- **Zone Affinity:** —
- **Lore blurb:** —

| Stat | Value |
|---|---|
| HP | |
| Spirit (max cap) | |
| Speed | |
| Defense | |

**Danmaku Moves**
| Name | Tier | Spirit Cost | Range | Damage | Type | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |

**Melee Moves**
| Name | Tier | Spirit Cost | Damage | Type | Notes |
|---|---|---|---|---|---|
| | | | | | |

**Spell Cards** (uses per game — README.md Section 4.7)
| Name | Spirit Cost | Uses/Game | Tier | Range | Type | Effect |
|---|---|---|---|---|---|---|
| | | | | | | |

---

## Roster
`;

const FOOTER = `
## Notes

- All eight characters here are canonically Gensokyo residents — none are Lunarians. Since faction assignment is now free (README.md Section 9.2), any of them can still be fielded on Side B; they just won't get the Native Faction match bonus there. Worth deciding whether that's fine as-is, or whether you want at least one lunar-affiliated card (e.g. an Eirin/Kaguya/Reisen-type kit) in the pool so Side B has a shot at the bonus too.
- The Native Faction match bonus itself (Section 9.2) is still a TODO in README.md — no effect or magnitude defined yet.
- Spell Card damage and Spirit costs above assume the stat caps already locked into README.md (Section 4.1); they have not been playtested.
`;

const data = yaml.load(fs.readFileSync(YAML_PATH, 'utf8'));
const roster = data.characters.map(renderCharacter).join('\n---\n\n');
fs.writeFileSync(OUT_PATH, `${HEADER}\n${roster}\n---\n${FOOTER}`);
console.log(`codex.md regenerated from ${path.basename(YAML_PATH)} (${data.characters.length} characters)`);
