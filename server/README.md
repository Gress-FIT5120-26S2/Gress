# KitchMemo Express API

Production deployment is planned for Vercel. Keep the deployment checklist, server-only credential inventory, migration order, smoke tests, and rotation procedure in [`../docs/deployment/VERCEL_PRODUCTION_DEPLOYMENT.md`](../docs/deployment/VERCEL_PRODUCTION_DEPLOYMENT.md).

1. Create a Supabase project, then open **Project Settings → API** and copy its Project URL, Secret key, and Publishable key.
2. Copy `.env.example` to `.env.development`, then replace the placeholder values. `SUPABASE_PUBLISHABLE_KEY` is safe for Realtime connection setup; never substitute the Secret key in that field. `FOOD_RECOGNITION_API_URL` is optional and defaults to the team's deployed model endpoint. AI preset fallback additionally requires a Gemini API key plus a Cloudflare account ID and Workers AI token; all three remain server-only.
3. From the repository root, run `npm install --prefix server` and `npm run server`.

The Expo application only reads `EXPO_PUBLIC_API_URL` from the repository-root `.env.local`. This value is the Express API address, not a Supabase key. For a physical device, use the computer's LAN IP address, rather than `localhost`.

The Express API exposes `/api/sync/state` as a small authenticated sync-session endpoint. For shared fridges it returns a public Realtime connection key and a random 256-bit capability topic only after device credential verification. Database triggers Broadcast domain-version invalidations without business records, and the client silently reloads only the mounted page that changed. A 30-second version probe and foreground reconciliation cover missed events; if Broadcast configuration is absent or disconnected, shared mode automatically returns to the 6-second probe. This is stateless across Vercel Function instances and does not require Redis.

`GET /api/health` confirms that Express can authenticate to Supabase. All `/api` requests use a database-backed fixed-window limit shared by Vercel instances; recovery, invite joining, photo recognition, and AI generation have tighter limits and return `429` with `Retry-After`. Browser origins are denied unless listed exactly in the comma-separated `CORS_ALLOWED_ORIGINS`; native app requests without an `Origin` header remain allowed. `POST /api/photo-recognition` accepts one JPEG, PNG, or WebP image in the multipart field `file`, checks the requesting `Device-ID`, and proxies the image to the recognition service without saving it to disk or Supabase. Keep all calls that use the secret key or private service configuration in this folder.

`GET /api/food-presets/suggestion` reuses an enabled preset by canonical name or exact alias. On a miss, the App can explicitly call `POST /api/food-presets/generate`: Gemini returns validated structured guidance, Cloudflare FLUX creates one icon, Sharp normalises it to a transparent 256×256 PNG, and Express caches both in Supabase. The endpoint has a database-backed limit of five new-food generations per device per hour, shared across production instances.

After configuring the Cloudflare credentials, generate the same normalised image style for existing seed/open-data presets that currently use Emoji fallback:

```powershell
npm --prefix server run backfill:preset-icons
```

The script processes only enabled presets whose `icon_path` is still null, saves each result immediately, and can be safely rerun after an interrupted free-tier batch.

## Database schema

The versioned Supabase schema lives in `../supabase/migrations`, and global development seed data lives in `../supabase/seed.sql`.

From the repository root:

```powershell
npx supabase db push
npx supabase db push --include-seed
```

The mobile application still reads and writes business data only through Express. It receives only the Supabase publishable key plus its authenticated fridge capability topic for Realtime Broadcast; it never receives a Secret/service-role key or calls the Supabase Data API directly.
