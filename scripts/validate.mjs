// Conformance checks for this Agent Plugins v1.0.0 package.
//
// Two layers:
//   1. JSON Schema validation of plugin.json and mcp.json against the published
//      1.0.0 schemas (vendored under scripts/schemas/, fetched from their
//      canonical URLs). Both are CLOSED schemas, so an unknown field is a real
//      failure. Spec 10.1 forbids reassigning a published schema identifier to
//      different contents, which is what makes vendoring safe.
//   2. The semantic and structural requirements the schemas cannot express:
//      component discovery, path containment, MCP URL and header rules, the
//      cross-file version match, and Agent Skills frontmatter.
//
// Exit code 0 = every check passed. 1 = at least one failure.

import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync, lstatSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_VERSION = '1.0.0';
const PLUGIN_SCHEMA_ID = `https://agent-plugins.org/schemas/${SPEC_VERSION}/plugin.schema.json`;
const MCP_SCHEMA_ID = `https://agent-plugins.org/schemas/${SPEC_VERSION}/mcp.schema.json`;

// Agent Skills spec: name 1-64 chars, lowercase alnum + hyphens, no leading or
// trailing hyphen, no consecutive hyphens.
const SKILL_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_SKILL_NAME = 64;
const MAX_DESCRIPTION = 1024;
const MAX_COMPATIBILITY = 500;

// Header names or env keys whose values would be credentials. Spec 7.2.1 and
// 9.2: headers and env are visible package data, never a secret mechanism.
const SECRET_HINT = /^(authorization|proxy-authorization|cookie|x-api-key|api[-_]?key)$/i;
const SECRET_VALUE = /(bearer\s+\S|sk-[a-z0-9]|ghp_|aws_secret|BEGIN [A-Z ]*PRIVATE KEY)/i;

const results = [];
// Recorded through if/else, never a ternary in statement position: that trips
// `no-unused-expressions`, and hoisting the condition into further ternaries for
// the name and the detail restated it three times per check and let a check's
// reported name differ between a passing and a failing run.
const pass = (name, detail) => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

function readJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function ajvValidate(schemaFile, doc, label) {
  const ajv = new Ajv2020.default({ strict: false, allErrors: true });
  const validate = ajv.compile(readJson(join('scripts/schemas', SPEC_VERSION, schemaFile)));
  if (validate(doc)) {
    pass(`${label} matches the published ${SPEC_VERSION} schema`);
    return true;
  }
  for (const e of validate.errors ?? []) {
    fail(`${label} schema violation`, `${e.instancePath || '/'} ${e.message}`);
  }
  return false;
}

// --- 1. Manifest -----------------------------------------------------------

let manifest;
if (!existsSync(join(ROOT, 'plugin.json'))) {
  fail('plugin.json present at the plugin root', 'not found; spec 4.1 requires it');
} else {
  try {
    manifest = readJson('plugin.json');
    pass('plugin.json parses as JSON');
  } catch (err) {
    fail('plugin.json parses as JSON', err.message);
  }
}

if (manifest) {
  ajvValidate('plugin.schema.json', manifest, 'plugin.json');

  if (manifest.$schema === PLUGIN_SCHEMA_ID) {
    pass(`plugin.json targets Agent Plugins ${SPEC_VERSION}`);
  } else {
    fail(`plugin.json targets Agent Plugins ${SPEC_VERSION}`, `$schema is ${manifest.$schema}`);
  }

  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    // Spec 10.2 only RECOMMENDS semver and forbids clients from rejecting on
    // it, so this is a note rather than a failure.
    pass('plugin version present', `"${manifest.version}" is not semver-shaped (allowed)`);
  }
}

// --- 2. MCP configuration --------------------------------------------------

