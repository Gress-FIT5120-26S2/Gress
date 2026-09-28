# Mentor Feedback Meeting Minutes

**Date:** 15 September 2026  
**Time:** Approximately 6:45–7:01 pm  
**Attendees:** Mentor and project team (individual names were not consistently identifiable in the transcript)  
**Source:** Bilingual speech-to-text transcript; points below are consolidated and lightly edited for clarity.

## Discussion summary

### 1. Demonstrating the application and accessing data

- The team discussed a limitation in demonstrating the web version: it can show the interface, but it does not have the device ID and credentials required to access the trusted backend data.
- Screen sharing the installed mobile app over Zoom was suggested as a practical way to demonstrate data-backed functionality. The team discussed checking whether an Android device is available as well.
- A link was to be shared later. The team also noted that there are two weeks of consultation time available.
- The technical approach to device identity and backend access remains to be clarified with Ted.

### 2. Inventory visualisation

- The current category display includes categories with zero items, which makes it harder to see what is actually in the fridge.
- The mentor recommended hiding zero-count categories in both the main visualisation and the summary at the top. The team also discussed sorting categories by item count.
- The intended information hierarchy is to show what the user currently has, with categories derived from that inventory, rather than presenting empty categories as generic options.
- The animation angle/behaviour was noted as unfinished and in need of review.

### 3. Waste feedback and personalised shopping suggestions

- The achievement concept uses a mountain and blue-sky/green imagery to represent progress. The mentor liked the direction and suggested making the reduction in food waste visible with a number or other clear measure.
- The team discussed a waste report that summarises what a user has wasted, potentially by food category, and uses that history to offer personalised suggestions.
- Example: if a user repeatedly wastes apples or other fruit, suggest buying fewer next time (for example, three instead of five).
- The team discussed whether waste patterns could feed into a risk score and threshold. Example quantities raised in the conversation were illustrative; the scoring rules and thresholds were not decided.
- Recipe-related functionality was considered separate from this data and waste-reporting experience.

### 4. AI assistant scope, safety, and operating cost

- The assistant is intended to help users with the KitchMemo app. The mentor tested it with an unrelated request (Python linked-list code) to see whether it would go beyond that scope.
- The mentor stressed the need to protect the product and backend from out-of-scope use, uncontrolled API usage, and unexpected costs. Suggested controls included backend-side limits or rules, rather than relying only on the user interface.
- The team described an intended retrieval flow involving boundary/context checks, retrieval from a vector database, prompt construction, API generation, and a further check of the response. The technical details and safeguards need to be validated.
- The mentor recommended negative testing: check that the assistant declines requests outside its purpose, preserves its boundaries over longer conversations, and does not expose or misuse data. The assistant should not simply agree with every user request.
- Constraining the interaction to suggested buttons or a guided follow-up flow was discussed as one way to limit requests. However, the team noted that usability testing found users wanted to type their own thoughts. No final interaction design decision was recorded.

## Outcomes and recommendations

- Prioritise inventory visibility by hiding empty categories; consider ordering populated categories by item count.
- Make food-waste reduction measurable in the achievement experience and explore a waste report linked to tailored shopping suggestions.
- Strengthen backend controls and systematically test the assistant's scope, refusal behaviour, data boundaries, and API usage.
- Use a live mobile-app screen share as the near-term demonstration method when the web preview cannot access backend data.

## Action items

| Action | Owner | Status / notes |
|---|---|---|
| Share the application link with the team. | Speaker who offered to send it (name unclear) | Pending in transcript |
| Confirm the device ID/credential requirements and the appropriate web/demo access approach with Ted. | Team; technical input from Ted | Open |
| Arrange a Zoom screen-share demonstration using the installed mobile app; check Android availability if useful. | Team | Proposed |
| Hide zero-count inventory categories and review whether populated categories should be sorted by count. | Product/design team | Recommended; implementation status not recorded |
| Explore a clear waste-reduction measure and a waste report that can support personalised shopping suggestions. | Product/data team | Explore; metric and rules TBD |
| Define and test assistant backend limits, scope boundaries, refusal behaviour, and longer-conversation robustness. | Technical team (Ted for technical aspects, as discussed) | Open; detailed ownership TBD |
| Decide whether the assistant should retain free-text input, add guided follow-up buttons, or combine both. | Product/design team | Open; usability feedback favours free text |

## Open questions

- What is the secure and practical way to let the web version demonstrate user-specific data, if needed?
- What waste metric and threshold should drive achievement progress, risk scoring, or shopping suggestions?
- Which assistant requests should be supported, and what limits should apply to usage and cost?
- How should guided assistant options coexist with users' preference to enter free text?

