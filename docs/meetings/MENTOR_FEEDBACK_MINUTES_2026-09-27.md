# Mentor Feedback Meeting Minutes

**Date:** 27 September 2026 (as stated in the transcript header; the source filename is `9.18.txt`)  
**Time:** Approximately 8:11–8:38 pm  
**Attendees:** Mentor and project team (individual names were not consistently identifiable in the transcript)  
**Source:** Bilingual speech-to-text transcript; discussion points are consolidated and lightly edited for clarity.

## Discussion summary

### 1. Build status and acceptance criteria

- The team reported that the final build had been completed the previous day and discussed integration, estimated in the conversation at about three hours.
- The meeting included a review of user stories and acceptance criteria (ACs), including items numbered 6.1, 6.2, 6.3, 6.5, and 10.3. Some item references and acceptance decisions were unclear in the transcript.
- The mentor praised the team's AC writing as clear and noted that the “Given” precondition was used effectively. The mentor may showcase the examples in class and proposed a peer-learning session with another team closer to the next iteration.
- The team was asked to simplify some naming and revise wording in response to review comments.
- AC1 and AC2 under 6.2.1 were explicitly accepted. The transcript also records 6.3.1 ST1 and AC2 as rejected because they were not sufficiently user-centred. Other criteria were reviewed, but their final status is not consistently clear from the transcript.

### 2. AI assistant entry and interaction

- The team discussed when the assistant should be visible, including on the shopping, achievements, profile, or main page, and whether it should display a short greeting.
- Opening the assistant in a full-screen view was considered acceptable. The discussion also covered tapping the mascot to open the assistant and making it available during other tasks, including camera-based food entry.
- A whitelist was mentioned as a possible control, but the transcript does not establish a final implementation decision.

### 3. Food recognition and scanning fallback

- The current photo-recognition capability was described as supporting fruit. The mentor asked about accuracy and coverage, including vegetables; these questions were not resolved in the transcript.
- The mentor recommended clear error handling: if an item is outside the supported photo-recognition scope or cannot be identified, direct the user to barcode scanning. Barcode scanning was suggested for other products.
- The team discussed product/QR scanning and whether a dedicated button would make the available scanning methods clearer.

### 4. Challenges, milestones, and page layout

- The mentor noted that a page had substantial scrolling and suggested separating challenges from milestones, potentially placing challenges on a separate page or section.
- The distinction should remain clear: milestones represent milestones, while challenges can be presented separately. This was a design suggestion rather than a confirmed implementation decision.

### 5. Performance and feedback handling

- Loading delays were observed when the internet connection was poor. The team discussed checking the experience in slower conditions; the transcript also mentions a slower server version, but does not record a completed test result.
- The conversation raised whether user-testing feedback cards were visible on the project/LinkedIn page. Feedback had been recorded in the PGP but had not yet been actioned there. The exact destination and workflow were not clear.
- A need for three or four people was mentioned in the same discussion, but the transcript does not clearly specify whether this referred to testing participants or another activity.

### 6. Voice interaction and future reporting

- The mentor proposed exploring hands-free voice interaction so users could ask what is expiring or what they need to buy without looking at the app. The discussion distinguished voice input, speech-to-text, and spoken responses; the intended scope remains undecided.
- An always-listening/background option was floated as an experiment. The team noted that feasibility was uncertain and made no commitment.
- The mentor suggested considering this as a possible future iteration-three feedback loop and communicating with the relevant leadership team. No scope or delivery commitment was recorded.
- A future community event before year-end was mentioned. The Education team may share app-usage and food-waste data, with a possible weekly or seasonal user report summarising an individual's contribution to the community. This was a future concept, not a confirmed feature requirement.

## Outcomes and recommendations

- Keep the acceptance criteria clear and user-centred; simplify names and revise the criteria that received review comments.
- Make the scanning mode's supported scope clear and provide barcode scanning as a fallback when photo recognition is unavailable or unsuccessful.
- Review assistant placement and its short greeting across relevant app screens; the full-screen assistant view was acceptable in the discussion.
- Consider separating challenges from milestones to reduce scrolling and clarify the page structure.
- Explore voice interaction and periodic impact reporting as future ideas, subject to user value and technical feasibility.

## Action items

| Action | Owner | Status / notes |
|---|---|---|
| Simplify naming and revise acceptance criteria using the mentor's comments. | Team member who offered to revise (name unclear) | In progress during the meeting; final status not recorded |
| Revisit 6.3.1 ST1 and AC2 to make the user action and system response more user-centred. | Product team | Rejected in review; revision needed |
| Confirm the final acceptance status of criteria whose outcomes were unclear in the transcript. | Product team | Open |
| Add or confirm an error path that directs unsupported or unrecognised photo entries to barcode scanning. | Product/technical team | Recommended; implementation status not recorded |
| Check photo-recognition coverage and accuracy for supported produce, and clarify supported item types in the interface. | Technical/product team | Open |
| Review assistant visibility, greeting, and full-screen behaviour across relevant screens. | Product/design team | Review discussed; detailed requirements to confirm |
| Evaluate whether challenges should be separated from milestones to reduce scrolling. | Product/design team | Suggestion for consideration |
| Check loading behaviour under poor network conditions and confirm how feedback cards are actioned. | Team | Open; feedback destination/workflow unclear |
| Assess the feasibility and user value of voice interaction and periodic impact reports for a future iteration. | Team; discuss with relevant leadership team | Exploratory; no commitment |

## Open questions

- Which acceptance criteria, beyond the explicitly accepted and rejected items, are final?
- What photo-recognition categories and accuracy level will the app support, and when should it switch users to barcode scanning?
- On which screens should the assistant appear, and should the mascot show a greeting before opening the full-screen assistant?
- Should challenges have a separate page or section from milestones?
- What did the reference to three or four people mean, and where should user-testing feedback cards be published and actioned?
- Is voice input, spoken output, or an always-listening mode feasible and appropriate for a future iteration?
- What reporting cadence and measures would be useful for a community or seasonal impact report?

