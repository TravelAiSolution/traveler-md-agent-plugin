# traveler.md sections

The profile holds **durable** preferences. Anything true only of one trip belongs in that trip, not here.

Section names are exact. Unknown names are rejected. Every section is optional; omit what you are not changing. The authoritative descriptions and caps also ship in each write tool's input schema.

| Section                   | Max sentences | What belongs here                                                                                                   |
| ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `profile_overview`        | 10            | One or two sentences of general travel context. Keep it a summary, not a dumping ground.                            |
| `travel_style`            | 100           | How they approach travel: what they value, how they decide, what experience they want.                              |
| `pace_planning`           | 100           | How structured or relaxed trips should be. Itinerary density, appetite for spontaneity.                             |
| `budget_spending`         | 100           | Persistent budget style, spending philosophy, splurge categories. Trip-specific budget goes in the trip.            |
| `flight_preferences`      | 100           | Default airline, cabin, seat, routing, timing, booking habits.                                                      |
| `accommodation`           | 100           | Default lodging: hotel vs rental, room type, amenities, location.                                                   |
| `booking_platforms`       | 100           | Where they usually search and book flights, stays, cars, activities, restaurants.                                   |
| `work_travel`             | 100           | Business-trip patterns: typical duration, hotel setup, workspace needs, routines.                                   |
| `destination_preferences` | 100           | Types of destinations they like, avoid, or prioritize.                                                              |
| `transportation`          | 100           | Getting around cities, rural areas, road trips. Not flights.                                                        |
| `food_dining`             | 100           | General food interests, dining style, restaurant booking habits, strong preferences. No medical detail.             |
| `activities_interests`    | 100           | Activities, experiences and themes they usually enjoy.                                                              |
| `travel_companions`       | 100           | Who they travel with and persistent preferences about those groups. See consent note below.                         |
| `family_travel`           | 100           | Traveling with children, parents, siblings, extended family.                                                        |
| `pet_travel`              | 100           | Pet-related travel needs, if any.                                                                                   |
| `past_trips`              | 100           | Trips **already completed**, as context for recommendations. Past tense only.                                       |
| `dream_trips`             | 100           | Places and experiences they hope to do someday.                                                                     |
| `loyalty_programs`        | 100           | Airline, hotel, car, OTA and membership programs. Private. Format below.                                            |
| `identity_documents`      | 100           | Passport country and trusted traveler program names, visa context. Private. No government identifiers.              |
| `additional_information`  | 100           | Anything that fits no other section. Private, because uncategorized text tends to carry incidental personal detail. |

## Sections that need care

**`past_trips` is past tense only.** An upcoming, planned, considered or in-progress trip does not belong here. Those are separate trip documents. Writing a future trip into `past_trips` corrupts the recommendation context for every later agent.

**`travel_companions` and `past_trips` may name other people.** Name a specific individual only when the traveler has just told you that name in context and clearly wants it saved. Prefer roles ("travels with their partner") over names when the name adds nothing.

**`loyalty_programs` has a fixed sentence format:** one program per sentence, `<Brand> — <Status>`, for example `Hilton Honors — Gold`. When no tier is given, write the brand alone: "Alaska Mileage Plan". An airline, hotel, or car-rental loyalty number may follow the status after a comma when the traveler states it. Never put known traveler, PASS ID, redress, passport, or ID numbers in any section. Trusted traveler programs may be named only.

**Medical detail belongs in no section.** Allergies, intolerances, dietary restrictions and health conditions are not travel preferences. Keep them out of `food_dining` and out of every other section, including when the traveler mentions one in passing. A dining preference is fine to record ("prefers vegetarian menus"); the medical reason behind it is not. Note that `food_dining` is a public-scope section, so anything written there is readable by every client the traveler connects.

**`identity_documents` is owner-only and sensitive.** Read it only when the task needs it. Never write passport or known traveler numbers. If legacy content contains one, do not echo it into conversation, a summary, or another section.

## Choosing between profile and trip

| The traveler said                     | Goes to                            |
| ------------------------------------- | ---------------------------------- |
| "I always take the aisle"             | profile `flight_preferences`       |
| "Put me in 14C on this one"           | trip flight event                  |
| "I hate resorts"                      | profile `accommodation`            |
| "Book the Hyatt for Kyoto"            | trip accommodation event           |
| "I prefer vegetarian menus"           | profile `food_dining`              |
| "Let's do the tasting menu Thursday"  | trip dining event                  |
| "We did Portugal in 2024, loved it"   | profile `past_trips`               |
| "We're thinking Portugal next spring" | a trip document, status `Dreaming` |

When it could be either, ask yourself whether it will still be true in three years. If yes, it is profile.
