# Source selection for add-trip

Choose sources based on evidence about the trip and the traveler's habits. Prefer the smallest useful set. Every category below is a heuristic about where trip context usually lives, not a claim that the connector exists. Check what the host actually exposes before offering one.

## Email (Gmail, Outlook and similar)

Use when the source is likely to contain a flight, hotel, rail, rental car, restaurant, ticket or event confirmation. Search narrowly around destination, dates, provider names, and known event names.

## Calendar (Google Calendar, Outlook and similar)

Use when dates, business meetings, conferences, reservations, or day-by-day commitments are likely to be represented as events. Treat a calendar entry as schedule evidence, not automatically as a paid or confirmed booking.

## Documents and spreadsheets (Drive, Docs, Sheets, Notion and similar)

Use when the traveler says, or available context indicates, that they plan trips in a document or a spreadsheet, or when a known trip-planning file is available. Prefer the specific known file over a broad search. Preserve the distinction between ideas, options, and confirmed arrangements.

## Team chat (Slack, Teams and similar)

Use primarily for a work trip, where channels or messages may hold meeting locations, conference details, customer visits, team logistics, or agreed travel plans. Search only the relevant work context; do not trawl unrelated conversations.

## Current conversation and available user context

Use these before asking the traveler to repeat information. Treat remembered or historical context as candidate evidence that may be stale, and reconcile it against traveler.md and against fresher sources.

## Permission rule

If the user explicitly asks to use a source, proceed. Otherwise ask before retrieving additional connector context for trip assembly. Offer only the one or two most relevant sources at a time, with a brief reason.

## Evidence hierarchy

- Explicit current user statement: high confidence.
- Confirmed booking artifact or message: high confidence for the facts it actually confirms, and nothing more.
- Existing traveler.md trip data: the source of truth for what is already recorded, though it may be incomplete or stale.
- Calendar and work planning artifacts: useful evidence, but may represent an intention rather than a booking.
- Older conversation or memory context: candidate evidence; verify when materially stale or contradictory.

Never silently resolve a contradiction. Surface it, or preserve the uncertainty in the trip record.
