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
assets/                      # brand marks referenced by the install-surface metadata
.agents/plugins/             # marketplace entry: distribution, not a plugin component
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
   repo, or probe the live surface, and say in the PR what you checked it against. Name that source
   by what it is, not by its path: "the server's section descriptor", never `packages/...`. See
   "Public repo".
2. **The gates pass locally.** These are exactly what CI runs:
   ```bash
   pnpm format:check
   pnpm lint:ci
   pnpm test
   ```
3. **A failing gate means fixing the cause, not bypassing it.** Never `--no-verify`. Never add an
   eslint-disable to quiet a lint rule; never delete or weaken a check in `scripts/` to make a run
   pass. If `self-test` says a fault is no longer caught, the validator regressed.

## Public repo

**This repo is PUBLIC, and so is everything attached to it.** Not just the files: the git history,
every commit message, pull request title and body, review comment, issue, and release note. All of
it is world-readable, permanently, and all of it is a public statement about what the traveler.md
MCP server does.

Never write any of the following into any of those surfaces:

- **Internal source paths and repo names.** No `packages/...`, `apps/...` or `src/...` paths from the
  server repo, and no naming of the private repos themselves. Cite a claim by describing what
  defines it ("the server's section descriptor", "the request handler") rather than by path.
- **Internal issue and pull request numbers** from other repos. `#123` here means an issue in this
  repo; a bare number pointing anywhere else is both a leak and a broken link.
- **Infrastructure detail.** WAF rules, task definitions, log groups, runner labels, account ids,
  ARNs, non-public hostnames, database or queue names.
- **Deployment and environment state.** Which environment is running which build, what lags what,
  probe recipes for telling them apart, or the existence and naming of non-public environments.
- **Anything unshipped or roadmap-shaped.** Do not describe a fix, feature or schema change as
  forthcoming. Either it is live and documented, or it is not mentioned. "A tracked server-side fix
  will..." is the most you should ever say, with no identifier attached.
- **End-traveler data**, in examples or anywhere else. Examples use invented, neutral preferences.

All of that belongs in the server repo's `docs/`, which is private.

**A public-repo check covers the body, the commit message and the diff.** A checklist item that
scopes only to the diff is the failure mode this rule exists to prevent: the leak lands in the prose
you wrote around a clean diff.

**Editing a leak out later is not a fix.** GitHub keeps the pre-edit text of every pull request body
and comment in its revision history, viewable by anyone who can see the pull request via the
"edited" menu. Correcting the body leaves the original fully readable. The old revisions have to be
deleted one at a time in the GitHub UI, and there is no API for it. Git history is worse: once
someone has forked or cloned, a rewrite reaches nothing. Get it right the first time.

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
- **`assets/` is copied from the published brand assets, never drawn or derived here.** The icon and
  the two lockups are byte copies of the marks the product already ships, and `brandColor` mirrors
  the coral token in the brand style guide, which is the only thing to read a brand colour from: do
  not infer one from a rendered page. Re-copy when the brand moves, and do not hand-edit, recolour or
  regenerate a mark here.
  Known limitation: the icon is a black glyph on a transparent background, so it reads poorly on a
  dark install surface, and an OpenAI host gives `composerIcon` no dark counterpart the way it does
  `logo`. A light-ground icon has to arrive as a brand asset; it is not something to invent here.
- **`extensions["com.openai"]` carries presentation only.** An OpenAI host reads `interface`, `apps`
  and `hooks` from that namespace and ignores everything else. Keep it to `interface`: `apps` and
  `hooks` would make the package's behaviour depend on which client installed it, and hooks are
  non-managed, so a host prompts the traveler to trust them before anything runs. Nothing portable
  goes in a vendor namespace, and no second manifest: a `.codex-plugin/plugin.json` would restate
  `name` and `version` with nothing keeping them in step, and the `extensions` entry wins anyway.
- **Rules in `scripts/validate.mjs` about a host come from that host's source, not its docs.** The
  published plugin docs and the shipping loader disagree in at least three places: the manifest is
  read at the repo root for an Agent Plugins package (no `.codex-plugin/` needed), the bundled MCP
  file key is `mcpServers` and not `mcp_servers`, and the auth policy value is `ON_USE` and not the
  documented `ON_FIRST_USE`, which fails deserialisation of the whole marketplace file. When adding
  a check, cite the file you read it from and add a self-test case, because almost everything these
  hosts reject they reject silently: a dropped field warns in a log we never see.
- **Bugs found but not fixed go in `tasks/bugs.md`** with location, reproduction, what is wrong,
  candidate fixes and any workaround in place. A fixed entry is deleted, never struck through.
- **Everything you write here is public. See "Public repo" below before every commit and every pull
  request.**
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
