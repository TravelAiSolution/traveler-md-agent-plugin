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

// --- 4. Path containment (spec 4.1) ---------------------------------------

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