const mcpPath = join(ROOT, 'mcp.json');
if (!existsSync(mcpPath)) {
  pass('mcp.json absent', 'allowed by spec 6.2; the plugin ships skills only');
} else if (!lstatSync(mcpPath).isFile()) {
  fail('mcp.json is a regular file', 'spec 6.2 makes a non-file component type invalid');
} else {
  let mcp;
  try {
    mcp = readJson('mcp.json');
    pass('mcp.json parses as JSON');
  } catch (err) {
    fail('mcp.json parses as JSON', err.message);
  }

  if (mcp) {
    ajvValidate('mcp.schema.json', mcp, 'mcp.json');

    // Spec 10.1: mcp.json's declared version MUST match plugin.json's. A
    // mismatch disables MCP for the whole plugin.
    const versionMatches = mcp.$schema === MCP_SCHEMA_ID;
    if (versionMatches) {
      pass(`mcp.json targets the same version as plugin.json (${SPEC_VERSION})`);
    } else {
      fail('mcp.json version matches plugin.json', `$schema is ${mcp.$schema}`);
    }

    for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
      const at = `mcpServers.${name}`;

      if (server.type === 'streamable-http' || server.type === 'sse') {
        let url;
        try {
          url = new URL(server.url);
        } catch {
          fail(`${at} url parses`, server.url);
        }
        if (url) {
          const loopback =
            url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === '[::1]';
          const httpsOk = url.protocol === 'https:' || loopback;
          if (httpsOk) {
            pass(`${at} uses HTTPS (or a loopback host)`);
          } else {
            fail(`${at} uses HTTPS`, `${url.protocol} to non-loopback ${url.hostname}`);
          }

          const noUserInfo = !url.username && !url.password;
          if (noUserInfo) {
            pass(`${at} url carries no user information`);
          } else {
            fail(`${at} url carries no user information`, 'spec 7.2.1 forbids it');
          }

          if (!url.hash) {
            pass(`${at} url carries no fragment`, url.hash ? 'spec 7.2.1 forbids it' : undefined);
          } else {
            fail(`${at} url carries no fragment`, url.hash ? 'spec 7.2.1 forbids it' : undefined);
          }
        }

        const headers = server.headers ?? {};
        const lowered = Object.keys(headers).map((h) => h.toLowerCase());
        const uniqueHeaders = new Set(lowered).size === lowered.length;
        if (uniqueHeaders) {
          pass(`${at} header names are unique case-insensitively`);
        } else {
          fail(`${at} header names are unique case-insensitively`, 'spec 7.2.1 invalidates it');
        }

        const leaky = Object.entries(headers).filter(
          ([h, v]) => SECRET_HINT.test(h) || SECRET_VALUE.test(String(v)),
        );
        if (leaky.length === 0) {
          pass(`${at} headers carry no credentials`, leaky.map(([h]) => h).join(', '));
        } else {
          fail(`${at} headers carry no credentials`, leaky.map(([h]) => h).join(', '));
        }
      }

      if (server.type === 'stdio') {
        // Spec 7.2.1: a single executable token, bare name or ./-relative.
        const oneToken = !/\s/.test(server.command);
        if (oneToken) {
          pass(`${at} command is one token`);
        } else {
          fail(`${at} command is one token`, `"${server.command}" looks like a shell string`);
        }

        const env = server.env ?? {};
        const reserved = Object.keys(env).filter((k) => k === 'PLUGIN_ROOT' || k === 'PLUGIN_DATA');
        if (reserved.length === 0) {
          pass(`${at} env does not set the reserved variables`, reserved.join(', '));
        } else {
          fail(`${at} env does not set the reserved variables`, reserved.join(', '));
        }

        const leakyEnv = Object.entries(env).filter(
          ([k, v]) => SECRET_HINT.test(k) || SECRET_VALUE.test(String(v)),
        );
        if (leakyEnv.length === 0) {
          pass(`${at} env carries no credentials`, leakyEnv.map(([k]) => k).join(', '));
        } else {
          fail(`${at} env carries no credentials`, leakyEnv.map(([k]) => k).join(', '));
        }

        if (server.cwd !== undefined) {
          const cwdOk = /^(\.\/|\$\{PLUGIN_ROOT\}(\/|$)|\$\{PLUGIN_DATA\}(\/|$))/.test(server.cwd);
          if (cwdOk) {
            pass(`${at} cwd uses a permitted form`);
          } else {
            fail(`${at} cwd uses a permitted form`, server.cwd);
          }
        }
      }
    }
  }
}

// --- 3. Skill discovery and the Agent Skills format ------------------------

