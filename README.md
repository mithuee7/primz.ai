# Primz site

Static marketing site (home, real estate, creators, local business, privacy policy) plus a small backend that saves custom request form submissions to Supabase, and a password protected admin panel at `/admin`.

## 1. Set up Supabase

1. Create a project at supabase.com (free tier is enough).
2. Go to the SQL editor and run:

```sql
create table custom_requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text,
  contact text,
  needs text,
  segment text
);

alter table custom_requests enable row level security;
```

Do not add any public/anon policies to this table. The server talks to Supabase using the service role key, which bypasses Row Level Security, so leaving it policy-less keeps the table completely unreachable from anyone using the public anon key (i.e. from a browser).

3. In Project Settings → API, copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role key** (not the anon key) → this is `SUPABASE_SERVICE_KEY`

The service role key is powerful and bypasses all security rules. Never put it in any HTML/JS file that reaches the browser. It only belongs in Render's environment variables, which is exactly how this project uses it.

## 2. Deploy on Render

1. Push this folder to a GitHub repo (or connect it directly if Render supports your setup).
2. On Render, create a new **Web Service** from that repo.
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add these Environment Variables in Render's dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `ADMIN_PASSWORD` — the password you'll use to log into `/admin`
   - `SESSION_SECRET` — any long random string (used to sign the admin login cookie)
6. Deploy. Render will give you a live URL.

## 3. Using the admin panel

- Go to `yourdomain.com/admin`
- You'll be redirected to a login page asking for the password you set as `ADMIN_PASSWORD`
- Once logged in, you'll see every custom request submitted through the site, newest first
- `/admin` is not linked anywhere on the public site, so the only way to reach it is by typing the URL directly, and it still requires the password even then

## 4. Local testing (optional)

```bash
npm install
cp .env.example .env
# fill in .env with your real Supabase details and a password
node server.js
```

Then visit `http://localhost:3000`.

## Notes

- The privacy policy at `/privacy.html` is a starting point, not a legal document. Have it reviewed if you want it to actually hold up.
- If you ever want to change the admin password, just update `ADMIN_PASSWORD` in Render's environment variables and redeploy, no code changes needed.
