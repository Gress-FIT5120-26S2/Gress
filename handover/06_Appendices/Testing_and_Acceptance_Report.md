# KitchMemo Testing and Acceptance Report

This report distinguishes checks rerun during package preparation from historical repository evidence and acceptance work still required. It supports an informed receiving decision; it does not declare that the whole release passed native UAT.

Version 1.0 | Prepared 12 October 2026 | Source a37304cd7746f61872673cc9d8d05e8f7536badf

## 1 Current local verification

| Check | Method | Result |
| --- | --- | --- |
| TypeScript | Existing TypeScript compiler with --noEmit | PASS, exit 0 |
| Client room/navigation | scripts/test-learning-room.mjs | 14 passed, 0 failed |
| Client gateway | scripts/test-learning-gateway.mjs | 16 passed, 0 failed |
| Server modules | Five existing assessment/content/tutor/privacy/sorting test files | 45 passed, 0 failed after loopback-enabled rerun |

These tests exercise fixtures and local HTTP services. They do not access the production database or evaluate live model accuracy. The first server run in the restricted execution environment passed 42 tests and failed three because loopback connections returned EACCES. The permitted rerun passed all 45. This environment limitation and resolution are recorded transparently.

Command inventory:

```powershell
npx tsc --noEmit
node scripts/test-learning-room.mjs
node scripts/test-learning-gateway.mjs
node --test server/test/learningAssessment.test.js server/test/learningContent.test.js server/test/learningTutor.test.js server/test/privacy.test.js server/test/wasteQuestionCatalog.test.js
```

Preparation results are registered in `Verification_Results.json`. Current code was not altered to make these tests pass. No remote fixtures, provider calls, production migration, backup restore or physical-device test was performed for this report.

## 2 Historical manual workbook

`docs/testing/KitchMemo_Test_Cases_and_Report.xlsx` identifies its test date as 3 September 2026. Its 99 cases span onboarding, home, inventory/entry, photos, shopping, notifications, sharing, profile/recovery, language and sync. The recorded result is 71 Pass, 2 Fail, 25 Blocked and 1 unexecuted. Its 97.26 percent executed-case pass rate is 71 divided by 73, not 71 divided by all 99 cases and not a current final-release pass rate.

The older workbook excludes later achievements, explicit discard and other subsequent modules in its scope statement. It has no filled tester identity. Do not reuse its date/environment or computed status totals as evidence that build 13 received full UAT.

Recorded failures requiring final-build retest:

- TC-NOT-005: a restock notification remained after a tomato item was archived/deleted. Recheck actual current restock-rule semantics and inactive-batch filtering before classifying the outcome as fixed or still defective.
- TC-I18N-002: filter behaviour after a language change was marked Fail, with no actual result and an ambiguous requirement note. Clarify the expected behaviour and capture a reproducible actual result before claiming defect closure.

The historic workbook is referenced in the full checkout rather than reformatted into invented current results.

## 3 Dated release and database evidence

The October 12 production-migration verification reports 298 development learning HTTP requests, 61 tutor requests using a spy and verified sharing/waste-learning/quest behaviours. The learning release reports owner publication, exact hashes, guard checks and lint. The later App Store record reports the privacy migration, production HTTP consent/withdrawal/deletion checks, 58 aligned migrations and the latest mobile/API baseline.

These records have different scopes and ordering. Earlier counts of 50 tables/56 migrations were a historical pre-publication baseline; the later privacy record reports 54 tables/58 migrations. A module test pass must not be relabelled as a whole-app native result.

The owner's learning publication explicitly waived native physical-device acceptance. Tutor content received owner review, not independent review. Sixty earlier real-model evaluations passed structural checks; they are not a measured factual-accuracy score. Scheduled retention was enabled but natural run history was initially zero. Store screenshots are genuine captures, but they do not close the waived interaction tests.

## 4 Acceptance target and test preparation

Use iOS 1.0.0 build 13 or Android preview 1.0.0 versionCode 3 from the release register. Record the installed artifact ID, source commit, OS/model, locale, time zone, API domain, tester and test date. iOS approval and Android Play distribution remain separate from functionality testing.

