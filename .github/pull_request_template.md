<!-- Keep the title under 70 chars; details belong in the body. -->

## Summary

## Test plan

- [ ] `pnpm format:check`
- [ ] `pnpm lint:ci`
- [ ] `pnpm validate` (spec conformance)
- [ ] `pnpm self-test` (both checkers still catch every injected fault)
- [ ] `pnpm check-drift` (skill still matches the live MCP surface)

## Public-repo check

<!-- This repo is public and so is this PR: its title, this body, every comment,
and every commit message. Editing a leak out later does NOT remove it, because
GitHub keeps the pre-edit text in the revision history. See CLAUDE.md,
"Public repo". -->

- [ ] The **diff**, this **body**, the **title** and the **commit messages** carry no internal
      source paths or repo names, no other-repo issue numbers, no infrastructure or deployment
      detail, nothing unshipped or roadmap-shaped, and no end-traveler data

## Does this change what the skill claims?

<!-- If you touched skills/**, say which claim changed and what you checked it
against. Name the source by what it is, not by its path. If the MCP surface
itself moved, `scripts/fixtures/live-surface.json` needs refreshing in this PR
too. See README, "Keeping the skill accurate". -->

- Claim changed:
- Verified against:

## Risk and rollback

- Risk:
- Rollback:

## Linked issues
