# traveler.md Agent Plugin

An [Agent Plugins v1.0.0](https://agent-plugins.org/specification) package that connects an agent to a traveler's own **traveler.md** profile and **trip.md** trip plans, and teaches it how to write them correctly.

Maintained by [traveler.md](https://traveler.md). Licensed under Apache-2.0.

## What is in the package

```text
.
├── plugin.json                       # Portable manifest
├── mcp.json                          # One streamable-http server: mcp.traveler.md
├── skills/
│   └── travelermd/
│       ├── SKILL.md                  # The read-before-write loop, the five rules
│       └── references/
│           ├── tools.md              # All 8 tools, exact argument and response shapes
│           ├── profile-sections.md   # traveler.md sections, caps, profile-vs-trip
│           ├── trip-sections.md      # trip.md sections, caps, status lifecycle
│           └── errors.md             # Every error code and its recovery
└── scripts/                          # Validation tooling, not part of the plugin
```

Two portable component types, which is all v1 defines:

- **One MCP server.** `https://mcp.traveler.md/mcp`, Streamable HTTP. No credentials in the package: the traveler authorizes once through OAuth, and the client discovers the authorization server from the endpoint's [protected-resource metadata](https://datatracker.ietf.org/doc/html/rfc9728).
- **One skill.** The server's tool schemas already describe the arguments. What they cannot express is the operational knowledge: that writes replace a section wholesale, that every update needs a version hash from a fresh read, that a misspelled argument name produces a successful-looking no-op. That is what the skill carries.

`scripts/` is not a plugin component. Agent Plugins v1 defines exactly two component types, skills
and MCP servers, and a client reads only `plugin.json`, `skills/` and `mcp.json`. Everything else
here is repo tooling and is invisible to the clients that install this package.

## Why the skill matters as much as the server

Connecting an agent to the MCP server is one line of configuration. Getting it to use the surface _well_ is the harder half, and the failure modes are consistent:

- Writing without a fresh `expected_version_hash`, then blind-retrying the same stale hash on the resulting conflict.
- Sending only a new sentence for a section, which deletes everything else in it.
- Exceeding a per-section sentence cap.
- Writing trip specifics into the durable profile, which pollutes every later trip.
- Omitting `sections` on a create or profile update, which the published schema does not mark required but the server rejects anyway.

The skill front-loads each of those. Shipping it in the same package as the server config means an agent arrives already knowing them, instead of learning by failing against a real traveler's data.

## Installing

Agent Plugins v1 deliberately defines no install mechanism, distribution protocol, or registry. Each client owns its own install path, so follow your client's instructions for adding a local or Git-hosted Agent Plugin and point it at this repository.

To connect the MCP server on its own, without the plugin, see <https://docs.traveler.md/mcp>.

## Validating

```bash
pnpm install
pnpm test           # all three suites below, in order

pnpm validate       # spec conformance
pnpm self-test      # proves both checkers catch what they claim to
pnpm check-drift    # skill vs the live MCP surface
```

The lint and format commands, and what each one is for, are in `CLAUDE.md`.

| Suite              | What it proves                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm validate`    | `plugin.json` and `mcp.json` satisfy the published 1.0.0 schemas (both closed, so an unknown field fails), plus the semantic rules the schemas cannot express: cross-file version match, HTTPS and no-credentials-in-headers, skill discovery, Agent Skills frontmatter, working relative links, path containment. |
| `pnpm self-test`   | The checkers reject what they claim to. Injects one deliberate fault at a time, against `validate` and `check-drift` both, and asserts each is caught **by its intended check**, so a fault cannot be masked by an unrelated failure.                                                                              |
| `pnpm check-drift` | The skill's section names, sentence caps, trip statuses, pagination limits and private-section flags still match the real MCP surface.                                                                                                                                                                             |

The two Agent Plugins schemas are vendored under `scripts/schemas/1.0.0/`, fetched from their canonical URLs. Spec §10.1 forbids reassigning a published schema identifier to different contents, which is what makes vendoring safe. Clients are separately forbidden from fetching schemas at load time; validating in CI is fine.

## Keeping the skill honest

The skill states argument names, section names, caps, status values and error codes explicitly. That is what makes it useful and also what makes it rot. When the MCP surface changes, update this package in the same pull request as the server change.

`scripts/fixtures/live-surface.json` is a pinned snapshot of the section caps, scopes and enums the
server advertises, generated by reading the server's own schema definitions rather than by hand.
`check-drift` compares the skill against it, so a claim that has drifted fails CI instead of quietly
misinforming an agent.

Refreshing that snapshot needs a checkout of the traveler.md server, so the command and the
source-of-truth map for each class of claim live with the server rather than here. **Maintainers: see
`docs/agent-plugin.md` in the traveler.md server repository.** A snapshot refresh that makes
`check-drift` fail is the signal that the skill's prose needs updating too, not just the fixture.

Bump `plugin.json` `version` on any content change: clients use it for update checks and cache
freshness.

Two behaviours the skill documents are properties of the running server rather than of its published
schemas, so they will not show up in a schema diff and the drift check cannot see them:

- **Unknown top-level arguments are dropped rather than rejected**, so a misspelled argument name
  yields a successful-looking result that changed nothing. This is why the skill tells agents to
  verify a write via `changes`. Unknown _section_ names inside `sections` are rejected normally.
- **`CONFLICT` recovery detail arrives in the error message, not in a structured field**, which is why
  the skill tells agents to read the message for the current hash.

## Client-specific capabilities

`plugin.json`'s top-level schema is closed: only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords` and `extensions` are permitted. Hooks, agents, commands and similar features are not portable v1 components. If a client needs them, they belong under a reverse-domain namespace that client owns, either as an `extensions` object in the manifest or as a top-level `com.vendor.client/` directory. This package uses neither, so it stays portable across every conforming client.

## Contributing

`main` is the release branch and `develop` is integration; open pull requests against `develop`.
Branch prefixes are `feat/`, `fix/`, `chore/`, `ci/`, `docs/`, `refactor/`, `test/`, and commit
subjects are conventional commits, lowercase.

Before opening a PR, run the three gates CI runs: `pnpm format:check`, `pnpm lint:ci`, `pnpm test`.
If your change touches anything the skill asserts about the MCP server, say in the PR what you
verified it against; `CLAUDE.md` lists the source-of-truth file for every class of claim.

## License

[Apache-2.0](LICENSE). Copyright 2026 TravelAI Solutions Inc.

Apache-2.0 §6 does not grant rights in the traveler.md name or marks: you are free to fork, adapt
and redistribute this package, but a fork must not imply that traveler.md endorses it.