const skillsDir = join(ROOT, 'skills');
if (!existsSync(skillsDir)) {
  pass('skills/ absent', 'allowed by spec 6.2');
} else if (!lstatSync(skillsDir).isDirectory()) {
  fail('skills/ is a directory', 'spec 6.2 makes a non-directory component type invalid');
} else {
  const children = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const hasSkills = children.length > 0;
  if (hasSkills) {
    pass(
      `skills/ has ${children.length} candidate skill director${children.length === 1 ? 'y' : 'ies'}`,
    );
  } else {
    fail('skills/ has at least one skill', 'the directory exists but is empty');
  }

  for (const child of children) {
    const dir = join(skillsDir, child.name);
    const skillMd = join(dir, 'SKILL.md');

    if (!existsSync(skillMd) || !lstatSync(skillMd).isFile()) {
      fail(`skills/${child.name}/SKILL.md is a regular file`, 'spec 7.1 skips the skill otherwise');
      continue;
    }
    pass(`skills/${child.name}/SKILL.md discovered`);

    const raw = readFileSync(skillMd, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) {
      fail(`skills/${child.name} has YAML frontmatter`, 'no leading --- block');
      continue;
    }

    let fm;
    try {
      fm = parseYaml(m[1]);
      pass(`skills/${child.name} frontmatter parses as YAML`);
    } catch (err) {
      fail(`skills/${child.name} frontmatter parses as YAML`, err.message);
      continue;
    }

    const allowed = new Set([
      'name',
      'description',
      'license',
      'compatibility',
      'metadata',
      'allowed-tools',
    ]);
    const unknown = Object.keys(fm).filter((k) => !allowed.has(k));
    if (unknown.length === 0) {
      pass(`skills/${child.name} frontmatter has no unknown fields`, unknown.join(', '));
    } else {
      fail(`skills/${child.name} frontmatter has no unknown fields`, unknown.join(', '));
    }

    const nameMatchesDir = fm.name === child.name;
    if (nameMatchesDir) {
      pass(`skills/${child.name} name matches its directory`);
    } else {
      fail(`skills/${child.name} name matches its directory`, `frontmatter name is "${fm.name}"`);
    }

    const skillNameOk =
      typeof fm.name === 'string' &&
      fm.name.length <= MAX_SKILL_NAME &&
      SKILL_NAME.test(fm.name) &&
      !fm.name.includes('--');
    if (skillNameOk) {
      pass(`skills/${child.name} name is well-formed`);
    } else {
      fail(`skills/${child.name} name is well-formed`, String(fm.name));
    }

    const desc = fm.description;
    const descOk = typeof desc === 'string' && desc.length >= 1 && desc.length <= MAX_DESCRIPTION;
    if (descOk) {
      pass(
        `skills/${child.name} description is 1-${MAX_DESCRIPTION} chars`,
        `${desc.length} chars`,
      );
    } else {
      fail(
        `skills/${child.name} description is 1-${MAX_DESCRIPTION} chars`,
        `${desc?.length ?? 'missing'}`,
      );
    }

    if (fm.compatibility !== undefined) {
      const compatOk =
        typeof fm.compatibility === 'string' && fm.compatibility.length <= MAX_COMPATIBILITY;
      if (compatOk) {
        pass(
          `skills/${child.name} compatibility is <=${MAX_COMPATIBILITY} chars`,
          `${fm.compatibility.length} chars`,
        );
      } else {
        fail(
          `skills/${child.name} compatibility is <=${MAX_COMPATIBILITY} chars`,
          String(fm.compatibility?.length),
        );
      }
    }

    if (fm.metadata !== undefined) {
      const flat =
        fm.metadata !== null &&
        typeof fm.metadata === 'object' &&
        !Array.isArray(fm.metadata) &&
        Object.values(fm.metadata).every((v) => typeof v === 'string');
      if (flat) {
        pass(`skills/${child.name} metadata is a string map`);
      } else {
        fail(`skills/${child.name} metadata is a string map`, 'values must all be strings');
      }

      // Two places state a version, and hosts use plugin.json's for update
      // checks and cache freshness. A skill that reports an older one is the
      // kind of drift nobody notices until a traveler asks which version they
      // are on.
      if (fm.metadata.version !== undefined) {
        if (fm.metadata.version === manifest?.version) {
          pass(`skills/${child.name} metadata.version matches plugin.json`);
        } else {
          fail(
            `skills/${child.name} metadata.version matches plugin.json`,
            `"${fm.metadata.version}" vs "${manifest?.version}"`,
          );
        }
      }
    }

    // Every relative markdown link in the skill must resolve to a real file.
    // A dead reference is a silent capability gap: the agent is told to read
    // something it cannot open.
    const bodyFiles = [skillMd, ...walk(join(dir, 'references'))];
    let broken = 0;
    let checked = 0;
    for (const file of bodyFiles) {
      const text = readFileSync(file, 'utf8');
      for (const link of text.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) {
        checked += 1;
        const target = resolve(dirname(file), link[1].split('#')[0]);
        if (!existsSync(target)) {
          fail(`link resolves in ${relative(ROOT, file)}`, link[1]);
          broken += 1;
        }
      }
    }
    if (broken === 0) {
      pass(`skills/${child.name} relative links all resolve`, `${checked} checked`);
    }
  }
}

