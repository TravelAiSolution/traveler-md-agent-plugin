# Traveler.md Agent Plugin

An [Agent Plugins v1.0.0](https://agent-plugins.org/specification) package that connects an agent to a traveler's own **Traveler.md** profile and **Trip.md** trip plans, and teaches it how to write them correctly.

Maintained by [Traveler.md](https://traveler.md). Licensed under the [MIT License](LICENSE).

## What it gives an agent

**Traveler.md** is a portable travel profile owned by the traveler rather than by any one app: how they like to fly, where they like to stay, who they usually travel with. **Trip.md** is the plan for a single trip. Both live behind one MCP server, and both belong to the traveler, who authorizes access once and can revoke it at any time.

Install this package and an agent can:

- Recall a traveler's durable preferences instead of asking for them again every session.
- Record a new preference in the right place, so it survives into the next trip and the next agent.
- Create, find, update and archive trips, with the trip detail kept out of the durable profile.
- Recover correctly when a write collides with another agent writing the same section.

Eight tools cover it: `read_profile`, `create_profile`, `update_profile`, `create_trip`, `read_trip`, `update_trip`, `list_trips` and `archive_trip`.

### Scope: travel memory only

This package connects your agent to a **memory**. The server stores and returns what the traveler has recorded. It holds no inventory, no prices and no availability, and it has no recommendation engine, so it will never return a shortlist of hotels or a flight to book.

Your agent still does the recommending. Reading the profile first changes what that recommendation is based on. "Where should we stay in Lisbon?" is still your agent's question to answer, and after a read it can answer with the neighborhood this traveler likes, the room they need, the budget they actually spend, and the fact that they are traveling with a toddler this year.

An agent that files this under "booking tool" fails in two ways. It waits for a shortlist that never arrives, or it skips the server on a "where should we stay" turn, which is the turn the profile was written for.

## Install

### The whole package

Agent Plugins v1 deliberately defines no install mechanism, distribution protocol, or registry. Each client owns its own install path, so follow your client's instructions for adding a local or Git-hosted Agent Plugin and point it at this repository. That path installs the skill as well as the server.

Codex and ChatGPT read Agent Plugins directly, and this repository doubles as a single-plugin marketplace, so they install it from the Git URL:

```bash
codex plugin marketplace add https://github.com/TravelAiSolution/traveler-md-agent-plugin
codex plugin add traveler-md@travelai
```

The first command registers the marketplace this repository declares, named `travelai`. The second installs the one plugin in it. The traveler is asked to authorize on first use rather than at install time.

The host reads the manifest at the repository root and finds the rest by convention: `skills/` and `mcp.json` are already where it looks, so there is no second manifest to keep in step. What it cannot infer is how the plugin should present itself in an install surface, and that lives under `extensions["com.openai"]` in `plugin.json`. See [Portability across clients](#portability-across-clients).

### The MCP server on its own

If your client does not read Agent Plugins yet, connect the server directly. One click:

[![Add to Claude](https://img.shields.io/badge/Add%20to-Claude-D97757?style=for-the-badge)](https://claude.ai/directory/connectors/traveler-md)
[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-1A1A1A?style=for-the-badge)](https://cursor.com/install-mcp?name=travelermd&config=eyJ1cmwiOiJodHRwczovL21jcC50cmF2ZWxlci5tZC9tY3AifQ%3D%3D)
[![Add to VS Code](https://img.shields.io/badge/Add%20to-VS%20Code-0098FF?style=for-the-badge)](https://vscode.dev/redirect/mcp/install?name=travelermd&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.traveler.md%2Fmcp%22%7D)

Or one command:

```bash
claude mcp add --transport http travelermd https://mcp.traveler.md/mcp   # Claude Code
codex mcp add travelermd --url https://mcp.traveler.md/mcp               # Codex
```

Any other client that speaks remote MCP takes the URL directly:

```json
{
  "mcpServers": {
    "travelermd": {
      "url": "https://mcp.traveler.md/mcp"
    }
  }
}
```

This path gives the agent the tools without the skill, which is what the next section is about. Per-client walkthroughs for Claude, Claude Code, Cursor, Codex, ChatGPT, Gemini and others are at <https://docs.traveler.md/mcp>.

There are no credentials to configure on either path. The package names the endpoint and nothing else: the traveler authorizes once through OAuth in their browser, and the client discovers the authorization server from the endpoint's [protected-resource metadata](https://datatracker.ietf.org/doc/html/rfc9728).

### One instruction worth adding by hand

Connecting the server makes the tools available. It does not make an agent use them, and the turn where that matters most is the one where it feels least necessary: asked "where should we stay in Lisbon", a model will answer from the conversation, never look at its tool list, and never read the profile the traveler filled in for exactly that question.

If your client reads a project or global instruction file, paste this into it. Without it, an agent will often answer travel questions without reading the profile at all.

```markdown
## Travel

Before recommending, shortlisting, planning or booking anything travel-related, read my
traveler.md profile with `read_profile`, and check `list_trips` for an existing trip
before starting a new one. Record lasting preferences with `update_profile` and
trip-specific detail with `update_trip`.
```

The file to put it in depends on the client: `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex and others that follow that convention, a project rule for Cursor. Clients that read Agent Skills pick this up from the skill instead and need no manual step.

## What is in the package

```text
.
├── plugin.json                       # Portable manifest
├── mcp.json                          # One streamable-http server: mcp.traveler.md
├── skills/
│   └── travelermd/
│       ├── SKILL.md                  # Read before you advise, the read-before-write loop, the five rules
│       └── references/
│           ├── tools.md              # All 8 tools, exact argument and response shapes
│           ├── profile-sections.md   # traveler.md sections, caps, profile-vs-trip
│           ├── trip-sections.md      # trip.md sections, caps, status lifecycle
│           └── errors.md             # Every error code and its recovery
├── assets/                           # Brand marks for the install surface
├── .agents/plugins/
│   └── marketplace.json              # Makes this repo installable from its Git URL
└── scripts/                          # Validation tooling, not part of the plugin
```

Agent Plugins v1 defines two portable component types, and this package ships one of each:

- **One MCP server.** `https://mcp.traveler.md/mcp`, Streamable HTTP.
- **One skill.** The server's tool schemas already describe the arguments. They do not describe the operational rules: that writes replace a section wholesale, that every update needs a version hash from a fresh read, that a misspelled argument name produces a successful-looking no-op. Those are what the skill carries.

`scripts/` is not a plugin component. Agent Plugins v1 defines exactly two component types, skills
and MCP servers, and a client reads only `plugin.json`, `skills/` and `mcp.json`. Everything else
here is repo tooling and is invisible to the clients that install this package. `.agents/plugins/`
is distribution rather than content: it is how a host finds the plugin, and it is not installed with
it.

## Why the skill ships alongside the server

Connecting an agent to the MCP server is one line of configuration. Getting it to use the surface _well_ is the harder half, and the failure modes are consistent:

- Writing without a fresh `expected_version_hash`, then blind-retrying the same stale hash on the resulting conflict, which overwrites whatever the other writer put in those sections.
- Sending only a new sentence for a section, which deletes everything else in it.
- Sending a section as `[]`, which erases it. The server refuses this without an explicit `allow_clear_sections`, and the skill says why the flag is not something to set pre-emptively.
- Exceeding a per-section sentence cap.
- Writing trip specifics into the durable profile, which pollutes every later trip.
- Omitting `sections` on a create or profile update, which the published schema does not mark required but the server rejects anyway.
- Reading an empty `list_trips` page that still carries a `next_cursor` as "no such trip", when it means "nothing on this page".

The skill documents each of those up front. Shipping it in the same package as the server config means an agent arrives already knowing them, instead of learning by failing against a real traveler's data.

## Portability across clients

`plugin.json`'s top-level schema is closed: only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords` and `extensions` are permitted. Hooks, agents, commands and similar features are not portable v1 components. If a client needs them, they belong under a reverse-domain namespace that client owns, either as an `extensions` object in the manifest or as a top-level `com.vendor.client/` directory.

This package uses exactly one such namespace, `extensions["com.openai"]`, and only for install-surface metadata: display name, category, listing copy, starter prompts, brand colour, the marks in `assets/` and the links to the privacy policy and terms. None of it changes what the plugin does, every other conforming client ignores it, and no portable component is declared there.

The marks in `assets/` are the Traveler.md logo and icon. The MIT licence covers the contents of this repository as a work, and it is not a licence to use TravelAI's names or logos.

That namespace is also why there is no `.codex-plugin/plugin.json`. An OpenAI host will read either one and prefers the `extensions` entry when both exist, so a second manifest would only restate `name` and `version` with nothing keeping the two in step.

## Working on this repo

The package is content rather than an application, so there is no build step. Node 24 and pnpm are
all you need, and `.nvmrc` pins the version.

```bash
pnpm install
pnpm test           # all three suites below, in order

pnpm validate       # spec conformance
pnpm self-test      # proves both checkers catch what they claim to
pnpm check-drift    # skill vs the live MCP surface
```

The lint and format commands, and what each one is for, are in `CLAUDE.md`.

| Suite              | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm validate`    | `plugin.json` and `mcp.json` satisfy the published 1.0.0 schemas (both closed, so an unknown field fails), plus the semantic rules the schemas cannot express: cross-file version match, HTTPS and no-credentials-in-headers, skill discovery, Agent Skills frontmatter, working relative links, path containment. It also covers the rules an OpenAI host enforces on `extensions["com.openai"]` and on `.agents/plugins/marketplace.json`, taken from that host's implementation rather than its documentation, because the two diverge. |
| `pnpm self-test`   | The checkers reject what they claim to. Injects one deliberate fault at a time, against `validate` and `check-drift` both, and asserts each is caught **by its intended check**, so a fault cannot be masked by an unrelated failure.                                                                                                                                                                                                                                                                                                      |
| `pnpm check-drift` | The skill's section names, sentence caps, trip statuses, pagination limits and private-section flags still match the real MCP surface.                                                                                                                                                                                                                                                                                                                                                                                                     |

The two Agent Plugins schemas are vendored under `scripts/schemas/1.0.0/`, fetched from their canonical URLs. Spec §10.1 forbids reassigning a published schema identifier to different contents, which is what makes vendoring safe. Clients are separately forbidden from fetching schemas at load time; validating in CI is fine.

## Keeping the skill honest

The skill states argument names, section names, caps, status values and error codes explicitly. That is what makes it useful, and it is also what makes it rot. When the MCP surface changes, this package is updated alongside the server change.

`scripts/fixtures/live-surface.json` is a pinned snapshot of the section caps, scopes and enums the
server advertises, generated by reading the server's own schema definitions rather than by hand.
`check-drift` compares the skill against it, so a claim that has drifted fails CI instead of quietly
misinforming an agent.

Regenerating that snapshot reads the Traveler.md server's schema definitions directly, so it is a
maintainer task and the command lives with the server rather than here. If you spot a claim in the
skill that the live server no longer honours, open an issue with what you observed and we will
refresh the fixture. A refresh that makes `check-drift` fail is the signal that the skill's prose
needs updating too, alongside the fixture.

Bump `plugin.json` `version` on any content change: clients use it for update checks and cache
freshness.

Two behaviours the skill documents are properties of the running server rather than of its published
schemas, so they will not show up in a schema diff and the drift check cannot see them:

- **Unknown top-level arguments are dropped rather than rejected**, so a misspelled argument name
  yields a successful-looking result that changed nothing. This is why the skill tells agents to
  verify a write via `changes`. Unknown _section_ names inside `sections` are rejected normally.
- **`CONFLICT` recovery detail arrives in the error message rather than in a structured field**, which
  is why the skill tells agents to read the message for the current hash.

## Contributing

Issues and pull requests are welcome.

`main` is the release branch and `develop` is integration; open pull requests against `develop`.
Branch prefixes are `feat/`, `fix/`, `chore/`, `ci/`, `docs/`, `refactor/`, `test/`, and commit
subjects are conventional commits, lowercase.

Before opening a PR, run the three gates CI runs: `pnpm format:check`, `pnpm lint:ci`, `pnpm test`.
If your change touches anything the skill asserts about the MCP server, say in the PR what you
verified it against. A claim you cannot verify is better left out than guessed at, because an agent
will act on it against a real traveler's data.

## License

[MIT](LICENSE). Copyright (c) 2026 TravelAI Solutions Inc.

You are free to fork, adapt and redistribute this package. The licence covers the contents of this
repository and grants no rights in the Traveler.md or TravelAI names, logos or other marks, so
please do not present a fork in a way that implies Traveler.md published or endorsed it.
