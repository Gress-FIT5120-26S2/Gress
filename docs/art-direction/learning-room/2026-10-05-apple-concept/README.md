# KitchMemo Learning Room — concept preview

Date: 2026-10-05, Australia/Sydney. Status: proposed design; not an implemented feature.

Superseded by [app palette v2](../2026-10-05-app-palette-v2/README.md). The project owner confirmed SDG 13 — Climate Action and requested alignment with the current Fridge and Achievements colours. SDG 12 references and images below describe the initial exploration only, not the current project alignment. Use v2 for further design and implementation.

## Product direction

A small teaching space inside KitchMemo. Organise content around learning objectives, short courses, practical activities and checkpoints. The existing food-waste animation introduces the problem; Bin Action provides applied practice. Related articles explain the evidence and connect actions to SDG 12.

Proposed entry: a Learning Room entry from Home, with a secondary entry in Profile. Keep its course and assessment flow in a dedicated stack. The current five main tabs already serve other features, so placement in the main navigation needs a separate product decision.

The room has three local sections:

- Learn: resume the current lesson and browse structured courses.
- My path: see completed, current and locked assessment stages.
- Library: browse curated guides, data and news, grouped by topic and linked back to courses. Reading remains accessible regardless of assessment level.

## Learning sequence

Each course follows a short lesson, an optional practical activity, and a checkpoint. Lessons should include a clear objective, estimated duration, evidence, one reflection prompt where helpful, and a next action. News entries need publisher, publication date, topic, a short summary explaining relevance, and an original-source link; they should not be presented as an unfiltered feed. Statistical entries must preserve the measurement year and population scope.

| Stage | Topics | Suggested assessment |
| --- | --- | --- |
| Beginner | Food-waste causes, material recognition, basic disposal streams | 6 questions; at least 5 correct |
| Intermediate | Separating packaging components, contamination, local recycling rules, collection alternatives | 8 questions; at least 7 correct |
| Advanced | Preventing waste, shopping and storage habits, reuse and circularity, interpreting waste data and SDG 12 | 10 questions; at least 8 correct |

All stages use a proposed minimum score of 80%; integer pass counts round up. Passing permanently unlocks the next stage. The next visit resumes the newly unlocked stage or its unfinished attempt. Earlier courses and assessments remain available for review. Failing offers explanations, targeted revision and another attempt drawn from an approved question bank. Question feedback should explain why the answer is correct, identify the applicable region, and link to a source. Advanced completion opens mixed-topic maintenance practice rather than an undefined further level.

Treat learning progress as personal to the authenticated installation/device under the current account model. Shared-fridge membership must not automatically grant another person's quiz completion. Quiz scores represent learning, and must not be counted as physical waste disposal, money saved, environmental impact, or existing fridge XP without a separately specified contract.

## Feasibility from current repository

The project uses Expo SDK 57, React Native, an authenticated Express API and Supabase. Existing screens already provide the educational animation and material-sorting interaction. `src/services/wasteLearningApi.ts` and `server/src/routes/wasteLearning.js` expose sorting-attempt submission and aggregate learning statistics.

The existing sorting-attempt endpoint requires a matching inventory consume event, fridge and actor. It cannot directly host independent course quizzes. Structured courses, standalone quiz attempts, content versions, personal progression and unlock rules are additional work. Preserve the existing game and add a dedicated learning contract. Authoritative assessment grading and progression belong on the server; an approved answer bank should not rely on unreviewed model-generated answers. A future database change requires a new timestamped migration, development verification before production, and an update to BACKEND_DATA_CONTEXT.md.

This preview does not change application code, data routes or the database.

## Visual direction and preview screens

Warm white surfaces, charcoal typography, restrained sage/forest green, and a small amber accent compatible with KitchMemo. Apple-inspired spacing and native hierarchy, with flat curriculum rows and one clear primary action. English copy follows the existing app's bilingual product context; Chinese localisation can be supplied during implementation.

1. `01-learning-room.png`: course resume and the next learning activities.
2. `02-course-detail.png`: objective, curriculum, activity types and checkpoint.
3. `03-quiz-question.png`: a region-labelled question with an answer selected before submission.
4. `04-quiz-progression.png`: 5/6 correct, 83% rounded, Intermediate unlocked and Advanced locked.
5. `05-reading-sdg.png`: a guided data article with measurement scope, source, SDG targets and reflection.

These are AI-generated concept images, not screenshots of working app screens. Final navigation labels and layout dimensions need implementation review.

Generation: built-in image_gen tool. The complete design bible and individual generation prompts are preserved in `IMAGEGEN_PROMPTS.md`.

## Sources checked

- Canvas module completion requirements and minimum scores: https://community.instructure.com/en/kb/articles/660897-how-do-i-add-requirements-to-a-module
- Moodle activity completion: https://docs.moodle.org/502/en/Activity_completion
- Apple layout guidelines: https://developer.apple.com/design/human-interface-guidelines/layout
- Expo SDK 57 reference: https://docs.expo.dev/versions/v57.0.0/
- UN SDG 12, especially targets 12.3 and 12.5: https://sdgs.un.org/goals/goal12
- UNEP Food Waste Index Report 2024: https://www.unep.org/news-and-stories/press-release/world-squanders-over-1-billion-meals-day-un-report
- Victoria sorting guidance and local-government scope: https://www.environment.vic.gov.au/household-waste-recycling/sort-waste-recycling

The reading mockup uses UNEP's historical estimate of 1.05 billion tonnes in 2022 across retail, food service and households, including inedible parts. It is not a live measurement or a claim about 2026.
