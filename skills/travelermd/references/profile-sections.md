# traveler.md sections

The profile holds **durable** preferences. Anything true only of one trip belongs in that trip, not here.

Section names are exact. Unknown names are rejected. Every section is optional; omit what you are not changing. The authoritative descriptions and caps also ship in each write tool's input schema.

| Section                   | Max sentences | What belongs here                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile_overview`        | 10            | One or two sentences of general travel context. Keep it a summary, not a dumping ground.                                                                                                                                                                                                            |
| `travel_style`            | 50            | How they approach travel: what they value, how they decide, what experience they want.                                                                                                                                                                                                              |
| `pace_planning`           | 50            | How structured or relaxed trips should be. Itinerary density, appetite for spontaneity.                                                                                                                                                                                                             |
| `budget_spending`         | 50            | Persistent budget style, spending philosophy, splurge categories. Trip-specific budget goes in the trip. Travel rewards cards belong in loyalty_programs, by product name only.                                                                                                                     |
| `flight_preferences`      | 50            | Default airline, cabin, seat, routing, timing, booking habits.                                                                                                                                                                                                                                      |
| `accommodation`           | 50            | Default lodging: hotel vs rental, room type, amenities, location.                                                                                                                                                                                                                                   |
| `booking_platforms`       | 50            | Where they usually search and book flights, stays, cars, activities, restaurants.                                                                                                                                                                                                                   |
| `work_travel`             | 30            | Business-trip patterns: typical duration, hotel setup, workspace needs, routines.                                                                                                                                                                                                                   |
| `destination_preferences` | 50            | Types of destinations they like, avoid, or prioritize.                                                                                                                                                                                                                                              |
| `transportation`          | 30            | Getting around cities, rural areas, road trips. Not flights.                                                                                                                                                                                                                                        |
| `food_dining`             | 50            | General food interests, food preferences, dining style, restaurant booking habits. No medical detail.                                                                                                                                                                                               |
| `activities_interests`    | 50            | Activities, experiences and themes they usually enjoy.                                                                                                                                                                                                                                              |
| `travel_companions`       | 20            | Who they travel with and persistent preferences about those groups. See consent note below.                                                                                                                                                                                                         |
| `family_travel`           | 20            | Traveling with children, parents, siblings, extended family.                                                                                                                                                                                                                                        |
| `pet_travel`              | 20            | Pet-related travel needs, if any.                                                                                                                                                                                                                                                                   |
| `past_trips`              | 50            | Trips **already completed**, as context for recommendations. Past tense only.                                                                                                                                                                                                                       |
| `dream_trips`             | 20            | Places and experiences they hope to do someday.                                                                                                                                                                                                                                                     |
| `loyalty_programs`        | 50            | Program name, tier, and membership number if the traveler provides it. Travel rewards credit cards may be listed by product name (e.g. American Express Membership Rewards, Platinum). Never payment card numbers. Private. Format below.                                                           |
| `identity_documents`      | 20            | Which passports the traveler holds (nationality only) and, optionally, approximate expiry as month and year, used for visa suggestions. Trusted traveler program memberships by name only (e.g. Global Entry, NEXUS). Never passport numbers, known traveler numbers, or other ID numbers. Private. |
| `additional_information`  | 50            | Anything that fits no other section. Private, because uncategorized text tends to carry incidental personal detail.                                                                                                                                                                                 |

## Sections that need care

**`past_trips` is past tense only.** An upcoming, planned, considered or in-progress trip does not belong here. Those are separate trip documents. Writing a future trip into `past_trips` corrupts the recommendation context for every later agent.

**`travel_companions` and `past_trips` may name other people.** Name a specific individual only when the traveler has just told you that name in context and clearly wants it saved. Prefer roles ("travels with their partner") over names when the name adds nothing.

**`loyalty_programs` has a fixed sentence format:** one program per sentence, `<Brand> — <Status>, member <number>`, for example `Hilton Honors — Gold, member 123456789`. The renderer splits on the first dash, so the membership number goes after the status. Include the number only if the traveler provides it: `Hilton Honors — Gold` is also valid. When no tier is given, still use the separator: `Alaska Mileage Plan — `. A travel rewards card is listed by product name only, for example `American Express Membership Rewards — Platinum`. Never write a payment card number here.

**Medical detail belongs in no section.** Allergies, intolerances, food restrictions for medical reasons, health conditions and accessibility needs are not travel preferences. Keep them out of `food_dining` and out of every other section, including when the traveler mentions one in passing. A dining preference is fine to record ("prefers vegetarian menus"); the medical reason behind it is not. Note that `food_dining` is a public-scope section, so anything written there is readable by every client the traveler connects.

**`identity_documents` is owner-only and sensitive.** Read it only when the task needs it. It holds passport nationality, optional month-and-year expiry, and trusted traveler program names. Never write a passport number, known traveler number or other ID number into it or into any other section.

## Choosing between profile and trip

| The traveler said                     | Goes to                            |
| ------------------------------------- | ---------------------------------- |
| "I always take the aisle"             | profile `flight_preferences`       |
| "Put me in 14C on this one"           | trip `flights`                     |
| "I hate resorts"                      | profile `accommodation`            |
| "Book the Hyatt for Kyoto"            | trip `accommodation`               |
| "I prefer vegetarian menus"           | profile `food_dining`              |
| "Let's do the tasting menu Thursday"  | trip `restaurants_food`            |
| "We did Portugal in 2024, loved it"   | profile `past_trips`               |
| "We're thinking Portugal next spring" | a trip document, status `Dreaming` |

When it could be either, ask yourself whether it will still be true in three years. If yes, it is profile.
