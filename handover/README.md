# KitchMemo Handover Package

Prepared for potential sponsors, operational support staff, technical maintainers and Monash mentors. All package documents are in English. Read this index first, then the document relevant to your role.

Package version: 1.0. Prepared: 12 October 2026, Australia/Sydney. Product version: 1.0.0. Source baseline: `a37304cd7746f61872673cc9d8d05e8f7536badf`. This package documents the inspected checkout and dated release evidence; it does not constitute sponsor acceptance or a new production deployment.

## Main documents

| Audience | Document | Purpose |
| --- | --- | --- |
| Potential sponsor | [Product Document](01_Product/Product_Document.md) | Value, scope, resources, ethics, sponsor opportunities and product access |
| Users and support staff | [Support Document](02_Support/Support_Document.md) | Installation, feature instructions, routine operation, privacy, recovery and troubleshooting |
| Technical maintainers | [Maintenance Document](03_Maintenance/Maintenance_Document.md) | Architecture, developer setup, data contracts, deployment, tests and operational procedures |
| All receiving roles | [Knowledge Transfer Plan](04_Knowledge_Transfer/Knowledge_Transfer_Plan.md) | Training agenda, practical exercises and competence evidence |
| Industry mentor or future sponsor | [Industry and Sponsor Sign Off](05_Sign_Off/Industry_and_Sponsor_Sign_Off.md) | Document receipt and an explicit, separately selected acceptance decision |
| Monash mentor | [Monash Sign Off](05_Sign_Off/Monash_Receipt_and_Acceptance.md) | Separate Monash receipt and acceptance facility |
| Ethics reviewer | [Ethics Canvas](06_Appendices/Ethics_Canvas_and_ACS_Mapping.md) | Project-specific benefits, risks, safeguards, residual issues and ACS mapping |
| Acceptance reviewer | [Testing and Acceptance Report](06_Appendices/Testing_and_Acceptance_Report.md) | Current local checks, historical release evidence and receiver UAT |

Editable Word copies of these eight documents are supplied alongside their Markdown sources. The Product Document is kept within the guideline's approximate one-to-five-page limit. Longer support and maintenance documents include contents and references.

## Registers and attachments

- [Handover checklist](00_Control/Handover_Checklist.csv)
- [Guideline coverage matrix](00_Control/Guideline_Coverage.csv)
- [Information still required](00_Control/Information_Required.csv)
- [Release and delivery register](00_Control/Release_and_Delivery_Register.md)
- [Access and ownership register](06_Appendices/Access_and_Ownership_Register.csv)
- [Risk and future backlog](06_Appendices/Risk_and_Future_Backlog.csv)
- [Feature coverage matrix](06_Appendices/Feature_Coverage.csv)
- [Agile and PG index](06_Appendices/Agile_and_PG_Index.md)
- [Technical reference inventory](03_Maintenance/Technical_Reference_Inventory.md)
- [API request examples](03_Maintenance/API_Request_Examples.md)
- [Operational cost planning](06_Appendices/Operating_Cost_and_Responsibility_Plan.md)
- [Source and evidence register](06_Appendices/Source_and_Evidence_Register.md)
- [Package manifest](00_Control/Package_Manifest.json), with SHA-256 checksums of deliverables
- English application screenshots and diagrams in `07_Assets/`
- The English-captioned 90-second product film in `08_Product_Video/`

## How to review and hand over

1. Review the release register. Use iOS build 13 or the registered Android preview package. Older builds have different capabilities.
2. Read the Product Document, play the film and assess whether your organisation has the people and budget to own the service.
3. Follow the Support Document using a disposable test installation. Do not use a household's real data for acceptance exercises.
4. Have the receiving developer follow the Maintenance Document against a development or test project. Complete the knowledge-transfer exercises and UAT record.
5. Resolve or explicitly accept the checklist exceptions. Record the final repository commit, package hash, installation access and remaining responsibilities.
6. Use separate industry/sponsor and Monash sign-off records. Receipt is not automatically functional acceptance. Leave signatures empty until the actual receiving people sign.
7. Place the package and PG portfolio on the agreed transfer medium, enter its Google Drive URL, verify recipient permissions and retain an immutable accepted copy.

## Evidence and completion status

The course guideline was supplied as five screenshots. Its three main documents, knowledge-transfer requirement, meaningful PG folder convention and separate Monash sign-off are covered. The Moodle pre-reading, earlier submitted task list and official sign-off template were not supplied. The included forms are project-adapted working forms, not representations of the official Moodle template. Reconcile these materials before final submission.

Team names and public contacts come from local project sources. Missing personal email addresses, LinkedIn URLs, final board links and the PG Google Drive URL are recorded centrally rather than invented. Proposed responsibilities and operating targets require the receiving organisation's agreement.

Repository records say the iOS application was waiting for Apple review on 12 October 2026; store approval is not claimed. The latest learning release records physical-device acceptance as waived by the owner. Application screenshots are genuine captures but do not prove a complete end-to-end acceptance pass. Independent tutor review remains pending despite the documented owner-specific publication exception.

## Document maintenance

Update the Markdown sources when behaviour changes, regenerate the Word copies and refresh the manifest. Recheck screenshots against the intended release. References beginning with repository paths require the full checkout; obtain it from the source repository registered in the release register. The package contains neither production credentials nor a production database dump.
