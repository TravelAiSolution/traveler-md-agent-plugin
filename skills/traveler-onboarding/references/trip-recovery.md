# Trip recovery

Treat a candidate as a likely existing trip when the destination plus overlapping dates match, or when several strong details match: purpose, lodging, travelers, event, booking. When uncertain, ask before creating a second trip.

Create a trip only for the user's own travel plans or aspirations. Do not create one from travel mentioned about another person, from an example, a hypothetical, a news item, or a recommendation you made.

Use the narrowest justified status:

- `Dreaming`: an aspiration or an idea, not an active plan.
- `Planning`: the user intends the trip and is working out details.
- `Booking`: actively making reservations.
- `Booked`: core reservations are confirmed.
- `Trip In Progress`: currently travelling.
- `Completed`: already finished.

Do not infer a higher status merely because dates are known. A date in a recalled conversation is not a booking. The remaining statuses, `Cancelled` and `On Hold`, are not recovery outcomes: set either only when the traveler says so.