Use two disposable installations for sharing and a third when recovery needs a replacement identity. Prefer development/test environments. The registered Android preview points to production; if using it, agree isolated fixture writes and clean only those identities. Use fake household inventory, never another member's real private history. Backup any testing evidence without recording credentials or recovery/invite codes.

## 5 Receiver UAT scenarios

All rows below are planned and require actual execution. See `Receiver_UAT.csv` for editable status, actual result, tester, date and evidence fields.

| ID | Scenario | Acceptance criterion |
| --- | --- | --- |
| UAT-01 | Install, onboard and choose English | Supported device opens an interactive kitchen; first-use behaviour and language are correct |
| UAT-02 | Manual stock with two same-name batches | Separate batches persist with confirmed prices, units, storage and dates |
| UAT-03 | Input limits and missing/invalid data | Client/API reject invalid values without partial stock/event writes |
| UAT-04 | Barcode/photo prefill and denial paths | Suggestions are editable; unsupported input and permission refusal preserve manual use |
| UAT-05 | Quantity/use/discard and date boundary | Correct remaining quantity, event outcome and version; past use-by consumption rejected |
| UAT-06 | Concurrent shared edit | Stale version gives conflict; no silent overwrite or repeated deduction |
| UAT-07 | Cart purchase and checkout | Only successful stock writes produce visible batches; uncertain packaging is confirmed |
| UAT-08 | Invitation, merge, rotate and leave | Intended membership and owned records move; used/revoked codes are refused |
| UAT-09 | Sync foreground/background and reconnect | HTTP snapshots reconcile without private data in Broadcast or duplicate writes |
| UAT-10 | Notification reads, preferences and actual delivery | Reads remain device-specific; categories/quiet hours honoured; native delivery checked |
| UAT-11 | Assistant proposal, confirm/cancel/expiry | No write before confirmation; repeated confirmation is idempotent; conflicts safe |
| UAT-12 | Formal learning, lost responses and resume | First answers remain frozen; correct thresholds; scores/ownership cannot be forged |
| UAT-13 | Private tutor and checkpoint restriction | No other learner history or unsubmitted answer leakage; forbidden coaching rejected |
| UAT-14 | Packaging components and uncertain materials | Eligibility/snapshot/answer uniqueness correct; local guidance and no false XP claims |
| UAT-15 | Achievements, quests and report | Server-authoritative progress; reroll quota; unknown prices correctly represented |
| UAT-16 | Recovery and old credential revocation | Identity/learner recovery works; old access invalid; fresh consent explicitly obtained |
| UAT-17 | AI consent, withdrawal and identity erasure | Denied AI stops before processing; deleted identity cannot return; other original member data retained |
| UAT-18 | Accessibility, text scaling, reduced motion and poor network | Essential controls remain usable; failures explained without unsafe retry or lost context |
| UAT-19 | Historic notification/language failures | Current expected outcomes clarified and reproduced; closure evidence recorded |
| UAT-20 | 3D and progress layout | Stable target-device operation; known mountain text overlap checked and disposition recorded |

## 6 Operational readiness checks

Before operational acceptance, verify recipient platform access, named support/budget/database owners, actual cron history and alerting, private secret transfer, provider limits, backup availability and an isolated restore drill. Record measured restore time rather than promising the proposed objective. Inspect external media/model rights and installed build/API compatibility.

Acceptance criteria should include no unresolved critical authorisation/data-loss defect, explicit disposition of high-risk exceptions, executable support/development instructions and actual receiver task evidence. This is a proposed gate; the sponsor and course mentor must agree the applicable scope.

## 7 Result and decision record

Tester __________ | Date __________ | Build/platform __________ | Environment __________

Executed cases __________ | Passed __________ | Failed __________ | Blocked __________ | Not executed __________

Evidence location __________

Defects and risk exceptions, owners and due dates __________

Selected acceptance scope __________

Reviewer decision __________ | Reviewer name __________ | Signature/confirmation __________

At preparation time this final UAT decision is pending. Use the separate industry/sponsor and Monash forms to record real receipt/acceptance without replacing this evidence.
