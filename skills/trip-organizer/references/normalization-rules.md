# Normalization rules

Prefer one clear sentence per independent fact. Preserve exact dates, names, constraints, and booking state. Do not rewrite a fact into a vaguer summary when the precision mattered.

Common moves:

- A hotel confirmation code in `accommodation` moves to `documents`. The property details stay in `accommodation` or `confirmed_bookings`.
- A restaurant idea sitting in `itinerary` moves to `restaurants_food`, unless the day placement is the point, in which case the itinerary keeps a concise scheduled reference.
- A cancellation or payment date moves to `deadlines`.
- A flight record locator in `flights` moves to `documents`.
- Things to do buried in `additional_information` move to `activities`.
- A note written during the trip that is sitting in `itinerary` or `additional_information` moves to `during_trip_notes`.

Do not erase information merely because it looks redundant. If one copy carries extra precision, that copy is the one to keep.

Move a fact and remove its old copy in the same `update_trip`, sending both sections in one call. Split across two calls, a failure between them loses the fact entirely.

Consolidation is bounded by the per-section sentence cap, which differs by section and is listed in the trip-sections reference linked from this skill's SKILL.md. A cap is a reason to merge two sentences into a denser one. It is never a reason to drop a fact.
