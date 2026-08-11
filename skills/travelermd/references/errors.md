# Error reference

Every tool rejection arrives as an MCP tool error carrying one of the codes below. The code set is closed: anything unexpected is `INTERNAL`.

The recovery instruction is in the **message**. Read it. The structured `data` envelope is not delivered to MCP clients on the tool path, so the message is where every actionable detail lives: the current version hash on a conflict, and the offending field paths on a validation error.

The message may arrive prefixed with a JSON-RPC code, as in `MCP error -32602: validation error ...`. That number is transport bookkeeping and not the code set below. Do not branch on it, and do not report it to the traveler; read the text after it.

## CONFLICT

Two distinct situations, told apart by whether the message contains a hash.

### Version-hash mismatch

Message: `version_hash mismatch: the stored version_hash is <hash>, not the expected_version_hash you sent, so something else wrote to this record (or it already existed). Re-read it before retrying if you are about to send the same sections again: each section is replaced wholesale, so retrying with expected_version_hash set to <hash> would overwrite the other writer's version of every section in your payload. Retry directly with <hash> only when your change cannot collide with theirs, or when you mean to replace those sections regardless.`

Causes:

- The record changed between your read and your write (another agent, or the traveler in the portal).
- You reused a hash from an earlier turn or an earlier session.
- You called `create_profile` when a profile already existed. Nothing changed in that case; the record simply exists. Switch to `update_profile`.

Recovery, in this order:

1. **Re-read** if you are about to resend the same sections. This mismatch is the only notice you ever get that another writer exists, and because a section is replaced wholesale, retrying the same body against the new hash discards whatever they wrote into those sections. Re-read, merge their sentences with yours, then write.
2. Retry directly with the hash from the message only when your write cannot collide (it names sections nothing else touches), or when replacing them regardless is what the traveler asked for.

Never retry with the same hash that just failed.

### Slug collision

Message names a duplicate slug and carries **no** hash. The absence of a hash is how you tell it apart from an OCC conflict.

Recovery: retry with a different `slug`, or a different `title` if you let the server derive the slug. A hash cannot help here.

## VALIDATION_ERROR

Your arguments did not satisfy the schema. The offending fields are rendered into the message, as `validation error — <field>: <reason>; <field>: <reason>`, where a field is the argument path (`sections.itinerary`, `start_date`, or `input` when the whole argument object is wrong). At most five are named; the rest are counted as `(and N more field errors)`, and a very long list is truncated. Fix the ones you are told about and retry; the remainder surface on the next attempt.

Common causes and fixes:

| Cause                                    | Message shape                                                                      | Fix                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Section sent as `[]` without the flag    | `refusing to clear <names>: ...`                                                   | Omit the section to leave it alone, or resend with `allow_clear_sections: true` to erase it.                |
| Over a sentence cap                      | `section "<name>" accepts at most N sentences; send fewer, more concise sentences` | Consolidate into denser sentences. Do not silently drop content.                                            |
| Unknown section name                     | Unrecognized key                                                                   | Use a spec section name. Anything that fits nowhere goes in `additional_information`.                       |
| Unknown name in `read_profile.sections`  | Invalid enum value, listing the allowed set                                        | Use a spec profile section name.                                                                            |
| Sentence too long or multi-line          | Sentence length or forbidden-character message                                     | Split into multiple sentences, each under 1000 characters, no newlines.                                     |
| Bad date                                 | `must be an ISO-8601 date (YYYY-MM-DD)`                                            | Reformat.                                                                                                   |
| Bad slug                                 | `must be a kebab-case slug`                                                        | Lowercase, hyphens, alphanumeric at both ends.                                                              |
| Tampered, hand-built or re-sorted cursor | `invalid cursor`                                                                   | Restart pagination from no cursor. Pass a `next_cursor` back verbatim, and never across a change of `sort`. |
| Malformed hash                           | 64-character lowercase hex message                                                 | Pass the hash back exactly as read.                                                                         |

Fix the argument and retry once. An unchanged retry will fail identically.

Cross-field refusals, of which the clear-sections guard is the only one today, are reported ahead of ordinary field errors so they cannot be pushed past the five-issue cap.

## FORBIDDEN

Message: `forbidden: missing scope <scope>`, or a message naming disallowed sections.

- **Missing scope.** The traveler's authorization does not cover this tool. Retrying cannot grant a scope. Tell the user which capability is missing and what they would need to authorize, then stop.
- **Disallowed sections.** The traveler has withheld those sections from this client. Do not ask them to lower their permissions; proceed with the sections you can reach, or explain what you cannot do.

## NOT_FOUND

The `trip_id` does not exist, or it is archived. Archived trips are invisible to `list_trips` and 404 on read and update.

Recovery: re-run `list_trips` and work from ids it returns. If the traveler insists the trip exists, it is probably archived, and unarchiving is a portal action.

## UNAUTHORIZED

No valid authorization, or the traveler revoked the grant.

Recovery: ask the traveler to authorize the connection once, then stop. **Do not loop.** Repeated automatic retries and token refreshes against a dead grant produce nothing but failed requests. One clear message to the user is the correct response.

## IDEMPOTENCY_MISMATCH and IDEMPOTENCY_IN_PROGRESS

- **Mismatch:** you reused an `idempotency_key` with different arguments. Use a fresh key, or resend the original arguments.
- **In progress:** an identical request is still being processed. Wait briefly and retry the same key once. Do not fan out concurrent writes with the same key.

## INTERNAL

A server-side fault, deliberately opaque. Retry once at most. If it persists, report it to the traveler rather than working around it, and do not retry a write repeatedly: a write that failed internally may still have been applied, so re-read before writing again.