// --- 4. Codex / OpenAI host compatibility ---------------------------------
//
// Codex loads THIS package directly: it looks for an Agent Plugins manifest at
// the plugin root first, and a root plugin.json whose $schema is the 1.0.0
// plugin schema is loaded as PluginManifestFormat::AgentPlugin. In that mode the
// host hardcodes `skills` to ./skills and `mcpServers` to ./mcp.json, so no
// .codex-plugin/plugin.json, .mcp.json or `skills` field is needed.
//
// What it does NOT infer is the install-surface metadata: without an override it
// synthesises displayName from `name`, category "Other" and shortDescription
// from the full `description`. That override is the one thing worth carrying,
// and it belongs under extensions["com.openai"], which the closed 1.0.0 schema
// permits and every other conforming client ignores. Codex reads exactly three
// fields from it and gives it precedence over a .codex-plugin/plugin.json file,
// which is why this package keeps a single manifest.
//
// Every rule below is taken from the host implementation rather than the docs
// page, because the two diverge. Anything the host silently drops is a failure
// here: a warning in someone else's log is not a signal we ever see.

const CODEX_NS = 'com.openai';
const CODEX_EXTENSION_FIELDS = new Set(['interface', 'apps', 'hooks']);
const CODEX_INTERFACE_FIELDS = new Set([
  'displayName',
  'shortDescription',
  'longDescription',
  'developerName',
  'category',
  'capabilities',
  'websiteURL',
  'privacyPolicyURL',
  'termsOfServiceURL',
  'defaultPrompt',
  'brandColor',
  'composerIcon',
  'logo',
  'logoDark',
  'screenshots',
]);
const CODEX_INTERFACE_TEXT = [
  'displayName',
  'shortDescription',
  'longDescription',
  'developerName',
  'category',
];
const CODEX_INTERFACE_URLS = ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL'];
const CODEX_ASSET_FIELDS = ['composerIcon', 'logo', 'logoDark'];
// MAX_DEFAULT_PROMPT_COUNT and MAX_DEFAULT_PROMPT_LEN in the host's manifest
// parser. Over either limit the extra prompts are dropped, not reported.
const MAX_DEFAULT_PROMPTS = 3;
const MAX_DEFAULT_PROMPT_LEN = 128;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// The host resolves every manifest-declared path through one rule: non-empty,
// `./`-prefixed, no `..` component. A path it rejects is dropped silently, so
// the listing renders without the asset and nothing says why.
function checkAssetPath(field, value) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${field} is a non-empty string`, String(value));
    return;
  }
  if (!value.startsWith('./')) {
    fail(`${field} starts with "./"`, value);
    return;
  }
  if (value.split('/').includes('..')) {
    fail(`${field} has no ".." component`, value);
    return;
  }
  if (!existsSync(join(ROOT, value.slice(2)))) {
    fail(`${field} resolves to a file that exists`, value);
    return;
  }
  pass(`${field} resolves to a file that exists`, value);
}

function checkDefaultPrompt(prompts) {
  const list = typeof prompts === 'string' ? [prompts] : prompts;
  if (!Array.isArray(list)) {
    fail('interface.defaultPrompt is a string or an array', typeof prompts);
    return;
  }
  if (list.length <= MAX_DEFAULT_PROMPTS) {
    pass(`interface.defaultPrompt has at most ${MAX_DEFAULT_PROMPTS} entries`, `${list.length}`);
  } else {
    fail(
      `interface.defaultPrompt has at most ${MAX_DEFAULT_PROMPTS} entries`,
      `${list.length}; the host drops the rest`,
    );
  }
  const bad = list.filter(
    (p) => typeof p !== 'string' || p.trim().length === 0 || p.length > MAX_DEFAULT_PROMPT_LEN,
  );
  if (bad.length === 0) {
    pass(`interface.defaultPrompt entries are 1-${MAX_DEFAULT_PROMPT_LEN} chars`);
  } else {
    fail(`interface.defaultPrompt entries are 1-${MAX_DEFAULT_PROMPT_LEN} chars`, bad.join(' | '));
  }
}

function checkCodexInterface(iface) {
  const unknown = Object.keys(iface).filter((k) => !CODEX_INTERFACE_FIELDS.has(k));
  if (unknown.length === 0) {
    pass('interface has no fields the host would ignore');
  } else {
    fail('interface has no fields the host would ignore', unknown.join(', '));
  }

  for (const field of CODEX_INTERFACE_TEXT) {
    if (iface[field] === undefined) continue;
    const ok = typeof iface[field] === 'string' && iface[field].trim().length > 0;
    if (ok) {
      pass(`interface.${field} is a non-empty string`);
    } else {
      fail(`interface.${field} is a non-empty string`, String(iface[field]));
    }
  }

  if (iface.capabilities !== undefined) {
    const ok =
      Array.isArray(iface.capabilities) &&
      iface.capabilities.every((c) => typeof c === 'string' && c.length > 0);
    if (ok) {
      pass('interface.capabilities is an array of non-empty strings');
    } else {
      fail('interface.capabilities is an array of non-empty strings', String(iface.capabilities));
    }
  }

  for (const field of CODEX_INTERFACE_URLS) {
    if (iface[field] === undefined) continue;
    let url;
    try {
      url = new URL(iface[field]);
    } catch {
      fail(`interface.${field} parses as a URL`, String(iface[field]));
      continue;
    }
    if (url.protocol === 'https:') {
      pass(`interface.${field} uses HTTPS`);
    } else {
      fail(`interface.${field} uses HTTPS`, url.protocol);
    }
  }

  if (iface.defaultPrompt !== undefined) checkDefaultPrompt(iface.defaultPrompt);

  if (iface.brandColor !== undefined) {
    if (HEX_COLOR.test(iface.brandColor)) {
      pass('interface.brandColor is a 6-digit hex colour');
    } else {
      fail('interface.brandColor is a 6-digit hex colour', String(iface.brandColor));
    }
  }

  for (const field of CODEX_ASSET_FIELDS) {
    if (iface[field] !== undefined) checkAssetPath(`interface.${field}`, iface[field]);
  }

  if (iface.screenshots !== undefined) {
    if (!Array.isArray(iface.screenshots)) {
      fail('interface.screenshots is an array', typeof iface.screenshots);
    } else {
      iface.screenshots.forEach((s, i) => checkAssetPath(`interface.screenshots[${i}]`, s));
    }
  }
}

if (manifest) {
  const extension = manifest.extensions?.[CODEX_NS];
  if (extension === undefined) {
    pass(
      `no ${CODEX_NS} extension`,
      'allowed; the host would synthesise displayName, category "Other" and a listing built from `description`',
    );
  } else {
    const unknown = Object.keys(extension).filter((k) => !CODEX_EXTENSION_FIELDS.has(k));
    if (unknown.length === 0) {
      pass(`${CODEX_NS} extension declares only fields the host reads`);
    } else {
      fail(`${CODEX_NS} extension declares only fields the host reads`, unknown.join(', '));
    }

    if (extension.interface === undefined) {
      pass(`${CODEX_NS} extension has no interface block`);
    } else if (typeof extension.interface !== 'object' || Array.isArray(extension.interface)) {
      fail(`${CODEX_NS} interface is an object`, typeof extension.interface);
    } else {
      checkCodexInterface(extension.interface);
    }
  }
}

// The host resolves the root manifest through symlink_metadata and gives up
// entirely if plugin.json is a symlink, so the plugin does not load at all. The
// same check on mcp.json disables MCP and keeps the skills, which is the quieter
// and therefore worse failure: the agent arrives knowing how to use tools it
// does not have.
for (const file of ['plugin.json', 'mcp.json']) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  if (lstatSync(path).isSymbolicLink()) {
    fail(`${file} is a regular file, not a symlink`, 'the host refuses to follow it');
  } else {
    pass(`${file} is a regular file, not a symlink`);
  }
}

// In Agent Plugins mode the host discovers skills as DIRECT children of skills/
// only, where the legacy format recursed. A skill nested any deeper is skipped
// without comment.
if (existsSync(skillsDir) && lstatSync(skillsDir).isDirectory()) {
  const nested = walk(skillsDir)
    .filter((f) => f.endsWith(`${sep}SKILL.md`))
    .filter((f) => relative(skillsDir, f).split(sep).length !== 2);
  if (nested.length === 0) {
    pass('every SKILL.md is a direct child of skills/<name>/');
  } else {
    fail(
      'every SKILL.md is a direct child of skills/<name>/',
      nested.map((f) => relative(ROOT, f)).join(', '),
    );
  }
}

// --- 4b. Per-skill OpenAI harness configuration (optional) ----------------
//
// A skill may carry agents/openai.yaml, which an OpenAI host's harness reads for
// the skill's install-surface name, blurb, example prompt and declared tool
// dependencies. The Agent Skills spec permits any files beyond SKILL.md, so this
// is invisible to every other client, and a skill without it still loads: the
// host synthesises a display name from `name` and a blurb from `description`.
//
// PROVENANCE, and it is weaker than the rest of this file. Every other host rule
// here was read off a shipping loader. These come from OpenAI's published
// skill-creator reference and its build-skills docs page, which is the same class
// of source the repo's conventions warn can disagree with the implementation.
// The 25-64 character bound on short_description in particular is documented
// author guidance, not a rejection threshold anyone has observed. Treat a failure
// here as "outside what the vendor documents", not "the host will drop this".
//
// Note the transport spelling: this file says `streamable_http` where mcp.json
// says `streamable-http`. Two schemas, two spellings, neither a typo.

const OPENAI_YAML = 'agents/openai.yaml';
const OPENAI_TOP_LEVEL = new Set(['interface', 'dependencies']);
const OPENAI_INTERFACE_FIELDS = new Set([
  'display_name',
  'short_description',
  'icon_small',
  'icon_large',
  'brand_color',
  'default_prompt',
]);
const OPENAI_TOOL_FIELDS = new Set(['type', 'value', 'description', 'transport', 'url']);
const OPENAI_TOOL_TYPES = new Set(['mcp']);
const SHORT_DESCRIPTION_MIN = 25;
const SHORT_DESCRIPTION_MAX = 64;

// Server names declared in mcp.json, so a per-skill dependency cannot name a
// server this package does not ship. A dependency pointing at nothing is the
// quiet failure: the host shows the skill as needing a tool that never connects.
const declaredServers = new Set(
  existsSync(mcpPath) ? Object.keys(readJson('mcp.json').mcpServers ?? {}) : [],
);

if (existsSync(skillsDir) && lstatSync(skillsDir).isDirectory()) {
  for (const child of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!child.isDirectory()) continue;
    const rel = `skills/${child.name}/${OPENAI_YAML}`;
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;

    let doc;
    try {
      doc = parseYaml(readFileSync(abs, 'utf8'));
      pass(`${rel} parses as YAML`);
    } catch (err) {
      fail(`${rel} parses as YAML`, err.message);
      continue;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      fail(`${rel} is a mapping`, String(doc));
      continue;
    }

    const unknownTop = Object.keys(doc).filter((k) => !OPENAI_TOP_LEVEL.has(k));
    if (unknownTop.length === 0) {
      pass(`${rel} declares only documented top-level keys`);
    } else {
      fail(`${rel} declares only documented top-level keys`, unknownTop.join(', '));
    }

    const iface = doc.interface;
    if (iface !== undefined) {
      if (typeof iface !== 'object' || iface === null || Array.isArray(iface)) {
        fail(`${rel} interface is a mapping`, typeof iface);
      } else {
        const unknown = Object.keys(iface).filter((k) => !OPENAI_INTERFACE_FIELDS.has(k));
        if (unknown.length === 0) {
          pass(`${rel} interface declares only documented fields`);
        } else {
          fail(`${rel} interface declares only documented fields`, unknown.join(', '));
        }

        if (iface.display_name !== undefined) {
          const ok = typeof iface.display_name === 'string' && iface.display_name.trim().length > 0;
          if (ok) {
            pass(`${rel} display_name is a non-empty string`);
          } else {
            fail(`${rel} display_name is a non-empty string`, String(iface.display_name));
          }
        }

        if (iface.short_description !== undefined) {
          const d = iface.short_description;
          const ok =
            typeof d === 'string' &&
            d.length >= SHORT_DESCRIPTION_MIN &&
            d.length <= SHORT_DESCRIPTION_MAX;
          if (ok) {
            pass(
              `${rel} short_description is ${SHORT_DESCRIPTION_MIN}-${SHORT_DESCRIPTION_MAX} chars`,
              `${d.length} chars`,
            );
          } else {
            fail(
              `${rel} short_description is ${SHORT_DESCRIPTION_MIN}-${SHORT_DESCRIPTION_MAX} chars`,
              `${typeof d === 'string' ? `${d.length} chars` : typeof d}`,
            );
          }
        }

        // The reference requires the prompt to name its own skill as
        // `$skill-name`. A prompt naming a different skill still renders, which
        // is why it needs checking rather than reading.
        if (iface.default_prompt !== undefined) {
          const p = iface.default_prompt;
          const ok = typeof p === 'string' && p.includes(`$${child.name}`);
          if (ok) {
            pass(`${rel} default_prompt references $${child.name}`);
          } else {
            fail(`${rel} default_prompt references $${child.name}`, String(p));
          }
        }

        if (iface.brand_color !== undefined) {
          if (HEX_COLOR.test(iface.brand_color)) {
            pass(`${rel} brand_color is a 6-digit hex colour`);
          } else {
            fail(`${rel} brand_color is a 6-digit hex colour`, String(iface.brand_color));
          }
        }

        // Icon paths resolve from the SKILL directory, not the plugin root,
        // which is the trap: ./assets/x.png here is skills/<name>/assets/x.png
        // and not the package's top-level assets/.
        for (const field of ['icon_small', 'icon_large']) {
          if (iface[field] === undefined) continue;
          const value = iface[field];
          if (typeof value !== 'string' || !value.startsWith('./')) {
            fail(`${rel} ${field} starts with "./"`, String(value));
          } else if (value.split('/').includes('..')) {
            fail(`${rel} ${field} has no ".." component`, value);
          } else if (!existsSync(join(skillsDir, child.name, value.slice(2)))) {
            fail(`${rel} ${field} resolves inside the skill`, value);
          } else {
            pass(`${rel} ${field} resolves inside the skill`, value);
          }
        }
      }
    }

    const deps = doc.dependencies;
    if (deps !== undefined) {
      const tools = deps.tools;
      if (!Array.isArray(tools)) {
        fail(`${rel} dependencies.tools is an array`, typeof tools);
      } else {
        tools.forEach((tool, i) => {
          const at = `${rel} dependencies.tools[${i}]`;
          if (typeof tool !== 'object' || tool === null || Array.isArray(tool)) {
            fail(`${at} is a mapping`, typeof tool);
            return;
          }

          const unknown = Object.keys(tool).filter((k) => !OPENAI_TOOL_FIELDS.has(k));
          if (unknown.length === 0) {
            pass(`${at} declares only documented fields`);
          } else {
            fail(`${at} declares only documented fields`, unknown.join(', '));
          }

          if (OPENAI_TOOL_TYPES.has(tool.type)) {
            pass(`${at} type is a supported value`, tool.type);
          } else {
            fail(
              `${at} type is a supported value`,
              `"${tool.type}"; expected one of ${[...OPENAI_TOOL_TYPES].join(', ')}`,
            );
          }

          // The dependency has to name a server this package actually ships, or
          // the host advertises a tool that can never connect.
          if (tool.type === 'mcp') {
            if (declaredServers.has(tool.value)) {
              pass(`${at} value names a server declared in mcp.json`, tool.value);
            } else {
              fail(
                `${at} value names a server declared in mcp.json`,
                `"${tool.value}"; mcp.json declares ${[...declaredServers].join(', ') || 'none'}`,
              );
            }
          }

          if (tool.url !== undefined) {
            let url;
            try {
              url = new URL(tool.url);
            } catch {
              fail(`${at} url parses`, String(tool.url));
            }
            if (url && url.protocol === 'https:') {
              pass(`${at} url uses HTTPS`);
            } else if (url) {
              fail(`${at} url uses HTTPS`, url.protocol);
            }
          }
        });
      }
    }
  }
}

// --- 5. Marketplace entry (optional) --------------------------------------
//
// Present so the repository can be installed by pointing a host at its Git URL
// rather than by cloning by hand. The enum values below are the host's, not the
// docs page's: the documented `ON_FIRST_USE` is not one of them, and an
// unrecognised value fails deserialisation of the WHOLE file, taking the
// marketplace with it.

const MARKETPLACE = '.agents/plugins/marketplace.json';
const INSTALL_POLICIES = new Set(['AVAILABLE', 'INSTALLED_BY_DEFAULT', 'NOT_AVAILABLE']);
const AUTH_POLICIES = new Set(['ON_INSTALL', 'ON_USE']);

if (!existsSync(join(ROOT, MARKETPLACE))) {
  pass(`${MARKETPLACE} absent`, 'optional; hosts can also install from a local path');
} else {
  let market;
  try {
    market = readJson(MARKETPLACE);
    pass(`${MARKETPLACE} parses as JSON`);
  } catch (err) {
    fail(`${MARKETPLACE} parses as JSON`, err.message);
  }

  if (market) {
    const named = typeof market.name === 'string' && market.name.length > 0;
    if (named) {
      pass(`${MARKETPLACE} has a name`);
    } else {
      fail(`${MARKETPLACE} has a name`, 'required by the host');
    }

    const entries = Array.isArray(market.plugins) ? market.plugins : [];
    if (entries.length > 0) {
      pass(`${MARKETPLACE} lists ${entries.length} plugin(s)`);
    } else {
      fail(`${MARKETPLACE} lists at least one plugin`, 'plugins must be a non-empty array');
    }

    for (const [i, entry] of entries.entries()) {
      const at = `${MARKETPLACE} plugins[${i}]`;

      // A name that does not match the manifest installs the plugin under a
      // namespace nothing else in this repo refers to.
      if (entry.name === manifest?.name) {
        pass(`${at} name matches plugin.json`);
      } else {
        fail(`${at} name matches plugin.json`, `"${entry.name}" vs "${manifest?.name}"`);
      }

      const policy = entry.policy ?? {};
      for (const [field, allowed] of [
        ['installation', INSTALL_POLICIES],
        ['authentication', AUTH_POLICIES],
      ]) {
        if (policy[field] === undefined) continue;
        if (allowed.has(policy[field])) {
          pass(`${at} policy.${field} is a value the host accepts`);
        } else {
          fail(
            `${at} policy.${field} is a value the host accepts`,
            `"${policy[field]}"; expected one of ${[...allowed].join(', ')}`,
          );
        }
      }

      const source = entry.source ?? {};
      if (source.source === 'local') {
        const path = source.path;
        const selfRooted = path === './' || path === '.';
        const contained =
          typeof path === 'string' &&
          (selfRooted || (path.startsWith('./') && !path.split('/').includes('..')));
        if (contained) {
          pass(`${at} local source path stays inside the marketplace root`, path);
        } else {
          fail(`${at} local source path stays inside the marketplace root`, String(path));
        }
      }
    }
  }
}

// --- 6. Path containment (spec 4.1) ---------------------------------------

let escapes = 0;
for (const file of walk(ROOT)) {
  const link = lstatSync(file);
  if (!link.isSymbolicLink()) continue;
  const target = realpathSync(file);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    fail('no package path resolves outside the plugin root', relative(ROOT, file));
    escapes += 1;
  }
}
if (escapes === 0) pass('no package path resolves outside the plugin root');

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// --- Report ----------------------------------------------------------------

const failures = results.filter((r) => !r.ok);
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(
  `\n${results.length - failures.length}/${results.length} checks passed` +
    (failures.length ? ` — ${failures.length} FAILED` : ''),
);
process.exit(failures.length ? 1 : 0);
