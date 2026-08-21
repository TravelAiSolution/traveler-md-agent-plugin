# Deep Dive Interview

Use this mode only when the user explicitly wants to explore their travel preferences in more depth, or when the user shows interest in refining a preference beyond a simple default.

## Core principle

Lead from evidence already available about the user. Do not run a generic questionnaire. Use realistic, constrained thought experiments to discover how the traveler makes tradeoffs when two priorities conflict.

The purpose is not to collect more preferences for their own sake. The purpose is to learn decision boundaries that improve future recommendations.

## Build thought experiments, not canned choices

Before asking a scenario question:

1. Review traveler.md plus any available user context.
2. Identify one or two priorities that are already known, strongly suggested, or directly adjacent to known information.
3. Identify a realistic situation where those priorities could conflict.
4. Construct two or more plausible options that isolate the tradeoff. Hold unrelated variables constant where possible.
5. Ask which option the user would choose.
6. Use the answer to make the next scenario more precise only when more nuance would materially change future recommendations.

Do not manufacture an implausible constraint merely to make the question sound nuanced. For example, do not make "premium economy middle seat" a default long-haul option. Use that only if the scenario is intentionally testing whether cabin matters more than seat and the constraint is clearly framed as hypothetical.

## Good scenario design

A useful thought experiment should answer a specific question about the user's priorities.

Examples:

- Known signal: the user prefers Wi-Fi. Unknown: whether connectivity outweighs routing convenience.
  Scenario: "Two flights cost about the same and arrive within 20 minutes of each other. One is nonstop but has no Wi-Fi; the other has Wi-Fi but adds a 75-minute connection. Which would you choose?"

- Known signal: the user cares about seat choice. Unknown: whether cabin or seat matters more.
  Start with normal choices first: "If premium economy had an aisle seat for $250 more than an economy window, which would you take on an 8-hour flight?"
  Then, only if useful, introduce a constrained edge case: "What if the only premium-economy seat left were a middle seat while economy still had your preferred window?"
  The second question is valuable because it deliberately tests the boundary revealed by the first; it should not be asked cold as a generic preference question.

- Known signal: business travel matters. Unknown: location versus hotel quality.
  Scenario: "For a three-night work trip, would you choose a very good hotel 20 minutes from the venue or a solid hotel five minutes away if the price were the same?"

- Known signal: the user travels with family. Unknown: directness versus schedule.
  Scenario: "For a family trip, would you rather take a nonstop that leaves at 6 a.m. or a one-stop flight leaving at 10 a.m. if total travel time is two hours longer?"

## Scenario quality rules

- Test one main tradeoff at a time. Avoid scenarios where price, airline, seat, cabin, routing, schedule, and amenities all change simultaneously.
- Keep options plausible and internally coherent.
- Hold irrelevant variables equal or explicitly state that they are roughly equal.
- Use thresholds only when they help locate a decision boundary: price premium, extra travel time, layover length, walk time, room size, etc.
- If the user says "it depends," ask what variable changes the answer rather than offering another random scenario.
- Prefer a short sequence of adaptive scenarios over a long batch of disconnected questions.
- Do not infer a durable rule from one forced-choice answer if the scenario is artificial or edge-case-heavy. Confirm the generalization first.

## Make answers easy

Keep the interaction fluid and one-question-at-a-time. Prefer structured choices whenever the likely answer space is reasonably predictable.

- Ask exactly one question at a time by default. The user's answer should determine the next question.
- Do not label prompts "Question 1", "Question 2", or show a batch of numbered questions unless the user explicitly requests a form-style interview.
- Use native single-select UI when choosing between mutually exclusive options, when the host supports it.
- Use native multi-select UI when several features can independently matter, when the host supports it.
- Keep options short and tailored; normally 2-5 options is enough.
- Include "It depends" when a hidden variable could reasonably change the answer.
- If interactive choice controls are unavailable, show only the current question with compact option text. Do not turn the interview into a numbered questionnaire.
- Do not force free text when a compact choice will work, but use one focused free-text follow-up when the user's reason is what reveals the nuance.

## Adaptive probing

Treat each answer as evidence for the next question.

Example sequence:

1. "On an 8-hour flight, would you pay $250 more for premium economy if both options had your preferred seat?"
2. If yes: increase the premium until the user becomes uncertain, or test whether cabin still wins when the preferred seat is unavailable.
3. If no: test a longer flight, smaller premium, or another benefit only if that distinction matters for future recommendations.
4. Summarize the emerging rule, such as: "It sounds like you value your preferred seat more than a modest cabin upgrade unless the flight is especially long or the upgrade price is low." Confirm before persisting if the rule is inferred rather than explicitly stated.

This is preferable to asking a fixed list such as "premium economy middle / economy window / economy aisle," because that mixes a normal choice with an arbitrary constraint before learning whether cabin-versus-seat is even an important tradeoff for this traveler.

## Context-specific travel modes

Explore differences by travel context only when there is evidence the context applies to the user. Useful contexts include solo, business, partner/couple, family, and friends/group travel.

Do not assume the user has children, a partner, business travel, or any other companion pattern. If a context is known to apply, compare it with the user's default behavior and probe where priorities plausibly change.

Examples:

- Work: flight timing, hotel location, workspace, schedule reliability, loyalty benefits, flexibility.
- Family: directness, departure time, room configuration, meals, transit complexity, pacing.
- Solo: spontaneity, neighborhood, convenience, dining style, budget, social activities.
- Friends/group: budget alignment, room sharing, coordination, planning ownership, activity flexibility.

## Capture nuance as conditional preferences

When the user reveals a conditional preference, preserve the condition instead of flattening it into an absolute rule.

Examples:

- Prefer a window seat in economy; choose premium economy when the upgrade is under a certain amount or on flights longer than a certain duration.
- Prefer nonstop flights for family travel; accept one connection when traveling solo if the savings are substantial.
- Prefer hotels near meetings for business travel; prioritize neighborhood character on leisure trips.

Write a durable conditional preference into the most specific profile section that fits, chosen from the profile-sections reference linked from this skill's SKILL.md rather than from memory. Keep a trip-specific exception in trip.md.

## Interview pacing

Ask one focused scenario at a time. Do not batch Deep Dive questions. Treat the interview as a branching conversation: answer → interpret → choose the next highest-value probe. Keep each turn short enough to feel like chat rather than a survey.

Periodically summarize the decision rule you think you learned. Confirm it before writing when it is an inference rather than an explicit statement.

## Stop conditions

End or switch topics when:

- the user's decision rule is actionable for future recommendations;
- another scenario would not change likely recommendations;
- the scenario becomes too artificial or detached from the user's actual travel patterns;
- the user wants to move on.

Offer another deep-dive topic only if it follows naturally from information already known about the user.
