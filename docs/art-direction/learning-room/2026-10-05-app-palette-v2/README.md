# KitchMemo Learning Room — app palette v2

Date: 2026-10-05, Australia/Sydney. Status: revised concept preview, not implemented app screens.

The user has approved this revision for strict implementation. The detailed [implementation plan](../../../learning-room/IMPLEMENTATION_PLAN.md), [visual specification](../../../learning-room/VISUAL_SPEC.md), [handoff](../../../learning-room/HANDOFF.md), and [actual progress](../../../learning-room/IMPLEMENTATION_STATUS.md) are the continuation baseline. This approval does not mean the feature has been implemented.

## Confirmed project direction

The project's UN goal is **SDG 13 — Climate Action**, as confirmed by the project owner. The teaching room connects everyday waste prevention, sorting and recycling to climate awareness. Its closest educational alignment is **target 13.3**, which addresses climate education, awareness and capacity. This is a product alignment, not a claim of official UN endorsement or fulfilment of the national curriculum indicator.

Preserve the approved short-course structure: lesson → educational animation or Bin Action practice → quiz → next learning stage. The room contains Learn, My path and Library sections. News, evidence and data are curated by topic and linked to the courses. Articles need dates, source links, context and a practical reflection prompt.

## Palette taken from the current application code

| Role | Colour | Current app reference |
| --- | --- | --- |
| Page background | `#F7FBFA` | FridgeScreen and AchievementsScreen |
| Content surface | `#FFFFFF` | Fridge search/empty state and achievement cards |
| Main text | `#173D31` | Fridge section heading and achievement card titles |
| Secondary text | `#70827A` | Achievement captions and secondary labels |
| Border | `#DDECE6` | Achievement content cards |
| Progress, success and local selection | `#2A8A61` | Achievement icons, links and success states |
| Supporting mint surface | `#EAF6F1`, `#E0F3EA` | Achievement icon and action backgrounds |
| Primary learning action | `#F58220` | Fridge add actions |
| Supporting light blue | `#EAF7FD` | Fridge switcher; relates to achievement mountain sky |
| Blue text on supporting surface | `#24566E` | Fridge switcher |

These are design mappings from existing component styles, not a newly implemented shared token system. Raster concept colours are illustrative; future implementation must use the specified values. Use orange for the main action, green for learning status, and blue sparingly for the continuation card or completion emblem. Keep whitespace, native hierarchy, restrained shadows and white/mint surfaces. Do not copy the full achievement mountain stage into the learning interface.

Source files inspected: `src/components/FridgeScreen.tsx`, `src/components/AchievementsScreen.tsx`, `src/components/achievement/AchievementMountainHero.tsx`, `src/components/achievement/AchievementImpactCard.tsx`, and `src/components/achievement/AchievementQuestSection.tsx`. Current runtime styles take precedence over older design documents if their colours differ.

## Curriculum and progression

| Stage | Waste-focused content with climate connection | Suggested checkpoint |
| --- | --- | --- |
| Beginner | Why food is wasted, material recognition, basic sorting, introduction to waste and climate | 6 questions; at least 5 correct |
| Intermediate | Multi-part packaging, contamination, local collection rules, reuse and resource demand | 8 questions; at least 7 correct |
| Advanced | Preventing waste through shopping and storage, circular use, emissions evidence, SDG 13 and practical climate choices | 10 questions; at least 8 correct |

Minimum score is 80%, with the required correct count rounded up. Passing unlocks the next stage permanently; the next visit resumes that stage or an unfinished attempt. Previous levels remain available for review. Failed attempts offer explanations, relevant revision and another attempt. Learning progress belongs to the individual authenticated installation under the current device model. Shared-fridge membership does not grant someone else's quiz completion.

A quiz result is a learning record. It must not claim measured avoided emissions, real disposal, saved money or shared-fridge XP. Classification questions must preserve region and council scope. Approved answers and sources are required; unreviewed generated answers cannot be the authoritative question bank.

## Revised screens

1. `01-learning-room.png`: familiar mint/green/orange palette, pale-blue continuation card, Food waste & SDG 13 reading entry.
2. `02-course-detail.png`: approved curriculum layout, app-coloured primary action and climate reading connection.
3. `03-quiz-question.png`: region-labelled sorting assessment, app-green selection and orange submission button.
4. `04-quiz-progression.png`: 5/6 correct, rounded 83%, Intermediate unlocked, app-coloured progress and action.
5. `05-reading-sdg.png`: food loss and waste emissions context, SDG 13.3, and a practical climate reflection.

The reading concept uses **8–10% of annual global greenhouse gas emissions associated with food loss and waste**, citing UNFCCC's article dated 30 September 2024. Preserve its global scope and its inclusion of food loss as well as food waste. This is not a household-only estimate, a 2026 measurement or an estimate of an individual user's impact. Education about food production resources and practical waste prevention explains the link to climate action.

## Implementation scope remains additional work

Existing animation and Bin Action are useful learning assets. Existing sorting attempts are tied to inventory consumption events and do not directly support independent course quizzes. Standalone attempts, personal progression, versioned course/question content and server-side unlock rules require a dedicated contract. Any future database behaviour change requires a new timestamped migration, development verification before production and a BACKEND_DATA_CONTEXT.md update.

This revision changes only design documentation and generated mockups. No app, Express or database code has changed. Original v1 images remain available for historical comparison; v2 is the current direction.

## Generation and sources

Generated with built-in image_gen by editing each corresponding v1 screen. The original phone presentation, layout and course flow were preserved while colours, back labels and SDG content were revised. Complete prompts and source-image paths are in `IMAGEGEN_PROMPTS.md`.

- UN Goal 13 and target 13.3: https://sdgs.un.org/goals/goal13
- UNFCCC climate connection and the 8–10% estimate: https://unfccc.int/news/food-loss-and-waste-account-for-8-10-of-annual-global-greenhouse-gas-emissions-cost-usd-1-trillion
- Canvas module completion and score requirements: https://community.instructure.com/en/kb/articles/660897-how-do-i-add-requirements-to-a-module
- Victoria waste sorting and local-government scope: https://www.environment.vic.gov.au/household-waste-recycling/sort-waste-recycling
