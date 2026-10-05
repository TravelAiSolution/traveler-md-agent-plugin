# Tool reference

Eight tools. Every argument name is `snake_case`. Unknown top-level argument names and unknown section names are rejected. Verify the returned fields after a write; `changes` covers section text only.

## Shared value formats

| Value                                   | Format                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `version_hash`, `expected_version_hash` | 64-character lowercase hex (SHA-256). Pass back verbatim.                                                              |
| `trip_id`                               | UUID                                                                                                                   |
| `start_date`, `end_date`                | ISO-8601 date, `YYYY-MM-DD`. Nullable.                                                                                 |
| `destination`                           | Where the trip goes, at least where it starts, as the traveler named it. Never a hotel. 1 to 500 characters. Nullable. |
| `status`                                | Exactly one of `Dreaming`, `Planning`, `Booking`, `Booked`, `Trip In Progress`, `Completed`, `Cancelled`, `On Hold`    |
| `slug`                                  | kebab-case, `a-z0-9-`, must start and end alphanumeric, max 255                                                        |
| A sentence                              | Single-line string, 1 to 1000 characters. No newlines.                                                                 |
| `sections`                              | Object of `section_name -> string[]`. Only spec section names.                                                         |
| `cursor`                                | Opaque signed string from `next_cursor`. Never construct or edit one.                                                  |
| `include_markdown`                      | Optional boolean, defaults to `false` on every read and write                                                          |
| `idempotency_key`                       | Optional string, any unique value of 1 to 255 characters. It need not be a UUID; a short random token is fine.         |
| `allow_clear_sections`                  | Optional boolean on the two update tools, defaults to `false`. Required to send any section as `[]`.                   |

`spec_version` and `renderer_version` come back on every read and write. They tell you which document spec produced the response; you do not send them.

## Required sections

`create_profile` and `update_profile` require `sections`, and their schemas advertise that requirement. `create_trip` and `update_trip` default omitted `sections` to `{}`. Trip envelope-only and event-only writes need no section payload.

## Clearing a section takes `allow_clear_sections`

A section you send is replaced wholesale, so `{"loyalty_programs": []}` erases it, and there is no delete tool and no undo on this server. An update that sends any section as an empty array is therefore **rejected** unless it also carries `allow_clear_sections: true`. The rejection is a `VALIDATION_ERROR` that names every section the call would have emptied.

- To leave a section alone, **omit it**. Omitted sections are untouched and need no flag.
- To erase deliberately, resend with `allow_clear_sections: true`.
- Never set the flag pre-emptively "in case". It exists so that an accidental `[]`, from a failed extraction or a mis-serialised argument, cannot destroy content silently.

`create_profile` and `create_trip` have no such flag, because on a first write an empty section clears nothing.

## read_profile

Scope `profile.read`.

- **In:** `sections?` (array of section names, at least one), `include_markdown?`
- **Out:** `sections`, `version_hash` (**nullable**), `spec_version`, `renderer_version`, `rendered_markdown?`

`version_hash: null` means no profile exists yet. That is the signal to use `create_profile`.

`sections` on the way in is a projection: pass the names you need and the response carries only those. The enum of valid names is in the input schema, so an unknown name is rejected and the message names the allowed set.

Three things the projection does not change:

1. `version_hash` still covers the whole document. It is the version row's hash, not a hash of what you fetched, so a filtered read followed by an `update_profile` carrying that hash is safe. Sections you did not fetch are not disturbed by a write that does not name them.
2. `rendered_markdown`, when you ask for it, is always the complete document.
3. A section the traveler has withheld from this client stays absent whether or not you name it.

## create_profile

Scope `profile.create`. First write only.

- **In:** `sections` (required), `idempotency_key?`, `include_markdown?`
- **Out:** `sections`, `version_hash`, `spec_version`, `renderer_version`, `rendered_markdown?`

If a profile already exists this returns `CONFLICT` and the message names the current hash. Switch to `update_profile`.

## update_profile

Scope `profile.update`.

- **In:** `sections` (required), `expected_version_hash` (required, nullable), `allow_clear_sections?`, `idempotency_key?`, `include_markdown?`
- **Out:** as `create_profile`, plus `changes?`

A null expected hash asserts that no profile exists and creates one. This also requires scope `profile.create`. Use the hash from `read_profile` for an existing profile.

## list_trips

Scope `trip.list`. Archived trips never appear.

- **In:** `cursor?`, `limit?` (1 to 100, default 20), `status?`, `exclude_statuses?`, `query?`, `starts_after?`, `starts_before?`, `sort?`
- **Out:** `items[]`, `next_cursor` (nullable, null on the last page)

Each item: `trip_id`, `slug`, `title`, `status`, `start_date`, `end_date`, `destination`, `updated_at`, `card_color?`, `matched_sections?`. Items carry no section content; use `read_trip` for that.

