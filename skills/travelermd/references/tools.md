# Tool reference

Eight tools. Every argument name is `snake_case`. Unknown top-level argument names are dropped before validation rather than rejected, so a typo produces a successful-looking no-op: check `changes` on the response (see SKILL.md, "Confirm the write landed").

## Shared value formats

| Value                                   | Format                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `version_hash`, `expected_version_hash` | 64-character lowercase hex (SHA-256). Pass back verbatim.                                                           |
| `trip_id`                               | UUID                                                                                                                |
| `start_date`, `end_date`                | ISO-8601 date, `YYYY-MM-DD`. Nullable.                                                                              |
| `status`                                | Exactly one of `Dreaming`, `Planning`, `Booking`, `Booked`, `Trip In Progress`, `Completed`, `Cancelled`, `On Hold` |
| `slug`                                  | kebab-case, `a-z0-9-`, must start and end alphanumeric, max 255                                                     |
| A sentence                              | Single-line string, 1 to 1000 characters. No newlines.                                                              |
| `sections`                              | Object of `section_name -> string[]`. Only spec section names.                                                      |
| `cursor`                                | Opaque signed string from `next_cursor`. Never construct or edit one.                                               |
| `include_markdown`                      | Optional boolean, defaults to `false` on every read and write                                                       |
| `idempotency_key`                       | Optional string, your own value, for safe retries                                                                   |

`spec_version` and `renderer_version` come back on every read and write. They tell you which document spec produced the response; you do not send them.

## `sections` is required where this reference says so, even though the schema disagrees

`create_profile`, `update_profile` and `create_trip` all reject a call that omits `sections`, with `VALIDATION_ERROR` and the issue `sections: expected object, received undefined`. The published input schema does **not** list `sections` in its `required` array for those three tools, so a client that trusts the schema alone will omit it and fail. Always send `sections`, even when the only thing you are changing is an envelope field.

This is a server-side defect, not a design decision, and it is tracked. When it is fixed the schema will advertise `sections` as required and this note goes away, so treat it as temporary.

`update_trip` is the exception and genuinely optional: it defaults `sections` to `{}`, which is what makes an envelope-only status flip a one-argument call.

## read_profile

Scope `profile.read`.

- **In:** `include_markdown?`
- **Out:** `sections`, `version_hash` (**nullable**), `spec_version`, `renderer_version`, `rendered_markdown?`

`version_hash: null` means no profile exists yet. That is the signal to use `create_profile`.

## create_profile

Scope `profile.create`. First write only.

- **In:** `sections` (required), `idempotency_key?`, `include_markdown?`
- **Out:** `sections`, `version_hash`, `spec_version`, `renderer_version`, `rendered_markdown?`

If a profile already exists this returns `CONFLICT` and the message names the current hash. Switch to `update_profile`.

## update_profile

Scope `profile.update`.

- **In:** `sections` (required), `expected_version_hash` (required, non-null), `idempotency_key?`, `include_markdown?`
- **Out:** as `create_profile`, plus `changes?`

## list_trips

Scope `trip.list`. Archived trips never appear.

- **In:** `cursor?`, `limit?` (1 to 100, default 20), `status?`, `query?` (case-insensitive substring match on title; `%` and `_` are matched literally)
- **Out:** `items[]`, `next_cursor` (nullable, null on the last page)

Each item: `trip_id`, `slug`, `title`, `status`, `start_date`, `end_date`, `updated_at`, `card_color?`. Items carry no section content; use `read_trip` for that.

Cursors are signed. A hand-built or edited cursor returns `VALIDATION_ERROR: invalid cursor`.

## read_trip

Scope `trip.read`.

- **In:** `trip_id` (required), `include_markdown?`
- **Out:** `trip_id`, `slug`, `title`, `status`, `start_date`, `end_date`, `sections`, `version_hash` (nullable), `spec_version`, `renderer_version`, `rendered_markdown?`, `card_color?`

An archived or unknown `trip_id` returns `NOT_FOUND`.

## create_trip

Scope `trip.create`.

- **In:** `title` (required), `status` (required), `sections` (required), `slug?`, `start_date?`, `end_date?`, `idempotency_key?`, `include_markdown?`
- **Out:** the `read_trip` shape plus a non-null `version_hash`

`title` and `status` are required because the envelope cannot be derived from section text. Omit `slug` and the server derives one from the title. A duplicate active slug returns `CONFLICT` with no hash in it: retry with a different slug or title.

## update_trip

Scope `trip.update`.

- **In:** `trip_id` (required), `expected_version_hash` (required, non-null), `sections?` (defaults to `{}`), `title?`, `slug?`, `status?`, `start_date?`, `end_date?`, `idempotency_key?`, `include_markdown?`
- **Out:** as `create_trip`, plus `changes?`

Envelope fields and sections can change in the same call. An envelope-only change (a status flip) needs no `sections`.

## archive_trip

Scope `trip.update`, deliberately reused rather than a separate scope, so existing authorizations already carry it.

- **In:** `trip_id` (required). No hash.
- **Out:** `trip_id`, `archived: true`

Archiving takes no `expected_version_hash` because it sets a lifecycle flag outside the content-addressed envelope, so `version_hash` never changes. Nothing is destroyed: the trip, its envelope and every version row survive.

Three consequences:

1. An archived trip leaves `list_trips`, and `read_trip` and `update_trip` then return `NOT_FOUND` for it.
2. Archiving twice returns `NOT_FOUND` on the second call. That is a state guard, not a failure to fix.
3. There is no unarchive tool and no delete tool over MCP. Both live in the traveler's own portal. If the traveler wants a trip back, point them there.

## The `changes` object

Present on `update_profile` and `update_trip` when the server had a pre-write state to diff:

```json
{
  "added": ["deadlines"],
  "updated": ["itinerary"],
  "removed": [],
  "sentences": {
    "itinerary": { "added": ["Day 4: Nara day trip."], "removed": [] }
  }
}
```

- `added`: the section was empty before and has content now
- `updated`: the section had content and it changed
- `removed`: the write emptied a section that had content
- `sentences`: line-level diff for updated sections

A write that changed nothing omits `changes` entirely. If you expected a change, that means your write did not do what you intended.
