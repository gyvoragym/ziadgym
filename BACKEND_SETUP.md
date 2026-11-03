# GYVORA backend setup

## Local development (Windows / Node.js 20+)

1. From the repository root, run `npm install`.
2. Install the API dependencies with `npm --prefix server install`.
3. Run `npm run dev`. This starts the frontend and Express API; Vite proxies `/api` to `http://localhost:4000`.
4. The API health check is `http://localhost:4000/api/health`.

The local launcher creates a random session secret for the API process. To run the API separately, copy `server/.env.example` to `server/.env`, set a private `SESSION_SECRET` of at least 32 characters, and run `npm run api:dev`.

The hidden administrator login is verified by the TanStack server. Set `GYVORA_ADMIN_EMAIL`, `GYVORA_ADMIN_PHONE`, and `GYVORA_ADMIN_PASSWORD` in the ignored root `.env` file; `GYVORA_ADMIN_NAME` is optional. The development launcher loads that file for the verifier and local API. The short-lived administrator session is signed with `GYVORA_ADMIN_SESSION_SECRET` or, if absent, the configured administrator password; no static admin token is sent to the browser.

The API uses `sql.js` (SQLite compiled to WebAssembly), avoiding a native `better-sqlite3` build. Local data is stored in `server/data/gyvora.sqlite`; this path is ignored by Git and is not included in deployments.

## Production API deployment (Render)

The repository includes a Render Blueprint in `render.yaml`. It deploys only the Express API from `server/`, builds with the backend lockfile, exposes `/api/health`, and mounts a 1 GB persistent disk at `/var/data`. The Blueprint uses Render's paid `starter` plan because free web services do not provide persistent disks. Review the current price in Render before creating the service.

1. Push this repository to GitHub and open **Render Dashboard → New → Blueprint**.
2. Connect `youseffebraheem351-alt/my-gym-acount` and select the `render.yaml` Blueprint.
3. Set `FRONTEND_ORIGIN` to the exact deployed Vercel origin, without a trailing slash (for example `https://your-project.vercel.app`). For multiple origins, use a comma-separated allowlist; do not use `*`.
4. Create the service and wait for `/api/health` to pass. Render generates `SESSION_SECRET`; the service stores SQLite at `/var/data/gyvora.sqlite`. Do not replace `DATABASE_PATH` with an ephemeral path.
5. **Do not set `VITE_GYVORA_API_URL` in Vercel Production.** The Express API does not provide the Supabase identity, gym data, roles, or permissions required by the production application. Production registration and login use Supabase Auth; the Express API is not used to create or authenticate production app accounts.
6. If the deployed platform administrator uses the SQLite account-list API, configure the same strong `GYVORA_ADMIN_SESSION_SECRET` in the Vercel server environment and Render API environment. Keep it server-only. Configure the admin identity/password only as server environment variables.

Production cookies are `HttpOnly`, `Secure`, and `SameSite=None` when the frontend and API use different sites. CORS allows only `FRONTEND_ORIGIN` and credentials. Some browsers block cross-site cookies regardless of `SameSite=None`; for those browsers, use a same-site custom domain/reverse proxy for the API and set `COOKIE_SAME_SITE=lax`.

### Existing SQLite accounts

The local database is not pushed to GitHub and is never copied by the Blueprint. The first Render deployment creates a new database on its persistent disk. Existing local registrations remain in the local `server/data/gyvora.sqlite` file, but will not appear online until explicitly migrated. Before any migration, stop the API, make and verify a backup of both the local database and the destination database, and transfer the file to `/var/data/gyvora.sqlite` before starting the service. Do not overwrite a production database or upload personal data without confirming the destination and backup.

The SQLite adapter writes database snapshots atomically after each mutation. This single-process file database is intended for a small deployment; use a managed database and a reviewed migration plan before scaling to multiple API instances.

## Authentication and data boundaries

The Express API endpoints are:

