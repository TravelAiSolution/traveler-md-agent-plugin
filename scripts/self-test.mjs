// Self-test for scripts/validate.mjs AND scripts/check-drift.mjs.
//
// A validator that only ever prints PASS proves nothing. This copies the
// package to a temp directory, injects one deliberate fault at a time, and
// asserts that validate.mjs exits non-zero AND that the specific check meant
// to catch that fault is the one that failed. Asserting the check name is the
// point: it stops a fault from being "caught" by an unrelated failure.
//
// Each case names the script it targets (`under`), because a checker with no
// fault injection is a checker nobody has shown to work: check-drift.mjs scrapes
// markdown tables, so a reformat that stops the regex matching is exactly the
// silent failure this harness exists to rule out.
//
// Exit code 0 = every fault was caught by its intended check.

import { execFile, execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = 'skills/travelermd/SKILL.md';
const MARKETPLACE = '.agents/plugins/marketplace.json';
// One skill's harness config stands in for all six: the check loops over every
// skill directory, so a fault injected into any one of them exercises it.
const OPENAI_YAML = 'skills/add-trip/agents/openai.yaml';

// The Codex-facing metadata hangs off a reverse-domain namespace, so every case
// that targets it would otherwise repeat the same two lookups and would break
// silently if the namespace moved.
const iface = (manifest) => manifest.extensions['com.openai'];
// Width of the reporter's "FAIL  " / "PASS  " prefix in the checker output. The
// checkers and this harness have to agree on it; naming it makes that explicit
// rather than leaving a bare offset in a slice().
const MARK_WIDTH = 6;

const editJson = (dir, rel, mutate) => {
  const p = join(dir, rel);
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  mutate(doc);
  writeFileSync(p, JSON.stringify(doc, null, 2));
};

const editText = (dir, rel, find, replace) => {
  const p = join(dir, rel);
  const text = readFileSync(p, 'utf8');
  if (!text.includes(find)) throw new Error(`fixture drift: ${rel} no longer contains ${find}`);
  writeFileSync(p, text.replace(find, replace));
};

// Each case: a fault to inject, and a substring of the check name that must
// be the one to fail.
const CASES = [
  {
    what: 'forbidden top-level field in plugin.json',
    expect: 'plugin.json schema violation',
    apply: (d) => editJson(d, 'plugin.json', (m) => (m.hooks = {})),
  },
  {
    what: 'uppercase plugin name',
    expect: 'plugin.json schema violation',
    apply: (d) => editJson(d, 'plugin.json', (m) => (m.name = 'Traveler-MD')),
  },
  {
    what: 'consecutive hyphens in plugin name',
    expect: 'plugin.json schema violation',
    apply: (d) => editJson(d, 'plugin.json', (m) => (m.name = 'traveler--md')),
  },
  {
    what: 'mcp.json declares a different spec version than plugin.json',
    expect: 'mcp.json schema violation',
    apply: (d) => editText(d, 'mcp.json', 'schemas/1.0.0/mcp', 'schemas/1.1.0/mcp'),
  },
  {
    what: 'plaintext http to a non-loopback host',
    expect: 'uses HTTPS',
    apply: (d) => editText(d, 'mcp.json', 'https://mcp', 'http://mcp'),
  },
  {
    what: 'credential embedded in headers',
    expect: 'headers carry no credentials',
    apply: (d) =>
      editJson(d, 'mcp.json', (m) => {
        m.mcpServers.travelermd.headers = { Authorization: 'Bearer abc123' };
      }),
  },
  {
    what: 'duplicate header name differing only in case',
    expect: 'header names are unique',
    apply: (d) =>
      editJson(d, 'mcp.json', (m) => {
        m.mcpServers.travelermd.headers = { 'X-Tenant': 'a', 'x-tenant': 'b' };
      }),
  },
  {
    what: 'unknown field in a server entry',
    expect: 'mcp.json schema violation',
    apply: (d) =>
      editJson(d, 'mcp.json', (m) => {
        m.mcpServers.travelermd.oauth = {};
      }),
  },
  {
    what: 'url carries a fragment',
    expect: 'url carries no fragment',
    apply: (d) =>
      editJson(d, 'mcp.json', (m) => {
        m.mcpServers.travelermd.url = 'https://mcp.traveler.md/mcp#x';
      }),
  },
  {
    what: 'skill name no longer matches its directory',
    expect: 'name matches its directory',
    apply: (d) => editText(d, SKILL, 'name: travelermd', 'name: travelermd-x'),
  },
  {
    what: 'unknown frontmatter field',
    expect: 'frontmatter has no unknown fields',
    apply: (d) => editText(d, SKILL, 'compatibility:', 'hooks: yes\ncompatibility:'),
  },
  {
    what: 'over-long skill description',
    expect: 'description is 1-1024 chars',
    apply: (d) => {
      const p = join(d, SKILL);
      const text = readFileSync(p, 'utf8');
      writeFileSync(p, text.replace(/^description: .*$/m, `description: ${'x'.repeat(1025)}`));
    },
  },
  {
    what: 'broken relative link (the link target, not its text)',
    expect: 'link resolves in',
    apply: (d) => editText(d, SKILL, '](references/tools.md)', '](references/gone.md)'),
  },
  {
    what: 'SKILL.md missing from a skill directory',
    expect: 'SKILL.md is a regular file',
    apply: (d) => rmSync(join(d, SKILL)),
  },
  {
    what: 'symlink escaping the plugin root',
    expect: 'outside the plugin root',
    apply: (d) => symlinkSync('/etc/hosts', join(d, 'skills/travelermd/references/escape.md')),
  },
  {
    what: 'skill metadata.version drifting from plugin.json',
    expect: 'metadata.version matches plugin.json',
    apply: (d) => editJson(d, 'plugin.json', (m) => (m.version = '9.9.9')),
  },

  // --- Codex / OpenAI host compatibility ---
  {
    what: 'a field in the com.openai extension the host does not read',
    expect: 'declares only fields the host reads',
    apply: (d) => editJson(d, 'plugin.json', (m) => (iface(m).commands = './commands')),
  },
  {
    what: 'an interface field the host would silently ignore',
    expect: 'interface has no fields the host would ignore',
    apply: (d) => editJson(d, 'plugin.json', (m) => (iface(m).interface.iconUrl = 'x')),
  },
  {
    what: 'a fourth default prompt, past the host cap',
    expect: 'at most 3 entries',
    apply: (d) =>
      editJson(d, 'plugin.json', (m) => iface(m).interface.defaultPrompt.push('One more.')),
  },
  {
    what: 'a default prompt longer than the host truncates at',
    expect: 'entries are 1-128 chars',
    apply: (d) =>
      editJson(d, 'plugin.json', (m) => {
        iface(m).interface.defaultPrompt[0] = 'x'.repeat(129);
      }),
  },
  {
    what: 'a brand colour that is not a 6-digit hex',
    expect: 'brandColor is a 6-digit hex',
    apply: (d) =>
      editJson(d, 'plugin.json', (m) => {
        iface(m).interface.brandColor = 'turquoise';
      }),
  },
  {
    what: 'a plaintext http listing URL',
    expect: 'interface.websiteURL uses HTTPS',
    apply: (d) =>
      editJson(d, 'plugin.json', (m) => {
        iface(m).interface.websiteURL = 'http://traveler.md';
      }),
  },
  {
    // Renamed rather than repointed: the manifest keeps a path that looks
    // right, which is the way this actually breaks. A typo would be caught by
    // eye; a moved file would not.
    what: 'an interface asset whose file has been moved out from under it',
    expect: 'composerIcon resolves to a file that exists',
    apply: (d) => rmSync(join(d, 'assets/icon.png')),
  },
  {
    what: 'an interface asset path the host would reject for its prefix',
    expect: 'composerIcon starts with "./"',
    apply: (d) =>
      editJson(d, 'plugin.json', (m) => {
        iface(m).interface.composerIcon = 'assets/icon.png';
      }),
  },
  {
    what: 'an interface asset path escaping the plugin root',
    expect: 'composerIcon has no ".." component',
    apply: (d) =>
      editJson(d, 'plugin.json', (m) => {
        iface(m).interface.composerIcon = './../elsewhere/icon.png';
      }),
  },
  {
    what: 'mcp.json replaced by a symlink, which disables MCP silently',
    expect: 'not a symlink',
    apply: (d) => {
      renameSync(join(d, 'mcp.json'), join(d, 'mcp-real.json'));
      symlinkSync(join(d, 'mcp-real.json'), join(d, 'mcp.json'));
    },
  },
  {
    what: 'a skill nested deeper than the host discovers',
    expect: 'direct child of skills/<name>/',
    apply: (d) => {
      mkdirSync(join(d, 'skills/travelermd/nested'));
      writeFileSync(join(d, 'skills/travelermd/nested/SKILL.md'), '---\nname: nested\n---\n');
    },
  },
  {
    what: 'the documented-but-invalid ON_FIRST_USE auth policy',
    expect: 'policy.authentication is a value the host accepts',
    apply: (d) =>
      editJson(d, MARKETPLACE, (m) => {
        m.plugins[0].policy.authentication = 'ON_FIRST_USE';
      }),
  },
  {
    what: 'a marketplace entry naming a plugin this repo does not contain',
    expect: 'name matches plugin.json',
    apply: (d) =>
      editJson(d, MARKETPLACE, (m) => {
        m.plugins[0].name = 'traveler-md-legacy';
      }),
  },
  {
    what: 'a marketplace local source pointing outside its root',
    expect: 'local source path stays inside the marketplace root',
    apply: (d) =>
      editJson(d, MARKETPLACE, (m) => {
        m.plugins[0].source.path = './../elsewhere';
      }),
  },

  // --- Per-skill agents/openai.yaml ---
  //
  // This file is optional and no other client reads it, so nothing about a
  // broken one is visible at install time. That is exactly why it is checked.
  //
  // Anchor these injections on VALUE TEXT, never on a quote character. Prettier
  // owns the quote style in YAML and rewrites the vendor's double quotes to
  // single, so an anchor that includes one breaks on the next `pnpm format`
  // and the fault reads as MISSED rather than as the formatting change it is.
  {
    what: 'a short_description past the documented 64-character bound',
    expect: 'short_description is 25-64 chars',
    apply: (d) =>
      editText(
        d,
        OPENAI_YAML,
        'Build a new trip.md from known context and relevant sources.',
        'x'.repeat(65),
      ),
  },
  {
    // Copy-paste between skills is the way this actually breaks, and the prompt
    // still renders, naming the wrong skill.
    what: 'a default_prompt naming a different skill',
    expect: 'default_prompt references $add-trip',
    apply: (d) => editText(d, OPENAI_YAML, '$add-trip', '$trip-interview'),
  },
  {
    what: 'an interface field the harness does not document',
    expect: 'interface declares only documented fields',
    apply: (d) => editText(d, OPENAI_YAML, 'interface:\n', 'interface:\n  iconUrl: "x"\n'),
  },
  {
    what: 'a tool dependency naming a server mcp.json does not declare',
    expect: 'value names a server declared in mcp.json',
    apply: (d) => editText(d, OPENAI_YAML, 'travelermd', 'traveler-md'),
  },

  // --- check-drift.mjs ---
  {
    what: 'a section table reformatted so the row regex stops matching',
    under: 'check-drift.mjs',
    expect: 'every section is documented',
    apply: (d) =>
      editText(
        d,
        'skills/travelermd/references/profile-sections.md',
        '| `profile_overview`        | 10 ',
        '| `profile_overview` | public | 10 ',
      ),
  },
  {
    what: 'a cap edited in the prose but not in the fixture',
    under: 'check-drift.mjs',
    expect: 'every sentence cap matches',
    apply: (d) =>
      editText(
        d,
        'skills/travelermd/references/trip-sections.md',
        '| `itinerary`              | 100 ',
        '| `itinerary`              | 999 ',
      ),
  },
  {
    what: 'a retired status left in a file no allowlist covers',
    under: 'check-drift.mjs',
    expect: 'no retired or invented status values',
    apply: (d) =>
      editText(
        d,
        'skills/travelermd/references/profile-sections.md',
        'status `Dreaming`',
        'status `Active`',
      ),
  },
  {
    // The section tables live in travelermd; the sibling skills only NAME
    // sections in prose. Before the sweep covered every skill, a typo here was
    // a workflow that could not write, and it shipped green.
    what: 'an invented section name in a skill that holds no section table',
    under: 'check-drift.mjs',
    expect: 'every backticked identifier is a real section',
    apply: (d) =>
      editText(
        d,
        'skills/trip-interview/references/interview-map.md',
        '| `restaurants_food`       |',
        '| `restaurants`            |',
      ),
  },
  {
    what: 'a retired status in a skill outside the one that owns the tables',
    under: 'check-drift.mjs',
    expect: 'no retired or invented status values',
    apply: (d) =>
      editText(
        d,
        'skills/traveler-onboarding/references/trip-recovery.md',
        '- `Dreaming`: an aspiration',
        '- `Aspirational`: an aspiration',
      ),
  },
  {
    what: 'a fixture whose private scopes were all flipped to public',
    under: 'check-drift.mjs',
    expect: 'has private sections to flag',
    apply: (d) =>
      editJson(d, 'scripts/fixtures/live-surface.json', (f) => {
        for (const k of Object.keys(f.profileScopes)) f.profileScopes[k] = 'public';
        for (const k of Object.keys(f.tripScopes)) f.tripScopes[k] = 'public';
      }),
  },
];

// Sanity gate: the unmutated package must pass BOTH checkers, or every "caught"
// below is meaningless.
for (const script of ['scripts/validate.mjs', 'scripts/check-drift.mjs']) {
  try {
    execFileSync(process.execPath, [join(ROOT, script)], { cwd: ROOT });
    console.log(`PASS  baseline: the unmutated package passes ${script}`);
  } catch (err) {
    console.log(`FAIL  baseline: the unmutated package does not pass ${script}`);
    console.log(String(err.stdout ?? ''));
    process.exit(1);
  }
}
console.log();

// Cases are fully independent: each gets its own temp dir, its own read-only
// node_modules symlink and its own child process, so they run concurrently.
// Verdicts are collected by index and printed in CASES order, so the report
// stays deterministic. The cap keeps 19 node spawns from swamping a small runner.
const CONCURRENCY = Number(process.env.SELFTEST_CONCURRENCY ?? 6);

function runCase(c) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-plugin-selftest-'));
  for (const item of [
    'plugin.json',
    'mcp.json',
    'skills',
    'scripts',
    'package.json',
    '.agents',
    'assets',
  ]) {
    cpSync(join(ROOT, item), join(dir, item), { recursive: true });
  }
  // A symlink, not a copy, because installing per case would dominate the run.
  // NOTE: only node_modules may be shared this way. Symlinking `scripts` would
  // make Node resolve import.meta.url to the real repo, so the checker would
  // validate the pristine package and every fault would read as MISSED.
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));

  try {
    c.apply(dir);
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    return Promise.resolve({ ok: false, why: `could not inject the fault: ${err.message}` });
  }

  const script = join(dir, `scripts/${c.under ?? 'validate.mjs'}`);
  return new Promise((resolve) => {
    execFile(process.execPath, [script], { cwd: dir }, (err, stdout) => {
      rmSync(dir, { recursive: true, force: true });
      if (!err) {
        resolve({ ok: false, why: 'the checker passed a package it should have rejected' });
        return;
      }
      const failed = String(stdout)
        .split('\n')
        .filter((l) => l.startsWith('FAIL'));
      const hit = failed.find((l) => l.includes(c.expect));
      resolve(
        hit
          ? { ok: true, why: hit.slice(MARK_WIDTH, MARK_WIDTH + 90) }
          : {
              ok: false,
              why: `rejected, but not by "${c.expect}" — got: ${failed[0] ?? '(no FAIL line)'}`,
            },
      );
    });
  });
}

const verdicts = Array.from({ length: CASES.length });
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, CASES.length) }, async () => {
    while (next < CASES.length) {
      const i = next++;
      verdicts[i] = await runCase(CASES[i]);
    }
  }),
);

let failures = 0;
CASES.forEach((c, i) => {
  const v = verdicts[i];
  if (!v.ok) failures += 1;
  console.log(`${v.ok ? 'caught' : 'MISSED'}  ${c.what}\n        ${v.why}`);
});

console.log(
  `\n${CASES.length - failures}/${CASES.length} faults caught by their intended check` +
    (failures ? ` — ${failures} MISSED` : ''),
);
process.exit(failures ? 1 : 0);
