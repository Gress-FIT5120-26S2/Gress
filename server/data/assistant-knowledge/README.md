# Spoonie knowledge ingestion

`au-core-v1.json` contains reviewed, paraphrased bilingual knowledge derived from authoritative FSANZ pages. It contains no recipe content, user inventory, conversation text, credentials, or copied full articles.

Run validation without network or database writes:

```powershell
cd server
npm run ingest:assistant-knowledge -- --dry-run
```

To ingest into the currently selected server environment, place `OPENAI_API_KEY` in the private `.env.development` file and run:

```powershell
cd server
npm run ingest:assistant-knowledge
```

The script always uses `text-embedding-3-small` with 1536 dimensions. It disables a document while replacing its chunks and enables the parent source only after every bilingual document succeeds. Do not point `NODE_ENV=production` at this command until development retrieval evaluation passes.

If OpenAI returns HTTP 429 on the first request, check the API project's billing balance and project limits. A ChatGPT or Codex subscription is not used as this server's API quota. The ingestion script generates all embeddings before beginning database writes, so a quota failure cannot expose partial knowledge documents.

For each source update:

1. Re-open the original authority page and review it manually.
2. Update `reviewedAt`, the language-specific immutable version strings, and the paraphrased chunks.
3. Keep safety claims in `safety_sensitive` chunks and retain an exact HTTPS source URL.
4. Run the dry-run, ingest into development, and run bilingual retrieval regression tests.
5. Promote the identical manifest and migration history to production only after review.
