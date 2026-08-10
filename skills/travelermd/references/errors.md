# Error reference

Every tool rejection arrives as an MCP tool error carrying one of the codes below. The code set is closed: anything unexpected is `INTERNAL`.

The recovery instruction is in the **message**. Read it. For historical reasons the structured `data` envelope is not delivered to MCP clients on the tool path, so the message is where the actionable detail lives, including the current version hash on a conflict.

## CONFLICT

Two distinct situations, told apart by whether the message contains a hash.

### Version-hash mismatch

Message: `version_hash mismatch: the stored version_hash is <hash>, not the expected_version_hash you sent. Retry with expected_version_hash set to <hash> to apply your change to the current record, or re-read the record first if you need to see its current content before overwriting it.`

Causes:

- The record changed between your read and your write (another agent, or the traveler in the portal).
- You reused a hash from an earlier turn or an earlier session.
- You called `create_profile` when a profile already existed. Nothing changed in that case; the record simply exists. Switch to `update_profile`.

Recovery: take the hash from the message. If your write is purely additive to sections you already hold, retry with that hash. If another writer may have changed the same sections you are about to replace, re-read first, merge, then write. Wholesale section replacement means a blind retry can overwrite someone else's sentences.

Never retry with the same hash that just failed.

### Slug collision

Message names a duplicate slug and carries **no** hash. The absence of a hash is how you tell it apart from an OCC conflict.

Recovery: retry with a different `slug`, or a different `title` if you let the server derive the slug. A hash cannot help here.

## VALIDATION_ERROR

Your arguments did not satisfy the schema. The `issues[]` array carries `path` and `message` per problem.

Common causes and fixes:

| Cause                           | Message shape                                                                      | Fix                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Over a sentence cap             | `section "<name>" accepts at most N sentences; send fewer, more concise sentences` | Consolidate into denser sentences. Do not silently drop content.                      |
| Unknown section name            | Unrecognized key                                                                   | Use a spec section name. Anything that fits nowhere goes in `additional_information`. |
| Sentence too long or multi-line | Sentence length or forbidden-character message                                     | Split into multiple sentences, each under 1000 characters, no newlines.               |
| Bad date                        | `must be an ISO-8601 date (YYYY-MM-DD)`                                            | Reformat.                                                                             |
| Bad slug                        | `must be a kebab-case slug`                                                        | Lowercase, hyphens, alphanumeric at both ends.                                        |
| Tampered or hand-built cursor   | `invalid cursor`                                                                   | Restart pagination from no cursor. Only ever pass back a `next_cursor` verbatim.      |
| Malformed hash                  | 64-character lowercase hex message                                                 | Pass the hash back exactly as read.                                                   |

Fix the argument and retry once. An unchanged retry will fail identically.

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
