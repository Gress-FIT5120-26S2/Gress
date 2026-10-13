# KitchMemo Ethics Canvas and ACS Mapping

This canvas examines the ethical implications of the delivered product and the duties a future owner inherits. It is a project-specific working artefact derived from the current implementation and records. It must be reconciled with Moodle's prescribed Ethics Canvas format and placed in the PG portfolio; no prior ethics approval or certification is inferred.

Version 1.0 | 12 October 2026 | Prepared for team and sponsor review

## 1 Purpose and intended benefit

KitchMemo aims to make food inventory, shopping and waste-learning tasks easier for young households. It connects visibility, reminders and education rather than independently monitoring food quality or disposal. Intended benefits include fewer forgotten items and more informed purchases; field evidence of actual waste reduction, savings and educational effect remains to be collected.

## 2 People and organisations affected

Direct users include young adults, partners and invited household members. Other affected groups include people who need accessible interfaces or have limited devices/connectivity, the sponsor and support staff, educational-content reviewers, infrastructure/AI providers, original data/media creators and local communities whose disposal systems differ.

A household may have unequal control over shared records. Invite access, departure and identity deletion can affect the list other members see. Users must understand what becomes shared and what stays private; a nickname is not proof of identity ownership.

## 3 Data and processing

The service uses an anonymous installation ID with a random credential, household inventory/cart/event records, device profile/preferences, notification tokens, private conversations and personal learning records. Anonymous installation identity does not make all associated behaviour non-sensitive.

External-AI permission defaults to denied. Covered requests can send relevant prompts, selected fridge context, public learning evidence, one authorised feedback item, food names/packaging or a food photo to the corresponding provider. Keys stay server-side. Photo uploads are proxied in memory and not stored by the application; provider handling remains an operational review responsibility.

Deletion removes the current identity's associated data under the implemented creator/owner scope, revokes access and schedules remaining icon cleanup. Shared members' original entries remain. Historical identity recoveries before link tracking cannot be reconstructed solely from names. Backup/provider retention is not promised to be instantaneously erased.

## 4 Positive and negative consequences

| Area | Possible benefit | Possible harm or limitation |
| --- | --- | --- |
| Food planning | More visible stock and fewer unnecessary purchases | Inaccurate user entries or dates can mislead decisions |
| Optional AI | Faster prefill and contextual explanation | Wrong recognition, hallucination, unintended disclosure or provider dependence |
| Shared households | Coordinated stock and shopping | Unintended access, confusing ownership or loss of records during deletion |
| Education and rewards | Practice and motivation | Incorrect regional guidance, assessment leakage or exaggerated impact claims |
| 3D experience | Understandable, engaging task entry | Motion/contrast/performance barriers on some devices |
| Digital service | Convenient access and continuity | Cloud cost, outage, backup failure or loss of recovery material |

## 5 Implemented safeguards and remaining duties

AI suggestions are editable and require user confirmation before stock creation. Supported assistant changes require a separate explicit confirmation and transaction-time checks. A hard use-by date cannot be overridden by suggested use. Declining external processing leaves manual tasks and static learning available.

Server authentication resolves trusted device/fridge/learner scope. RLS and role restrictions protect ordinary database access; privileged API checks still matter. Private chat/learning do not become visible to household members. Rate limits are shared across API instances, and content/source/action projections reject unsafe disclosure paths.

Formal grading and first answers are server-controlled. Tutor evidence is bounded and checkpoint restrictions prevent arbitrary coaching during a formal assessment. Published tutor v3 has a recorded owner-specific exception; independent review remains pending. A structured-output pass does not prove factual correctness.

Bilingual app copy, reduced-motion support and alternative navigation reflect inclusion goals. A full accessibility audit remains outstanding, and the progress screenshot preserves known text overlap. Broader device testing and poor-network usability require actual acceptance evidence.

The receiver must verify account ownership, media/model/data licences, current processor arrangements, retention policy, restore readiness and complaints/support handling. These are ongoing duties, not inferred compliance certifications.

## 6 Dilemmas and agreed decision boundaries

- Encouragement versus safety: rewards must not motivate using food beyond a recorded use-by limit or counting corrections as waste avoided.
- Convenience versus consent: decline/withdrawal must preserve manual use; external processing cannot be silently enabled after recovery.
- Sharing versus privacy: share stock intentionally while keeping learner/chat scope personal; explain deletion before it affects shared displays.
- Fast publication versus independent review: retain the real owner exception and pending review, then commission an independent review rather than relabelling it.
- Impact storytelling versus evidence: distinguish creative product-film scenes and educational quiz results from measured physical outcomes.

Review these boundaries when adding account login, voice processing, additional image classes, regional content or new analytics. New capabilities can require different data disclosures and acceptance evidence.

## 7 ACS Code of Professional Conduct mapping

The six categories below follow the Code of Professional Conduct v2.1, April 2014, linked by the official ACS website. They organise project evidence rather than reproduce the code's requirements or certify member compliance. Confirm the edition required by the course. [Official conduct PDF](https://www.acs.org.au/content/dam/acs/ACSimages/ethicsdiscipline/Code-of-Professional-Conduct_v2.1.pdf)

| ACS category | KitchMemo evidence | Follow-up responsibility |
| --- | --- | --- |
| Public interest | Food-date safety boundary, bounded AI, private learner/chat access | Review unsafe guidance and local disposal applicability |
| Quality of life | Household task coordination, manual alternatives and calm reminders | Test accessibility, device performance and practical user benefit |
| Honesty | Recognition scope disclosed; owner exception, waived device tests and store-review state recorded | Report actual test evidence and avoid unsupported savings/accuracy claims |
| Competence | Versioned migrations, transactional outcomes, input/permission checks and automated tests | Complete native acceptance, restore drill and expert review where needed |
| Professional development | Setup guide, source inventory and receiver practice exercises | Keep SDK/data documentation current and train the receiving staff |
| Professionalism | Traceable sources, licences and separate receipt/acceptance records | Resolve ownership, attribution, support roles and signed decisions |

The current ACS ethics page separately presents honesty, trustworthiness and respect. For this project these support truthful capability statements, accountable operation and user agency/privacy. Keep this newer ethics reference distinct from the six-category conduct mapping. [ACS ethics and conduct](https://www.acs.org.au/memberships/professional-ethics-conduct-and-complaints.html)

## 8 Standards and verification scope

FSANZ date-marking guidance informs the distinction between use-by and best-before; estimated dates remain product estimates. WCAG 2.2 is a reference for accessibility review, not a claim that every native screen conforms. Provider backup/deployment documentation informs operations, but neither a listed reference nor a published privacy page establishes complete regulatory compliance.

- FSANZ: https://www.foodstandards.gov.au/consumer/labelling/dates
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- ACS conduct and ethics: references above

Before sponsor operation, determine applicable privacy/consumer obligations and regions with appropriate qualified review, using actual data flows and contracts. The initial recorded store target is Australia; expanded distribution is a separate decision.

## 9 Ethical review and PG record

Reviewer name and role __________ | Date __________

Moodle canvas/version used __________ | PG artefact URL __________

Confirmed safeguards and evidence __________

Residual risks accepted, owners and due dates __________

Decision __________ | Signature/confirmation __________

The accompanying risk register includes independent review, untested native flows, restore readiness, ownership/licensing and evidence limitations. Update this canvas when any affected contract changes.
