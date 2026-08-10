// Drift check: the skill states section names, sentence caps, trip statuses and
// pagination limits explicitly, which is what makes it useful and also what
// makes it rot. This compares every such claim against
// scripts/fixtures/live-surface.json, a snapshot of what the traveler.md MCP
// server actually advertises.
//
// The snapshot is deliberately a committed file rather than a live fetch: the
// tool schemas need an authenticated session, and pinning them means CI fails
// on an unreviewed divergence instead of silently tracking a moving target.
// Refreshing the snapshot is the deliberate act that surfaces a real change.
// See README, "Keeping the skill honest".
//
// Exit code 0 = the skill matches the snapshot.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = 'skills/travelermd';

const snap = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/live-surface.json'), 'utf8'));
// Memoised so the redundancy is structurally impossible rather than merely
// harmless: the status and scope checks each want the same few files.
const fileCache = new Map();
function read(rel) {
  if (!fileCache.has(rel)) fileCache.set(rel, readFileSync(join(ROOT, rel), 'utf8'));
  return fileCache.get(rel);
}

// Every markdown file in the skill, so a check cannot miss a claim by being
// pointed at a hand-maintained list of files that someone forgot to extend.
function skillFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.md')) out.push(rel);
    }
  };
  walk(SKILL_DIR);
  return out;
}

const results = [];
// Recorded through if/else rather than a ternary: a ternary in statement
// position trips `no-unused-expressions`, and hoisting the condition into two
// more ternaries (for the name and the detail) restated it three times per
// check and let the pass-name and fail-name drift apart.
const pass = (name, detail) => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

// Table rows look like: | `section_name` | 50 | prose |
function parseSectionTable(text) {
  const found = new Map();
  for (const row of text.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*(\d+)\s*\|/gm)) {
    found.set(row[1], Number(row[2]));
  }
  return found;
}

function compareSections(label, file, expected) {
  const documented = parseSectionTable(read(join(SKILL_DIR, file)));

  const missing = Object.keys(expected).filter((n) => !documented.has(n));
  if (missing.length === 0) {
    pass(`${label}: every section is documented`, `${Object.keys(expected).length} sections`);
  } else {
    fail(`${label}: every section is documented`, `missing: ${missing.join(', ')}`);
  }

  const invented = [...documented.keys()].filter((n) => !(n in expected));
  if (invented.length === 0) {
    pass(`${label}: no invented section names`);
  } else {
    fail(`${label}: no invented section names`, invented.join(', '));
  }

  const wrong = [...documented.entries()]
    .filter(([n, cap]) => n in expected && expected[n] !== cap)
    .map(([n, cap]) => `${n} documented ${cap}, actual ${expected[n]}`);
  if (wrong.length === 0) {
    pass(`${label}: every sentence cap matches`);
  } else {
    fail(`${label}: every sentence cap matches`, wrong.join('; '));
  }
}

compareSections('traveler.md sections', 'references/profile-sections.md', snap.profileSections);
compareSections('trip.md sections', 'references/trip-sections.md', snap.tripSections);

// Statuses. Two directions, and both sweep EVERY skill file rather than a
// hand-listed subset: the previous allowlist omitted profile-sections.md, so a
// wrong status there passed clean (verified).
const STATUS_FILES = ['SKILL.md', 'references/tools.md', 'references/trip-sections.md'];
for (const file of STATUS_FILES) {
  const text = read(join(SKILL_DIR, file));
  const missing = snap.statuses.filter((s) => !text.includes(`\`${s}\``));
  if (missing.length === 0) {
    pass(`${file}: enumerates all ${snap.statuses.length} trip statuses`);
  } else {
    fail(`${file}: enumerates all trip statuses`, `missing: ${missing.join(', ')}`);
  }
}