- `POST /api/auth/register` — creates an API account; passwords of 4–128 characters are accepted.
- `POST /api/auth/login` — verifies phone/email and password and issues an HttpOnly session cookie.
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users/me`
- `GET /api/users/qr/:qrId` — requires an API session.
- `GET /api/admin/users` — returns safe account fields to a valid server-signed administrator session.

In local development and prototype previews, registration/login may use this API through Vite's `/api` proxy or an explicitly configured preview API. In published production, registration and login use Supabase Auth regardless of `VITE_GYVORA_API_URL`; production accounts are never written to SQLite. New production accounts require an Egyptian mobile number, a Gmail address, and a password. Gmail is the Supabase Auth identity; the normalized phone is stored on the matching `profiles` row. Phone/password login resolves that profile server-side and then verifies the password through Supabase Auth. This does not verify ownership of the phone number and does not use Supabase Phone OTP.

The migration `supabase/migrations/20261031015000_auth_profile_phone_metadata.sql` creates/synchronizes the profile for a new Auth user. It is an additional trigger beside the older `create_profile_on_signup` trigger referenced by `drizzle/migrations/0002_restore_profile_creation_trigger.sql`; before applying it, inspect the actual production definition of `public.create_ironhaus_profile()` and test both triggers together. That function is not defined in this repository, so the migration is not cleared for production until its effects and ordering are verified. The new trigger preserves profile account types outside `owner`/`client` metadata.

`20261031020000_unique_profile_phones.sql` rejects existing normalized-phone duplicates before creating a unique index. It also adds a server-only phone-to-profile lookup so older phone formats can be resolved without scanning/exposing profiles. If duplicate detection stops, review records manually; do not delete or merge them automatically. `20261031025000_phone_login_rate_limit.sql` adds a shared database-backed limit (8 attempts per phone and 30 per IP per 15 minutes) used by the phone-login server function. The rate-limit IP identity depends on the trusted hosting proxy's `x-real-ip`/`x-forwarded-for` headers; confirm the Vercel proxy behavior before relying on the per-IP limit. The per-phone limit is still enforced independently.

All three migrations add database objects and do not delete or backfill existing account data. Their rollback is not fully lossless after use: removing the profile trigger will not undo profile changes from future signups; removing the phone index/functions removes duplicate enforcement; dropping the rate-limit table discards only attempt counters. Before applying, back up Supabase and inspect the production trigger/function definition, existing phone formats, and duplicate report. Production migrations remain a separate, deliberate operation.

### Supabase registration settings

In **Supabase Dashboard → Authentication → Providers → Email**, enable email/password sign-in and set the minimum password length to at least 8. Email confirmation may remain enabled; users then need to follow the Gmail confirmation link before their first login. This is email-link confirmation, not an OTP or SMS step. For production delivery, configure a trusted SMTP provider under **Authentication → SMTP Settings**. Set **Authentication → URL Configuration → Site URL** to the production Vercel origin and add that origin to **Redirect URLs** (including any preview origins you intentionally support). SMS/Phone Auth is not required for this phone-as-login implementation.

**The Express SQLite API is not a complete replacement for Supabase.** `CloudProvider`, gym roles, memberships, invitations, workout data, and most application data still use Supabase/RPC or isolated prototype storage. An Express login alone does not create a Supabase Auth session/profile or grant Cloud access. Therefore, deploying this API makes its own registration/login/session endpoints available, but does not by itself migrate SQLite users into Supabase or make every authenticated app feature work. Do not claim full production account access until the intended identity store and Cloud data integration are tested end to end.

The Supabase migration in `supabase/migrations` allocates stable GYVORA IDs. Other Supabase schema and Cloud configuration are managed separately and are not provisioned by this API Blueprint.

## Environment variables

### Render API

- `PORT`: assigned by Render; the server listens on it.
- `DATABASE_PATH`: persistent disk path; Blueprint sets `/var/data/gyvora.sqlite`.
- `SESSION_SECRET`: required, random, at least 32 characters; Blueprint generates it.
- `FRONTEND_ORIGIN`: exact frontend origin(s), comma-separated if needed.
- `COOKIE_SAME_SITE`: `none` for cross-site HTTPS frontend/API; `lax` for same-site deployment.
- `GYVORA_ADMIN_SESSION_SECRET`: optional server-only signing secret shared with the TanStack server if using API admin endpoints.

### Vercel frontend/server

- `VITE_GYVORA_API_URL`: optional API origin for local/prototype use only. Do not configure this in Vercel Production until all application data and permissions have been migrated and verified.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: required by the existing Supabase-backed app.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`: server-side Supabase configuration used by existing TanStack server functions; never expose the service-role key to the browser.
- `GYVORA_ADMIN_EMAIL`, `GYVORA_ADMIN_PHONE`, `GYVORA_ADMIN_PASSWORD`, and optionally `GYVORA_ADMIN_NAME`: server-only admin login configuration.
- `GYVORA_ADMIN_SESSION_SECRET`: optional strong secret; if configured, use the same value on Render for SQLite admin API calls.

Do not put secrets in `VITE_*` variables, source files, or Git.

The Vercel server environment must include `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for phone/password login and other trusted server functions. The publishable key is not a secret; the service-role key is server-only. Configure these for Production (and Preview/Development separately if those environments should use Supabase). The production Supabase project's REST API must expose the public schema as it already does for the app; the added lookup/rate-limit RPCs explicitly grant execution only to `service_role`.

## Verification

Run `npm --prefix server test` to compile the API and exercise health, CORS, registration, login, secure-cookie attributes, session survival across restart, and logout against a disposable test database. The frontend registration validation is covered by `npm test -- --run src/test/signup-verifier.test.ts`. These local tests do not verify Vercel, Supabase credentials, email delivery, actual Auth/profile trigger behavior, or production data migration.