Filters and ordering:

| Argument                        | Behaviour                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `query`                         | Case-insensitive substring searched across both the title **and** the trip's section content. `%` and `_` are matched literally.                                                     |
| `starts_after`, `starts_before` | Inclusive `YYYY-MM-DD` bounds on `start_date`. Either one excludes trips that have no start date.                                                                                    |
| `sort`                          | `recently_updated` (default, most recently edited first) or `start_date` (soonest departure first, undated trips last).                                                              |
| `matched_sections`              | On a hit, the section names the `query` was found in. Absent when only the title matched, when there was no `query`, and for any matched section this client is not allowed to read. |

`matched_sections` carries section names only, never the matching text. Read the content with `read_trip`.

"What is my next trip" is one call: `sort: "start_date"`, `starts_after` set to today, `exclude_statuses: ["Cancelled", "Completed"]`, `limit: 1`. Excluded statuses compose with the other filters.

### Paging

**Keep paging while `next_cursor` is present, even when `items` is empty.** A page is filtered after it is read, so an empty `items` alongside a `next_cursor` means "nothing on this page", never "no results". Only a response without a `next_cursor` ends the search.

Cursors are signed. A hand-built or edited cursor returns `VALIDATION_ERROR: invalid cursor`, and so does a cursor carried across a change of `sort`: the two orderings use different cursor formats, and a boundary from one has no meaning in the other. Changing `sort` means restarting from no cursor.

## read_trip

Scope `trip.read`.

- **In:** `trip_id` (required), `include_markdown?`, `include_itinerary?`
- **Out:** `trip_id`, `slug`, `title`, `status`, `start_date`, `end_date`, `destination`, `sections`, `version_hash` (nullable), `spec_version`, `renderer_version`, `rendered_markdown?`, `card_color?`, `events`, `itinerary?`

An archived or unknown `trip_id` returns `NOT_FOUND`.

## create_trip

Scope `trip.create`.

- **In:** `title` (required), `status` (required), `sections?`, `events?`, `slug?`, `start_date?`, `end_date?`, `destination?`, `idempotency_key?`, `include_markdown?`
- **Out:** the `read_trip` shape plus a non-null `version_hash`

`title` and `status` are required because the envelope cannot be derived from section text. Omit `slug` and the server derives one from the title, adding a suffix when that slug is already taken. A derived slug never collides, so a retried `create_trip` without an `idempotency_key` creates a second trip. Always send one. An explicit `slug` that duplicates an active trip returns `CONFLICT` with no hash in it: retry with a different slug, or omit it.

## update_trip

Scope `trip.update`.

- **In:** `trip_id` (required), `expected_version_hash` (required, non-null), `sections?` (defaults to `{}`), `events?`, `title?`, `slug?`, `status?`, `start_date?`, `end_date?`, `destination?`, `allow_clear_sections?`, `idempotency_key?`, `include_markdown?`
- **Out:** as `create_trip`, plus `changes?`

Envelope fields and sections can change in the same call. An envelope-only change (a status flip) needs no `sections`.

`expected_version_hash` can come from a prior `read_trip`, `create_trip` or `update_trip`: every write response carries the new hash, so a chain of updates needs no re-read between them.

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

Present on `update_profile` and `update_trip` when section text differs from the pre-write state:

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

A status-only update or an event-record-only edit can omit `changes` even when the write succeeds. Check the returned envelope, sections, and events. Re-read when needed. A changed version hash is a concurrency token, not proof of the intended edit.

## Structured events

The trip write tools accept an `events` array. Each item has an operation:

- `upsert`: send a kind, title, and start value. Omit the event id to create; include an existing id from this trip to edit. A null start means undated.
- `remove`: send the event id to remove that event and its owned sentence.

For example, an event payload inside a trip write:

```json
{
  "events": [
    {
      "op": "upsert",
      "kind": "accommodation",
      "title": "Hotel stay",
      "start": { "date": "2027-04-02", "time": "15:00", "tz": "Europe/Paris" },
      "end": { "date": "2027-04-04", "time": "11:00", "tz": "Europe/Paris" },
      "status": "booked"
    }
  ]
}
```

Use the schema for allowed kinds, subtypes, and optional fields. Send only what the traveler stated. Updates require the trip's expected version hash, including event-only updates. Put the idempotency key at the top level of the call.

Each event owns a sentence in the trip. Edit it through its event id instead of overwriting that sentence in a section. If a response identifies an arrangement as unstructured prose, add its event and remove the old prose line in the same update. Preserve notes and preferences as prose.

`read_trip` returns flat events. `include_itinerary: true` adds grouped days and derived anchors. Write responses include events when event operations were sent; re-read for a complete timeline when needed.

Structured events require the traveler to grant itinerary access. A forbidden mixed update writes neither its prose nor its events. Explain the missing access instead of claiming the booking was saved.
