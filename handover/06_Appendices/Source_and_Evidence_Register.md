# KitchMemo Source and Evidence Register

This package is based on inspected local material, code and primary external references. A source can establish design intent, implementation or a dated test result; these are different evidence types. Source paths require the full repository checkout unless the item is copied into this package.

## Local authority and dated evidence

| Source | Evidence established | Qualification |
| --- | --- | --- |
| AGENTS.md | Versioned Expo reference and migration/comment obligations | Applies to continued work |
| PRODUCT.md | Primary 18-to-35 household audience, purpose, paused recipe direction | Product intent, not field-effectiveness evidence |
| package.json; server/package.json; lockfiles | Versions and executable script names | Dependency declarations plus reproducible locks |
| App.tsx; src/components/; src/services/ | Navigation, forms, provider state and API flow | Code inspection, not every-device acceptance |
| server/src/index.js; routes/; middleware/; services/ | API composition, validation and authorisation boundaries | Actual runtime contract checked against current code |
| supabase/migrations/ | Ordered schema and database behaviour | Preserve all previously applied migrations |
| docs/data-architecture/BACKEND_DATA_CONTEXT.md | Full explanation and latest 58-migration record | Contains historical states; deployed migrations win |
| docs/deployment/VERCEL_PRODUCTION_DEPLOYMENT.md | Procedures and secret separation | Opening status is older; latest release record supersedes it |
| docs/deployment/SECURITY_REMEDIATION_REPORT.md | September security remediation evidence | No claim of a complete penetration-test certification |
| docs/data-architecture/verification/2026-10-12/PRODUCTION_MIGRATION_VERIFICATION.md | Earlier 56-migration baseline, development verifiers and production rollback checks | Predates the same-day publication/privacy additions |
| docs/learning-room/verification/2026-10-12/RELEASE_VERIFICATION.md | Published course/tutor, owner exception, waived native tests and API release | Earlier native builds/API deployment replaced in later privacy record |
| docs/app-store/RELEASE_STATUS.md | Latest privacy/API and iOS build 13/Android preview/submitted review records | Apple approval not recorded; platform state is time-sensitive |
| docs/app-store/REVIEW_NOTES.md; APP_PRIVACY.md | Review workflows and data-flow disclosures | Course/sponsor legal determination not inferred |
| docs/app-store/SCREENSHOTS.md and actual JPEGs | Five supplied actual English phone captures | Known progress-text overlap; captures are not full UAT |
| docs/testing/KitchMemo_Test_Cases_and_Report.xlsx | 99 September cases with 71 pass, 2 fail, 25 blocked and 1 unexecuted | Historic scope, no filled tester identity |
| docs/learning-room/API_CONTRACT.md; AI_TUTOR_API_CONTRACT.md | Detailed module payload guidance | Reconcile with current routes and newest changes |
| docs/ai-assistant/KITCHMEMO_AI_ASSISTANT_IMPLEMENTATION_CONTEXT.md | Assistant tool/RAG/action context | Source for deeper future work |
| docs/achievement/ACHIEVEMENT_BUSINESS_RULES.md | Metrics and outcome design rationale | Older implementation gaps can be superseded |
| docs/meetings/MENTOR_FEEDBACK_MINUTES_2026-09-15.md and 2026-09-27.md | Mentor feedback and incomplete acceptance outcomes | Transcript-based; do not infer unnamed approvals |
| deliverables/project-introduction/src/page.html; README.md | Five team names/degrees, mentor and local product presentation | Untracked local artefact at inspection; hosted access not fully anonymous-verified |
| docs/art-direction/product-video/production-90s-v4/final-v12/ | Final film and production verification metadata | Creative narrative, not clinical/sustainability outcome evidence |
| LICENSE | MIT wording with Expo copyright notice | Not a complete chain of title for team code/media |
| Five current server tests and two client scripts | Current 75-test local result | Fixtures/loopback only; not live-provider testing |

## Guideline evidence

The five supplied Handover Package 2026 S2 screenshots are retained in `00_Control/Guideline_Reference/`. They specify Product, Support and Maintenance documents, knowledge transfer, sign-off, portfolio organisation and a Google Drive link. Their references to Moodle pre-reading/task list/template remain unverified because those materials were not supplied. Requirements are mapped in Guideline_Coverage.csv.

## Primary external references

All references below were consulted on 12 October 2026. Recheck evolving platform requirements before acting.

- Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/ — compatibility and runtime baseline.
- ACS conduct v2.1: https://www.acs.org.au/content/dam/acs/ACSimages/ethicsdiscipline/Code-of-Professional-Conduct_v2.1.pdf — six-category conduct reference; course edition requires confirmation.
- ACS ethics and conduct: https://www.acs.org.au/memberships/professional-ethics-conduct-and-complaints.html — distinguish current ethics values and conduct material.
- FSANZ dates: https://www.foodstandards.gov.au/consumer/labelling/dates — use-by and best-before distinction.
- Vercel Express: https://vercel.com/docs/frameworks/backend/express — current deployment model.
- Supabase backups: https://supabase.com/docs/guides/platform/backups — backup scope, including Storage-file exclusion.
- Supabase restore: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore — current restore reference.
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ — accessibility-review reference, no complete conformance claim.

## Authorship and inference controls

Recorded team/contact/build facts are attributed to local evidence. Proposed operating routines, staffing roles, pilot sponsor types, recovery targets and priorities are recommendations. Missing URLs, budgets, roles and signatures remain unresolved. Source code is not evidence of actual user testing, completed training, sponsor acceptance or an independently reviewed content release.
