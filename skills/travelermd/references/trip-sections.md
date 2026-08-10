# trip.md sections

One trip document per trip. Trip content may override profile defaults freely: a trip's `budget` or `accommodation` says what happens on this trip, and does not change the traveler's standing preferences.

Section names are exact. Unknown names are rejected. Every section is optional; omit what you are not changing.

| Section                  | Max sentences | What belongs here                                                                                           |
| ------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `summary`                | 10            | One or two sentences: destination, dates, group, purpose.                                                   |
| `destinations`           | 20            | Confirmed destinations, or the options still being weighed.                                                 |
| `dates`                  | 20            | Exact dates if known, otherwise range and flexibility. See the envelope note below.                         |
| `travelers`              | 20            | Who is going, plus trip-specific detail about the group. See consent note below.                            |
| `purpose`                | 10            | Why the trip is happening. Emotional or practical context.                                                  |
| `budget`                 | 30            | Trip budget and tradeoffs. May override profile defaults.                                                   |
| `accommodation`          | 30            | Where to stay on this trip specifically.                                                                    |
| `transportation`         | 30            | Ground transport, rental car, airport transfers, walkability, transit, mobility.                            |
| `flights`                | 30            | Origin, cabin tradeoffs, layover tolerance, airline preferences. Not confirmation numbers.                  |
| `activities`             | 50            | What they want to do, are considering, or want to avoid.                                                    |
| `restaurants_food`       | 50            | Restaurants to book, cuisines to prioritize, food tours, markets, dining style.                             |
| `itinerary`              | 100           | Day-by-day shape. Rough early, more detailed as the trip firms up.                                          |
| `confirmed_bookings`     | 50            | Public summary of what is booked: provider, dates, type. Not confirmation numbers.                          |
| `deadlines`              | 30            | Time-sensitive items: booking deadlines, cancellation windows, visa dates, payments.                        |
| `documents`              | 30            | Confirmation numbers, reservation details, entry requirements, insurance, tickets. **Private, owner-only.** |
| `during_trip_notes`      | 50            | Notes captured while traveling.                                                                             |
| `post_trip_learnings`    | 30            | What worked, what did not, what to remember next time.                                                      |
| `additional_information` | 30            | Anything that fits no other section.                                                                        |

## Sections that need care

**Confirmation numbers, PNRs, ticket numbers and payment amounts go in `documents`, nowhere else.** `flights` and `confirmed_bookings` are the public-facing summary of the same bookings: provider, dates, type. Putting a PNR in `confirmed_bookings` moves private data into a section with a wider audience.

**`travelers` may name other people.** Populate named individuals only when the traveler has explicitly given those names in context for this purpose.

**`dates` duplicates the envelope on purpose.** The indexed `start_date` and `end_date` on the trip envelope are what `list_trips` sorts and filters on. The `dates` section is where nuance lives ("flexible either side of the 12th", "school holidays constrain the return"). When dates firm up, update **both**: the envelope fields via `update_trip`, and the section text. An envelope with dates and a section that still says "undecided" is the most common inconsistency in these documents.

**`itinerary` has the largest cap (100) and fills up fastest.** Because a write replaces the section wholesale, always read the current itinerary before adding a day. As it approaches the cap, consolidate per-day sentences rather than dropping days.

## Status

`status` is envelope, not section, and is one of exactly:

`Dreaming`, `Planning`, `Booking`, `Booked`, `Trip In Progress`, `Completed`, `Cancelled`, `On Hold`

Match the traveler's real stage. A trip they are idly fantasising about is `Dreaming`. Move it to `Planning` when they start making decisions, `Booking` while reservations are in flight, `Booked` when the core is confirmed. After the trip, set `Completed` and consider writing `post_trip_learnings` while it is fresh, plus a `past_trips` sentence on the profile.

A status change is an envelope-only `update_trip`: `trip_id`, `status`, `expected_version_hash`, nothing else.
