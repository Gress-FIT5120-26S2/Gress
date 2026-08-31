# KitchMemo Express API

1. Create a Supabase project, then open **Project Settings → API** and copy its Project URL, Secret key, and Publishable key.
2. Copy `.env.example` to `.env.development`, then replace the placeholder values. `SUPABASE_PUBLISHABLE_KEY` is safe for Realtime connection setup; never substitute the Secret key in that field. `FOOD_RECOGNITION_API_URL` is optional and defaults to the team's deployed model endpoint.
3. From the repository root, run `npm install --prefix server` and `npm run server`.

The Expo application only reads `EXPO_PUBLIC_API_URL` from the repository-root `.env.local`. This value is the Express API address, not a Supabase key. For a physical device, use the computer's LAN IP address, rather than `localhost`.

The Express API exposes `/api/sync/state` as a small authenticated sync-session endpoint. For shared fridges it returns a public Realtime connection key and a random 256-bit capability topic only after device credential verification. Database triggers Broadcast domain-version invalidations without business records, and the client silently reloads only the mounted page that changed. A 30-second version probe and foreground reconciliation cover missed events; if Broadcast configuration is absent or disconnected, shared mode automatically returns to the 6-second probe. This is stateless across Vercel Function instances and does not require Redis.

`GET /api/health` confirms that Express can authenticate to Supabase. `POST /api/photo-recognition` accepts one JPEG, PNG, or WebP image in the multipart field `file`, checks the requesting `Device-ID`, and proxies the image to the recognition service without saving it to disk or Supabase. Keep all calls that use the secret key or private service configuration in this folder.

## Database schema

The versioned Supabase schema lives in `../supabase/migrations`, and global development seed data lives in `../supabase/seed.sql`.

From the repository root:

```powershell
npx supabase db push
npx supabase db push --include-seed
```

The mobile application still reads and writes business data only through Express. It receives only the Supabase publishable key plus its authenticated fridge capability topic for Realtime Broadcast; it never receives a Secret/service-role key or calls the Supabase Data API directly.