// The other direction, generalised: any backticked Title-case token anywhere in
// the skill that is not a current status is either retired or invented. This
// replaces a denylist that could only ever catch the values someone remembered.
// Error codes and section names are upper- or snake-case and so do not match.
const TITLE_CASE_TOKEN = /`([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*)`/g;
// Must contain a lowercase letter, which is what separates a status
// (`Trip In Progress`) from an error code (`CONFLICT`, `VALIDATION_ERROR`).
const isTitleCase = (s) => s !== s.toUpperCase();
for (const file of skillFiles()) {
  const found = new Set();
  for (const m of read(file).matchAll(TITLE_CASE_TOKEN)) {
    if (isTitleCase(m[1]) && !snap.statuses.includes(m[1])) found.add(m[1]);
  }
  const stray = [...found];
  const rel = file.slice(SKILL_DIR.length + 1);
  if (stray.length === 0) {
    pass(`${rel}: no retired or invented status values`);
  } else {
    fail(`${rel}: no retired or invented status values`, stray.join(', '));
  }
}

// Numeric claims in the tool reference.
const tools = read(join(SKILL_DIR, 'references/tools.md'));
const numeric = [
  {
    what: 'sentence max length',
    ok: tools.includes(`1 to ${snap.sentenceMaxLength} characters`),
    expected: snap.sentenceMaxLength,
  },
  {
    what: 'list_trips limit range',
    ok: tools.includes(`1 to ${snap.listTrips.limitMax}, default ${snap.listTrips.limitDefault}`),
    expected: `1..${snap.listTrips.limitMax} default ${snap.listTrips.limitDefault}`,
  },
];
for (const n of numeric) {
  if (n.ok) {
    pass(`tools.md states the correct ${n.what}`, String(n.expected));
  } else {
    fail(`tools.md states the correct ${n.what}`, `expected ${n.expected}`);
  }
}

// The skill tells agents to send `sections` on the three tools that require it
// despite not advertising it as required. That is a workaround for a server-side
// defect, so it MUST stop being documented once the defect is fixed. A fixture
// refresh after the fix empties `sectionsRequiredOn`, and this check then fails
// and forces the prose edit, rather than leaving six confidently wrong
// instructions in place behind nothing but human memory.
const REQUIRED_CLAIM = 'sections` is required where this reference says so';
const toolsText = read(join(SKILL_DIR, 'references/tools.md'));
const documentsTheTrap = toolsText.includes(REQUIRED_CLAIM);
if (snap.sectionsRequiredOn.length > 0) {
  const named = snap.sectionsRequiredOn.filter((tool) => toolsText.includes(tool));
  if (documentsTheTrap && named.length === snap.sectionsRequiredOn.length) {
    pass('tools.md documents the sections-required trap', snap.sectionsRequiredOn.join(', '));
  } else {
    fail(
      'tools.md documents the sections-required trap',
      `still required on ${snap.sectionsRequiredOn.join(', ')} but the note is missing or incomplete`,
    );
  }
} else if (documentsTheTrap) {
  fail(
    'tools.md no longer documents a fixed defect',
    'sections is now advertised as required everywhere; delete the workaround note here, in SKILL.md rule 3, and in the README',
  );
} else {
  pass('tools.md no longer documents a fixed defect');
}

// Sections the server marks private must be flagged as private in the skill, or
// an agent treats sensitive content as ordinary prose. Generalised over both
// documents, and an empty private set is a FAILURE: a fixture whose scopes were
// all flipped to public silently turned this check into a no-op (verified).
function compareScopes(file, scopes) {
  const names = Object.entries(scopes)
    .filter(([, kind]) => kind === 'private')
    .map(([name]) => name);
  if (names.length === 0) {
    fail(`${file} has private sections to flag`, 'the fixture lists none, which cannot be right');
    return;
  }
  const text = read(join(SKILL_DIR, file));
  const rows = text.split('\n').filter((l) => l.startsWith('|'));
  const unflagged = names.filter((name) => {
    const row = rows.find((l) => l.includes(`\`${name}\``));
    return !row || !/private/i.test(row);
  });
  if (unflagged.length === 0) {
    pass(`${file} flags every private section`, names.join(', '));
  } else {
    fail(`${file} flags every private section`, `unflagged: ${unflagged.join(', ')}`);
  }
}

compareScopes('references/profile-sections.md', snap.profileScopes);
compareScopes('references/trip-sections.md', snap.tripScopes);

const failures = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(
  `\n${results.length - failures.length}/${results.length} drift checks passed` +
    (failures.length ? ` — ${failures.length} FAILED` : ''),
);
process.exit(failures.length ? 1 : 0);
