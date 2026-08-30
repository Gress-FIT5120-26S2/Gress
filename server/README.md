# KitchMemo Express API

1. Create a Supabase project, then open **Project Settings → API** and copy its Project URL and Secret key.
2. Copy `.env.example` to `.env.development`, then replace the placeholder values. `FOOD_RECOGNITION_API_URL` is optional and defaults to the team's deployed model endpoint.
3. From the repository root, run `npm install --prefix server` and `npm run server`.

The Expo application only reads `EXPO_PUBLIC_API_URL` from the repository-root `.env.local`. This value is the Express API address, not a Supabase key. For a physical device, use the computer's LAN IP address, rather than `localhost`.

`GET /api/health` confirms that Express can authenticate to Supabase. `POST /api/photo-recognition` accepts one JPEG, PNG, or WebP image in the multipart field `file`, checks the requesting `Device-ID`, and proxies the image to the recognition service without saving it to disk or Supabase. Keep all calls that use the secret key or private service configuration in this folder.

## Database schema

The versioned Supabase schema lives in `../supabase/migrations`, and global development seed data lives in `../supabase/seed.sql`.

From the repository root:

```powershell
npx supabase db push
npx supabase db push --include-seed
```

The mobile application still communicates only with Express; it never receives a Supabase key or calls the Data API directly.
