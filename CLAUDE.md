# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project shape

This repo is an [Agent Plugins v1.0.0](https://agent-plugins.org/specification) package for the
traveler.md MCP server. **It is content, not an application.** There is no build, no server, no
framework. The deliverables are:

```
plugin.json                  # portable manifest (closed schema, 10 permitted fields)
mcp.json                     # one streamable-http MCP server (closed schema)
skills/travelermd/           # one Agent Skill: SKILL.md + references/
scripts/                     # validation tooling ONLY, not part of the plugin
```

The single most important property is that **the skill's factual claims are true**. It states
argument names, section names, sentence caps, trip statuses, OAuth scopes and error codes
explicitly. Every one of those is a claim about a live production API. A wrong claim is worse than
no skill, because an agent will act on it against a real traveler's data.

Every claim is verifiable against the traveler.md server's own schema definitions. The map from a
class of claim to the file that defines it lives with the server, in `docs/agent-plugin.md` in that
repository, together with the command that regenerates `scripts/fixtures/live-surface.json`. Both need
a server checkout, so neither belongs in this public repo.

## Commands

```bash
pnpm validate       # spec conformance: both closed schemas + the structural rules
                    # they cannot express (version match, HTTPS, no credentials in
                    # headers, skill discovery, frontmatter, links, containment)
pnpm self-test      # injects faults one at a time, into BOTH checkers, and asserts
                    # each is caught by its intended check, so neither can pass
                    # vacuously (SELFTEST_CONCURRENCY=1 to serialise when debugging)
pnpm check-drift    # the skill's tables vs scripts/fixtures/live-surface.json
pnpm test           # all three, in that order

pnpm lint           # oxlint — fast local pass
pnpm lint:ci        # eslint --max-warnings 0 — the AUTHORITY
pnpm lint:fix       # oxlint --fix
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
```

There is deliberately **no `typecheck` script**: there is no TypeScript here. If a script grows
enough to want types, add TS and port the type-aware config from the sibling repos rather than
bolting `checkJs` onto the flat config.

`.oxlintrc.json` must stay a strict **subset** of `eslint.config.mjs`, so `pnpm lint` never fails on
code `pnpm lint:ci` accepts.

## Definition of Done

1. **A change to the skill's claims ships with the evidence.** Do not edit a cap, a section name, a
   status, a scope or an error message from memory. Read the source-of-truth file in the backend
   repo, or probe the live surface, and say in the PR what you checked it against.
2. **The gates pass locally.** These are exactly what CI runs:
   ```bash
   pnpm format:check
   pnpm lint:ci
   pnpm test
   ```
3. **A failing gate means fixing the cause, not bypassing it.** Never `--no-verify`. Never add an
   eslint-disable to quiet a lint rule; never delete or weaken a check in `scripts/` to make a run
   pass. If `self-test` says a fault is no longer caught, the validator regressed.

## Conventions

- **The MCP surface moving is a change to this repo.** When the backend changes a section
  descriptor, a cap, the status enum, a scope or an error message, this package is updated in the
  same pull request. Refresh `scripts/fixtures/live-surface.json` (command in the README) and then
  fix the prose the drift check flags.
- **Never invent a claim to fill a gap.** If you cannot verify something, leave it out and say so.
  An incomplete skill is recoverable; a confidently wrong one is not.
- **The vendored schemas under `scripts/schemas/` are byte-copies of the published 1.0.0 schemas.**
  Do not reformat them, and do not hand-edit them. Spec §10.1 forbids reassigning a published schema
  identifier to different contents, which is the only reason vendoring is safe.
- **Examples never reference allergies or other medical detail.** Use neutral preferences. Same rule
  as the docs site.
- **No em dashes in prose.** House style, not lint-enforced.
- **Bugs found but not fixed go in `tasks/bugs.md`** with location, reproduction, what is wrong,
  candidate fixes and any workaround in place. A fixed entry is deleted, never struck through.
- **This repo is PUBLIC, including its git history.** Everything in it is a public statement about
  what the traveler.md MCP server does. Before committing, check for: internal source paths and repo
  names, infrastructure detail (WAF rules, task definitions, log groups, runner labels, account ids,
  ARNs, non-public hostnames), anything unshipped or roadmap-shaped, and end-traveler data in
  examples. All of that belongs in the server repo's `docs/`, which is private. Rewriting history to
  remove a leak after the fact is not reliably possible once someone has forked.
- **Never `git push` without an explicit ask in the current turn.**

## Branches and releases

Branch model and commit format are in the README's Contributing section; this covers only what it
does not. Releases are plain semver tags with **no `v` prefix**, cut by an admin from the
`develop` -> `main` merge, and `plugin.json` `version` is bumped in the same PR, since clients use it
for update checks and cache freshness.

## Source-of-truth references

- `docs/agent-plugin.md` in the traveler.md server repository — why this package exists, its design decisions,
  the open decisions, and the production verification behind `mcp.json`.
- <https://agent-plugins.org/specification> — the normative Agent Plugins spec.
- <https://agentskills.io/specification> — the normative Agent Skills spec (`SKILL.md` format).
- <https://docs.traveler.md/mcp> — the public MCP docs.
