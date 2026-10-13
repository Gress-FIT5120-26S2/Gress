# KitchMemo Agile and Project Governance Index

The handover package retains the useful Agile context through a portfolio index rather than reproducing every sprint conversation inside the three main documents. The final backlog and receipt requirements remain to be reconciled with the course's earlier task list and Moodle resources.

## Available local evidence

| Artefact | Location in the full checkout | Use and limitation |
| --- | --- | --- |
| Product audience and direction | PRODUCT.md | Current problem framing and design principles |
| Shared-fridge Epic | docs/agile-board/Epic_08_Shared_Fridge.docx | Story context; confirm final board status separately |
| Usage-report Epic | docs/agile-board/Epic_09_Usage_Report.docx | Requirements reference, not proof of final acceptance |
| Food-waste animation Epic | docs/agile-board/Epic_10_Food_Waste_Animation.docx | Feature/story reference |
| Sorting-game Epic | docs/agile-board/Epic_11_Bin_Action_Minigame.docx | Learning-flow reference |
| Mentor meeting | docs/meetings/MENTOR_FEEDBACK_MINUTES_2026-09-15.md | Earlier feedback and actions |
| Mentor meeting | docs/meetings/MENTOR_FEEDBACK_MINUTES_2026-09-27.md | Includes explicitly accepted/rejected ACs and unclear outcomes; transcript date caveat retained |
| Historic testing | docs/testing/KitchMemo_Test_Cases_and_Report.xlsx | 99-case September baseline with failures/blocked work |
| Release evidence | docs/app-store/RELEASE_STATUS.md; docs/learning-room/verification/2026-10-12/ | Published release and exception records |
| Product introduction | deliverables/project-introduction/ | Local presentation/team/iteration evidence; untracked at source inspection |
| Current next-work register | Risk_and_Future_Backlog.csv | Handover recommendations and known limits, not a fabricated final board export |

No complete final Product Backlog export, agreed Definition of Done, full sprint-review/retrospective set or final acceptance matrix was established from the inspected sources. Obtain/register those records if available. The mentor minutes do not justify claiming every acceptance criterion was approved.

## Recommended PG folder convention

```text
KitchMemo Project Governance/
  01 Product and User Research/
  02 Backlog and Acceptance Criteria/
  03 Iterations and Sprint Reviews/
  04 Mentor Meetings and Decisions/
  05 Design and Ethics/
  06 Testing and Release Evidence/
  07 Retrospectives and Lessons Learned/
  08 Handover and Sign Off/
```

Use readable filenames with dates/version and a single index at the root. Place this package in the final folder or reference it through an immutable archive. Preserve links and revision dates for the live board; if a board may disappear, export it with stories, ACs, final status and outstanding work. Separate project governance evidence from production user data.

## Agile closure actions

1. Register the actual final board and freeze its export; retain delivered, deferred and rejected stories with rationale.
2. Link accepted stories to the registered build and test/UAT evidence. Resolve ambiguous mentor AC outcomes using a real review record.
3. Capture an honest retrospective: what helped, what caused rework, what the next team should preserve and what should change. Do not invent past meetings or team opinions.
4. Assign remaining bugs/technical debt to named receiving roles and priorities. Recommendations in this package are not automatically committed sprint work.
5. Verify the PG Google Drive URL and viewer access for industry/Monash reviewers. Record the final transfer and signatures.

## Lessons available from implementation evidence

The project demonstrates useful maintainability patterns: preserving deployed migrations, separating household data from private learning, using transaction/version boundaries for stock, handling request idempotency and distinguishing publication from native acceptance. It also shows why status documents need dates: old deployment plans conflict with later release evidence. These observations are package-author synthesis, not a recorded team retrospective.

## PG registration fields

PG Google Drive URL __________

Final board URL and export date __________

Story-to-release/acceptance index __________

Retrospective record and participants __________

Portfolio owner and viewer permission verification __________
