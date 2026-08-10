# traveler.md sections

The profile holds **durable** preferences. Anything true only of one trip belongs in that trip, not here.

Section names are exact. Unknown names are rejected. Every section is optional; omit what you are not changing. The authoritative descriptions and caps also ship in each write tool's input schema.

| Section                   | Max sentences | What belongs here                                                                                                   |
| ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `profile_overview`        | 10            | One or two sentences of general travel context. Keep it a summary, not a dumping ground.                            |
| `travel_style`            | 50            | How they approach travel: what they value, how they decide, what experience they want.                              |
| `pace_planning`           | 50            | How structured or relaxed trips should be. Itinerary density, appetite for spontaneity.                             |
| `budget_spending`         | 50            | Persistent budget style, spending philosophy, splurge categories. Trip-specific budget goes in the trip.            |
| `flight_preferences`      | 50            | Default airline, cabin, seat, routing, timing, booking habits.                                                      |
| `accommodation`           | 50            | Default lodging: hotel vs rental, room type, amenities, location.                                                   |
| `booking_platforms`       | 50            | Where they usually search and book flights, stays, cars, activities, restaurants.                                   |
| `work_travel`             | 30            | Business-trip patterns: typical duration, hotel setup, workspace needs, routines.                                   |
| `destination_preferences` | 50            | Types of destinations they like, avoid, or prioritize.                                                              |
| `transportation`          | 30            | Getting around cities, rural areas, road trips. Not flights.                                                        |
| `food_dining`             | 50            | Food interests, dining style, booking habits, strong preferences, allergies.                                        |
| `activities_interests`    | 50            | Activities, experiences and themes they usually enjoy.                                                              |
| `travel_companions`       | 20            | Who they travel with and persistent preferences about those groups. See consent note below.                         |
| `family_travel`           | 20            | Traveling with children, parents, siblings, extended family.                                                        |
| `pet_travel`              | 20            | Pet-related travel needs, if any.                                                                                   |
| `past_trips`              | 50            | Trips **already completed**, as context for recommendations. Past tense only.                                       |
| `dream_trips`             | 20            | Places and experiences they hope to do someday.                                                                     |
| `loyalty_programs`        | 50            | Airline, hotel, car, OTA and membership programs. Private. Format below.                                            |
| `identity_documents`      | 20            | Passport details, trusted-traveler programs, known traveler numbers, visas. Private.                                |
| `additional_information`  | 50            | Anything that fits no other section. Private, because uncategorized text tends to carry incidental personal detail. |

## Sections that need care

**`past_trips` is past tense only.** An upcoming, planned, considered or in-progress trip does not belong here. Those are separate trip documents. Writing a future trip into `past_trips` corrupts the recommendation context for every later agent.

**`travel_companions` and `past_trips` may name other people.** Name a specific individual only when the traveler has just told you that name in context and clearly wants it saved. Prefer roles ("travels with their partner") over names when the name adds nothing.

**`loyalty_programs` has a fixed sentence format:** one program per sentence, `<Brand> — <Status>`, for example `Hilton Honors — Gold`. When no tier is given, still use the separator: `Alaska Mileage Plan — `. Do not put membership numbers here; those are `identity_documents`.

**`identity_documents` is owner-only and sensitive.** Read it only when the task needs it. Never echo a passport or known-traveler number back into conversation, a summary, or another section.

## Choosing between profile and trip

| The traveler said                     | Goes to                            |
| ------------------------------------- | ---------------------------------- |
| "I always take the aisle"             | profile `flight_preferences`       |
| "Put me in 14C on this one"           | trip `flights`                     |
| "I hate resorts"                      | profile `accommodation`            |
| "Book the Hyatt for Kyoto"            | trip `accommodation`               |
| "I'm vegetarian"                      | profile `food_dining`              |
| "Let's do the tasting menu Thursday"  | trip `restaurants_food`            |
| "We did Portugal in 2024, loved it"   | profile `past_trips`               |
| "We're thinking Portugal next spring" | a trip document, status `Dreaming` |

When it could be either, ask yourself whether it will still be true in three years. If yes, it is profile.
