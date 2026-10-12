# App privacy questionnaire preparation

Owner: Haoxuan Sun. Prepared from source on 2026-10-12; these are recommended answers to review against the current App Store Connect form, not a claim that Apple has accepted them.

Privacy URL: https://kitchmemo-api.vercel.app/privacy. Chinese URL: https://kitchmemo-api.vercel.app/privacy?lang=zh.

Data is collected. Purpose: App Functionality; security/operational data may additionally use Apple's Other Purposes classification if requested by the form. Tracking: No. Data used for third-party advertising: No. Data is linked to the user's persistent pseudonymous device identity; anonymous guest usage is not a reason to claim “not linked”.

| Apple data category | Actual data | Linked | Purpose |
| --- | --- | --- | --- |
| Contact Info → Name | Optional nickname; users may enter a real name | Yes | App Functionality |
| Identifiers → Device ID | Installation ID, push token, legacy Android identity | Yes | App Functionality |
| User Content → Photos or Videos | Selected food photo forwarded to the recognition service; provider retention must be confirmed before claiming the real-time-processing exemption | Conservatively Yes | App Functionality |
| User Content → Other User Content | Food/product/category names, quantities, dates, notes, shopping entries, AI messages and feedback, quiz answers | Yes | App Functionality |
| Purchases → Purchase History | User-entered food purchase prices and stocking records; these are household purchases, not in-app payments | Yes | App Functionality |
| Usage Data → Product Interaction | Lesson/activity/quiz progress, outcomes, achievements and notification read state | Yes | App Functionality |
| Diagnostics → Other Diagnostic Data | Hosting request/security metadata such as IP, timestamps and errors; confirm Vercel/Supabase settings and include applicable diagnostics rather than claiming no logs | Conservatively Yes where attributable | App Functionality / Other Purposes |

The app does not intentionally collect payment card details, address book, email for registration, phone number for registration, precise/coarse GPS location, microphone audio, biometric or health/fitness data. A timezone setting alone is not GPS collection. Optional support emails exist outside the normal in-app registration flow; keep the published privacy policy truthful about support correspondence. No advertising ID, ATT tracking flow or analytics SDK was found in the current app dependency/configuration audit.

Third parties are covered by the same questionnaire: Supabase, Vercel, Expo push, OpenAI, Gemini, Cloudflare Workers AI, food-photo recognition service and Open Food Facts. The absence of long-term storage in our own photo proxy does not establish a third party's retention practices. Review conservative Photos/Diagnostics answers with those providers before reducing disclosure.

App Privacy labels and binary privacy manifests are separate requirements. EAS uses the installed Expo/native module manifests; inspect the final iOS build for missing SDK manifests/reason declarations if Apple reports them. Do not invent a custom Required Reason API declaration without an actual corresponding API use.

Primary sources: [Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/), [manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).
