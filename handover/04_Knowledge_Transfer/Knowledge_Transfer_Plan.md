# KitchMemo Knowledge Transfer Plan

The purpose of this plan is to establish that a sponsor, support team and technical maintainer can use and sustain KitchMemo without relying on undocumented developer knowledge. The sessions below are proposed, with scheduling and participants to be agreed. No session attendance or completion is implied by this plan.

Version 1.0 | 12 October 2026 | Coordinator: receiving owner to nominate

## 1 Preparation and entry conditions

The project team provides this package, the registered source/builds and existing evidence. The receiving organisation nominates a business owner, support lead and technical owner; roles can be combined. Before sessions, verify document access, iOS TestFlight or Android installation access, development API/database access and secret-transfer arrangements. Complete missing URLs and participant contacts in the information register.

Use disposable test identities and development data. If demonstrating the registered preview binary against production, use a new empty installation and explicitly agree any writes; do not demonstrate erasure or recovery on genuine household identities. Never display credentials, recovery codes, invitation codes or private conversations in a recorded session.

## 2 Session schedule and outputs

| Session | Intended recipients | Proposed duration | Required output |
| --- | --- | --- | --- |
| Product and business takeover | Sponsor and product owner | 30 minutes | Scope, resource needs, limitations and ownership decisions |
| User and support walkthrough | Support staff | 60 minutes | Independently completed task checklist and escalation example |
| Architecture and development | Technical maintainers | 90 minutes | Running development environment, scope explanation and passing local checks |
| Release and recovery workshop | Technical owner and operations lead | 60 minutes | Release/rollback decision exercise and backup drill plan |
| Final review and receipt | Industry/sponsor and Monash representatives | 30 minutes | Explicit exceptions and separate signed receipt/acceptance decisions |

Adjust timings to the receivers' experience. Demonstrate first, have the receiver perform the task without step-by-step prompting, then record results and unresolved questions. Reading or watching a recording alone is not evidence that a recipient can deploy or recover the service.

## 3 Product and business agenda

Play the 90-second film, demonstrate stock-to-shopping coordination and personal learning, then explain intended audience and delivery limitations. Distinguish user-recorded metrics from measured environmental results. Review the resources/cost checklist, platform ownership, content-review duties and acceptable risk. Confirm whether the sponsor is adopting a pilot, an operational service or simply receiving the student artefact; these carry different responsibilities.

Decision record: receiving organisation __________; intended use __________; product owner __________; operating budget owner __________; supported users/platforms __________; next review date __________.

## 4 Support exercises

1. Install the registered build, finish onboarding, choose English and set a display name.
2. Add two batches with different dates, find the intended batch and record partial use. Explain why the batches are separate.
3. Attempt a barcode or photo prefill, correct it before saving, and explain the manual fallback and eight-photo-class limitation.
4. Add a cart item, mark it purchased, complete stock review and verify the resulting inventory record.
5. With a second disposable installation, create/join a shared fridge, check updated stock and explain private learning/chat boundaries.
6. Change reminder settings, inspect quiet hours and diagnose a missing push using the support checklist.
7. Complete a practice activity and explain why it does not unlock a formal checkpoint or award household XP.
8. Review an assistant action before confirming or cancelling it. Explain expiry and conflict handling.
9. Generate and use a recovery code in the agreed test environment. Show that the old code/credential becomes invalid, then retain the replacement privately.
10. Deny external AI, verify manual functionality and use privacy controls. Explain identity deletion before demonstrating it on an agreed disposable identity.

Support completion criteria: correct task outcomes, no exposure of secrets, correct explanation of irreversible actions and a useful redacted incident report. Any failed exercise is assigned an owner and rechecked before completion is recorded.

## 5 Technical exercises

1. Retrieve the baseline and install both lockfile dependency sets with a compatible Node runtime.
2. Configure development server/client values without placing private credentials in client variables or Git.
3. Start using the correct named-development or published-only path. Verify health and one manual read/write flow.
4. Run the local TypeScript and 75 automated tests, retaining result logs.
5. Explain device/fridge versus learner/chat ownership using the diagrams. Identify the middleware and RPC that enforce a sample write.
6. Review a proposed schema change, prepare an additive migration plan and explain development-first application, hash consistency and production dry-run.
7. Explain the selected native/API baselines, build-profile environment resolution, compatibility and separate Apple review state.
8. Diagnose a simulated provider failure or shared-version conflict without bypassing consent or repeating a deduction.
9. Identify scheduled-job history, queue retry behaviour and push ticket/receipt limits.
10. Plan an isolated restore drill covering database plus Storage, side-effect isolation and erased-identity behaviour.

Technical completion criteria: recipient runs the system with minimal help, locates authoritative contracts, selects a compatible rollback and correctly identifies what has not yet been tested. An actual restore drill remains separate work unless performed and evidenced.

## 6 Recording and follow-up

For each session record date/time zone, participants/roles, facilitator, build/commit, environment, exercised tasks, evidence location, open questions and assigned follow-up. Obtain participants' agreement before recording. Store redacted recordings and notes in the PG portfolio with appropriate recipient access and retention.

No post-handover support period is assumed. Agree a contact channel, availability, response expectations and an end date if the team will provide temporary support. If no ongoing team commitment exists, record that fact and assign the receiving owner instead.

## 7 Completion record

Session __________ | Date __________ | Environment __________ | Build/commit __________

Participants and roles __________

Completed exercises and evidence __________

Unresolved tasks, owners and due dates __________

Receiving participant confirmation __________ | Facilitator confirmation __________

## 8 Exit and sign off

Handover can be recorded when recipients have the documents/assets and authorised access, required exercises have evidence, operational ownership is assigned and unresolved issues are explicitly selected for acceptance or deferral. Use the industry/sponsor form and the separate Monash form. Do not write another person's signature or infer acceptance from attendance or a screenshot.
