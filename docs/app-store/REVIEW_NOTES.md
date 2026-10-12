# App Review notes — paste the English section into App Store Connect

## Reviewer access

KitchMemo is a household food inventory and food-waste learning app. No email/password account or demo credentials are required. A new installation creates its own anonymous device identity and an empty personal fridge. All functionality is available to the reviewer with internet access; there are no subscriptions, purchases or paid unlocks.

1. Complete the opening guide, open Fridge, then add an item manually. Choose a name, quantity, unit, storage location and purchase price; dates may be omitted. Confirm any barcode/photo suggestions before saving.
2. Open Shopping to add a manual list item. The sharing entry in Fridge can create an invitation; a second installation can join with that code. Shared inventory does not expose private learning or chat history.
3. Open Learn to browse the published courses and complete activities/quizzes. Learning progress is personal; household achievements reflect recorded fridge activity. Packaging-sorting examples follow Australian guidance and are not presented as universal local disposal rules.
4. Before an external AI request, an explicit permission screen lists OpenAI, Google Gemini, Cloudflare Workers AI and the separate food-photo recognition service, with the data each processes. Declining allows manual inventory, shopping and course use. Profile → Privacy includes permission management and withdrawal.
5. Profile → Privacy links to the public privacy policy and support page. “Delete my data” requires a single destructive confirmation, removes this identity and associated records, invalidates credentials/recovery, and returns to a deleted-state screen. A new empty identity is created only if the user chooses “Start again”. Other household members’ original entries remain; items in an erased custom category move to Other.
6. Photo recognition is optional and supports only banana, bitter melon, cucumber, eggplant, orange, papaya, pineapple and tomato. It is a suggestion tool, not a food-safety test. AI and estimated dates cannot override package use-by safety limits.

The production API is https://kitchmemo-api.vercel.app. Privacy: https://kitchmemo-api.vercel.app/privacy. Support: https://kitchmemo-api.vercel.app/support. Contact: Haoxuan Sun, nariyirm@gmail.com.

## Private contact

Contact first name: Haoxuan. Last name: Sun. Review phone is stored only in the ignored local review-contact file and App Store Connect; it is intentionally excluded from this repository and the public support page.

## Before submission

Select production build 13 for the initial iPhone-only release. Build 12 has the privacy/deletion features but still supports iPad; build 11 lacks those privacy features. Upload actual iPhone 16 Pro screenshots (1206×2622). The owner chose to remove iPad support for the first release, and Mac/Vision Pro distribution is disabled. Privacy answers and age rating have been completed. China mainland distribution additionally requires a valid app ICP filing and regional service review; do not submit an invented filing number.
