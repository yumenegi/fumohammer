const STORAGE_KEY = 'fumohammer-state';
let CHARACTER_PRESETS = [], ARTIFACT_POOL = [], STATUS_EFFECTS = {};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function spiritRegen(round) {
  if (round <= 2) return 1;
  if (round <= 4) return 2;
  if (round <= 6) return 3;
  if (round <= 8) return 4;
  return 5;
}

function isKo(fumo) { return fumo.hp <= 0 && fumo.maxHp > 0; }

function statDelta(fumo, stat) {
  return fumo.status.reduce((sum, e) => sum + (STATUS_EFFECTS[e.type][stat] || 0), 0);
}

function createFumo() {
  return {
    presetIndex: -1, name: '',
    maxHp: 0, hp: 0, maxSpirit: 0, spirit: 0, speed: 0, defense: 0,
    inBamboo: false, status: [], spellUses: {},
  };
}

function createSite() {
  return { artifactIndex: -1, points: { A: 0, B: 0 }, capturedBy: null, carrier: '' };
}

function createInitialState() {
  return {
    round: 1,
    teams: {
      A: { label: 'Gensokyolites', fumos: [createFumo(), createFumo(), createFumo()] },
      B: { label: 'Lunarians', fumos: [createFumo(), createFumo(), createFumo()] },
    },
    sites: [createSite(), createSite(), createSite()],
    objectives: { A: 0, B: 0 },
    rollLog: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt storage */ }
  return createInitialState();
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadState();

function applyPreset(fumo, presetIndex) {
  fumo.presetIndex = presetIndex;
  if (presetIndex < 0) return;
  const p = CHARACTER_PRESETS[presetIndex];
  fumo.name = p.name;
  fumo.maxHp = p.hp; fumo.hp = p.hp;
  fumo.maxSpirit = p.spirit; fumo.spirit = p.spirit;
  fumo.speed = p.speed; fumo.defense = p.defense;
  fumo.status = [];
  fumo.spellUses = {};
  p.spellCards.forEach(sc => { fumo.spellUses[sc.name] = sc.uses; });
}

function nextRound() {
  state.round += 1;
  for (const team of Object.values(state.teams)) {
    for (const fumo of team.fumos) {
      if (fumo.maxHp === 0 || isKo(fumo)) continue;
      const bonus = fumo.inBamboo ? 1 : 0;
      fumo.spirit = clamp(fumo.spirit + spiritRegen(state.round) + bonus, 0, fumo.maxSpirit);
      for (const effect of fumo.status) {
        fumo.hp = clamp(fumo.hp + (STATUS_EFFECTS[effect.type].hp || 0), 0, fumo.maxHp);
      }
      fumo.status = fumo.status
        .map(e => ({ ...e, duration: e.duration - 1 }))
        .filter(e => e.duration > 0);
    }
  }
  render();
  save();
}

function resetGame() {
  if (!confirm('Reset the whole tracker? This clears all HP, Spirit, sites and rolls.')) return;
  state = createInitialState();
  render();
  save();
}

function rollD20() {
  const value = 1 + Math.floor(Math.random() * 20);
  state.rollLog.unshift(value);
  state.rollLog = state.rollLog.slice(0, 12);
  render();
  save();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderHeader() {
  const rolls = state.rollLog.map(r => `<span>${r}</span>`).join(', ');
  return `
  <div class="site-header">
    <h1>Match Tracker</h1>
    <div>Round <strong>${state.round}</strong> <button data-action="next-round">Next Round (auto Spirit + status ticks)</button></div>
  </div>
  <div class="controls-row">
    <div>
      <button data-action="roll-d20">Roll d20</button>
      <span class="roll-result">${state.rollLog[0] ?? '—'}</span>
    </div>
    <div class="roll-log">Recent: ${rolls || '—'}</div>
    <div style="margin-left:auto"><button data-action="reset-game">Reset Tracker</button></div>
  </div>`;
}

function presetOptions(selected) {
  const opts = ['<option value="-1">— custom —</option>'];
  CHARACTER_PRESETS.forEach((p, i) => {
    opts.push(`<option value="${i}" ${i === selected ? 'selected' : ''}>${escapeHtml(p.name)}</option>`);
  });
  return opts.join('');
}

function renderStatusTags(fumo, team, idx) {
  if (!fumo.status.length) return '';
  return `<div class="status-tags">${fumo.status.map((e, i) => `
    <span class="status-tag">${e.type} (${e.duration})
      <button data-action="remove-status" data-team="${team}" data-idx="${idx}" data-status-idx="${i}">×</button>
    </span>`).join('')}</div>`;
}

function renderSpellCards(fumo, team, idx) {
  const preset = fumo.presetIndex >= 0 ? CHARACTER_PRESETS[fumo.presetIndex] : null;
  if (!preset || !preset.spellCards.length) return '';
  return preset.spellCards.map((sc, i) => `
    <div class="spell-row">
      <span><strong>${escapeHtml(sc.name)}</strong> (T${sc.tier}, ${sc.cost} spirit, ${sc.range}cm, ${sc.type}) — uses: ${fumo.spellUses[sc.name] ?? sc.uses}/${sc.uses}</span>
      <button data-action="use-spell" data-team="${team}" data-idx="${idx}" data-spell-idx="${i}">Use</button>
      <button data-action="restore-spell" data-team="${team}" data-idx="${idx}" data-spell-idx="${i}">Undo</button>
      <div class="spell-effect">${escapeHtml(sc.effect)}</div>
    </div>`).join('');
}

function renderMoveTable(fumo) {
  const preset = fumo.presetIndex >= 0 ? CHARACTER_PRESETS[fumo.presetIndex] : null;
  if (!preset) return '';
  const danmaku = preset.danmaku.map(m => `<tr><td>${escapeHtml(m.name)}</td><td>T${m.tier}</td><td>${m.cost}</td><td>${m.range}cm</td><td>${m.damage}</td><td>${escapeHtml(m.type)}</td><td>${escapeHtml(m.notes)}</td></tr>`).join('');
  const melee = preset.melee.map(m => `<tr><td>${escapeHtml(m.name)}</td><td>T${m.tier}</td><td>${m.cost}</td><td>—</td><td>${m.damage}</td><td>${escapeHtml(m.type)}</td><td>${escapeHtml(m.notes)}</td></tr>`).join('');
  return `
  <details>
    <summary>Moves</summary>
    <table>
      <tr><th>Name</th><th>Tier</th><th>Cost</th><th>Range</th><th>Dmg</th><th>Type</th><th>Notes</th></tr>
      ${danmaku}${melee}
    </table>
  </details>`;
}

function renderFumo(fumo, team, idx) {
  const effSpeed = fumo.speed + statDelta(fumo, 'speed');
  const effDefense = fumo.defense + statDelta(fumo, 'defense');
  const ko = isKo(fumo);
  return `
  <div class="fumo-card ${ko ? 'ko' : ''}">
    <div class="fumo-row">
      <select data-field="preset" data-team="${team}" data-idx="${idx}">${presetOptions(fumo.presetIndex)}</select>
      <input type="text" data-field="name" data-team="${team}" data-idx="${idx}" value="${escapeHtml(fumo.name)}" placeholder="name" style="width:8em">
      ${ko ? '<strong>KO</strong>' : ''}
    </div>
    <div class="stat-block">
      <div class="stat-field">
        <label>HP</label>
        <button data-action="hp-step" data-team="${team}" data-idx="${idx}" data-delta="-1">-</button>
        <input type="number" data-field="hp" data-team="${team}" data-idx="${idx}" value="${fumo.hp}">
        <span>/ ${fumo.maxHp}</span>
        <button data-action="hp-step" data-team="${team}" data-idx="${idx}" data-delta="1">+</button>
      </div>
      <div class="stat-field">
        <label>Spirit</label>
        <button data-action="spirit-step" data-team="${team}" data-idx="${idx}" data-delta="-1">-</button>
        <input type="number" data-field="spirit" data-team="${team}" data-idx="${idx}" value="${fumo.spirit}">
        <span>/ ${fumo.maxSpirit}</span>
        <button data-action="spirit-step" data-team="${team}" data-idx="${idx}" data-delta="1">+</button>
      </div>
      <div class="stat-field"><label>Speed</label><span>${effSpeed}${effSpeed !== fumo.speed ? ` (base ${fumo.speed})` : ''}</span></div>
      <div class="stat-field"><label>Def</label><span>${effDefense}${effDefense !== fumo.defense ? ` (base ${fumo.defense})` : ''}</span></div>
      <div class="stat-field"><label><input type="checkbox" data-field="inBamboo" data-team="${team}" data-idx="${idx}" ${fumo.inBamboo ? 'checked' : ''}> Bamboo Forest</label></div>
    </div>
    ${renderStatusTags(fumo, team, idx)}
    <div class="add-status-row">
      <select data-role="status-type">${Object.keys(STATUS_EFFECTS).map(t => `<option value="${t}">${t}</option>`).join('')}</select>
      <input type="number" data-role="status-duration" value="2" min="1" max="3" style="width:3em">
      <button data-action="add-status" data-team="${team}" data-idx="${idx}">Add status</button>
    </div>
    ${renderSpellCards(fumo, team, idx)}
    ${renderMoveTable(fumo)}
  </div>`;
}

function renderTeam(team) {
  const t = state.teams[team];
  return `
  <div class="team-panel" data-team="${team}">
    <h2>${escapeHtml(t.label)} (${team})</h2>
    ${t.fumos.map((f, i) => renderFumo(f, team, i)).join('')}
  </div>`;
}

function fumoOptions(team, selected) {
  const opts = ['<option value="">—</option>'];
  state.teams[team].fumos.forEach((f, i) => {
    const label = f.name || `slot ${i + 1}`;
    opts.push(`<option value="${i}" ${String(i) === String(selected) ? 'selected' : ''}>${escapeHtml(label)}</option>`);
  });
  return opts.join('');
}

function renderSites() {
  const rows = state.sites.map((s, i) => {
    const artifact = s.artifactIndex >= 0 ? ARTIFACT_POOL[s.artifactIndex] : null;
    return `
    <div class="site-card">
      <div class="fumo-row">
        <strong>Site ${i + 1}</strong>
        <select data-field="site-artifact" data-idx="${i}">
          <option value="-1">— none rolled —</option>
          ${ARTIFACT_POOL.map((a, ai) => `<option value="${ai}" ${ai === s.artifactIndex ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </div>
      ${artifact ? `<div class="spell-effect">${escapeHtml(artifact.effect)}</div>` : ''}
      <div class="fumo-row">
        <span>A: ${s.points.A}/3</span>
        <button data-action="site-points" data-idx="${i}" data-team="A" data-delta="-1">-</button>
        <button data-action="site-points" data-idx="${i}" data-team="A" data-delta="1">+</button>
        <span>B: ${s.points.B}/3</span>
        <button data-action="site-points" data-idx="${i}" data-team="B" data-delta="-1">-</button>
        <button data-action="site-points" data-idx="${i}" data-team="B" data-delta="1">+</button>
        <button data-action="site-reset" data-idx="${i}">Reset</button>
      </div>
      ${s.capturedBy ? `
      <div class="fumo-row">
        <strong>Captured by ${s.capturedBy}</strong> — carrier:
        <select data-field="site-carrier" data-idx="${i}">${fumoOptions(s.capturedBy, s.carrier)}</select>
      </div>` : ''}
    </div>`;
  }).join('');
  return `<div class="panel"><h2>Artifact Sites (Bamboo Forest)</h2>${rows}</div>`;
}

function renderObjectives() {
  const rows = ['A', 'B'].map(team => {
    const other = team === 'A' ? 'B' : 'A';
    const pts = state.objectives[team];
    return `
    <div class="fumo-row">
      <span>${state.teams[team].label} into ${state.teams[other].label}'s home: ${pts}/6 ${pts >= 6 ? '(CONTROLLED)' : ''}</span>
      <button data-action="obj-points" data-team="${team}" data-delta="-1">-</button>
      <button data-action="obj-points" data-team="${team}" data-delta="1">+</button>
    </div>`;
  }).join('');
  return `<div class="panel"><h2>Objective Control</h2>${rows}</div>`;
}

function render() {
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    <div class="teams-row">${renderTeam('A')}${renderTeam('B')}</div>
    <div class="sites-row">${renderSites()}${renderObjectives()}</div>
    <footer>State saves automatically to this browser only. Full rules and roster: <a href="https://github.com/yumenegi/fumohammer" target="_blank" rel="noopener">github.com/yumenegi/fumohammer</a></footer>`;
}

function getFumo(team, idx) { return state.teams[team].fumos[idx]; }

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const team = el.dataset.team, idx = Number(el.dataset.idx), delta = Number(el.dataset.delta);

  if (action === 'next-round') return nextRound();
  if (action === 'reset-game') return resetGame();
  if (action === 'roll-d20') return rollD20();

  if (action === 'hp-step') {
    const f = getFumo(team, idx);
    f.hp = clamp(f.hp + delta, 0, f.maxHp);
  } else if (action === 'spirit-step') {
    const f = getFumo(team, idx);
    f.spirit = clamp(f.spirit + delta, 0, f.maxSpirit);
  } else if (action === 'add-status') {
    const card = el.closest('.fumo-card');
    const type = card.querySelector('[data-role="status-type"]').value;
    const duration = clamp(Number(card.querySelector('[data-role="status-duration"]').value), 1, 3);
    getFumo(team, idx).status.push({ type, duration });
  } else if (action === 'remove-status') {
    getFumo(team, idx).status.splice(Number(el.dataset.statusIdx), 1);
  } else if (action === 'use-spell') {
    const f = getFumo(team, idx);
    const sc = CHARACTER_PRESETS[f.presetIndex].spellCards[Number(el.dataset.spellIdx)];
    if ((f.spellUses[sc.name] ?? sc.uses) > 0) {
      f.spellUses[sc.name] = (f.spellUses[sc.name] ?? sc.uses) - 1;
      f.spirit = clamp(f.spirit - sc.cost, 0, f.maxSpirit);
    }
  } else if (action === 'restore-spell') {
    const f = getFumo(team, idx);
    const sc = CHARACTER_PRESETS[f.presetIndex].spellCards[Number(el.dataset.spellIdx)];
    f.spellUses[sc.name] = (f.spellUses[sc.name] ?? sc.uses) + 1;
  } else if (action === 'site-points') {
    const site = state.sites[idx];
    site.points[team] = clamp(site.points[team] + delta, 0, 3);
    if (site.points[team] >= 3 && !site.capturedBy) site.capturedBy = team;
  } else if (action === 'site-reset') {
    state.sites[idx] = createSite();
  } else if (action === 'obj-points') {
    state.objectives[team] = clamp(state.objectives[team] + delta, 0, 6);
  } else {
    return;
  }
  render();
  save();
}

function onChange(e) {
  const el = e.target;
  const field = el.dataset.field;
  if (!field) return;
  const team = el.dataset.team, idx = Number(el.dataset.idx);

  if (field === 'preset') applyPreset(getFumo(team, idx), Number(el.value));
  else if (field === 'name') getFumo(team, idx).name = el.value;
  else if (field === 'hp') getFumo(team, idx).hp = clamp(Number(el.value), 0, getFumo(team, idx).maxHp);
  else if (field === 'spirit') getFumo(team, idx).spirit = clamp(Number(el.value), 0, getFumo(team, idx).maxSpirit);
  else if (field === 'inBamboo') getFumo(team, idx).inBamboo = el.checked;
  else if (field === 'site-artifact') state.sites[Number(el.dataset.idx)].artifactIndex = Number(el.value);
  else if (field === 'site-carrier') state.sites[Number(el.dataset.idx)].carrier = el.value;
  else return;
  render();
  save();
}

const app = document.getElementById('app');

async function init() {
  try {
    const res = await fetch('characters.yaml');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = jsyaml.load(await res.text());
    CHARACTER_PRESETS = data.characters;
    ARTIFACT_POOL = data.artifacts;
    STATUS_EFFECTS = data.statusEffects;
  } catch (err) {
    app.innerHTML = `<p style="padding:20px">Couldn't load characters.yaml (${err.message}). This page must be served over HTTP, not opened directly as a file — try VS Code's "Live Server" extension or run <code>npx serve</code> in the webapp folder.</p>`;
    return;
  }
  app.addEventListener('click', onClick);
  app.addEventListener('change', onChange);
  render();
}

init();
