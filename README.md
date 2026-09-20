# Abencivo Biotech — Backend

Express + SQLite API for the Abencivo Biotech website: products, enquiries
(auto-routed to the right team member by department), admin auth, file
uploads, and an audit log.

This is the **backend only**. The React frontend lives in a separate
project (`abencivo-frontend`) and talks to this API over HTTP.

## Local setup

```
npm install
cp .env.example .env      # then fill in real values, see below
npm run seed               # creates 3 demo products
npm start                  # http://localhost:4000
```

## Required environment variables

| Variable | What it's for |
|---|---|
| `JWT_SECRET` | Long random string used to sign admin login tokens. Generate one with `openssl rand -hex 32`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Creates the one admin account on first run. **If either is missing, no admin account is created at all** — this is intentional (see Security below). |
| `CORS_ORIGIN` | The frontend's live URL (e.g. `https://abencivo.com`). Comma-separate multiple origins if needed. Requests from anywhere else are blocked by the browser. |
| `SMTP_*`, `MAIL_TO`, `MAIL_FROM` | Optional — enables emailing enquiries to the right manager. Without these, enquiries still save to the database, just without email notifications. |
| `FRANCHISE_MANAGER_EMAIL` etc. | Who gets notified for each enquiry type. See `.env.example` for the full list. |

## Deploying

This needs a host that runs a persistent Node process (not a static
site host) — Render and Railway both work well.

1. Push this folder to its own GitHub repo (or a subfolder of a monorepo).
2. Create a **Web Service**, connect the repo.
3. Build Command: `npm install`
4. Start Command: `npm run start:prod`
5. Set all the environment variables above in the host's dashboard.
6. **Attach a persistent disk/volume mounted so `data/` and `uploads/`
   survive redeploys.** Without one, most hosts wipe the filesystem on
   every deploy — meaning your database and uploaded images vanish every
   time you push an update. This is the single most common surprise with
   this kind of setup, so don't skip it.
7. Once deployed, set `CORS_ORIGIN` to your frontend's actual live URL,
   and give the frontend project's `VITE_API_BASE` your backend's live URL
   plus `/api` (e.g. `https://abencivo-api.onrender.com/api`).

## Security notes (what's already hardened)

- **Rate limiting**: 5 login attempts / 15 min per IP, 20 enquiry
  submissions / hour per IP, 300 requests / 15 min per IP overall.
- **Security headers** via Helmet (HSTS, X-Content-Type-Options,
  X-Frame-Options, no `X-Powered-By`). Uploaded images get a scoped
  `Cross-Origin-Resource-Policy: cross-origin` exception on `/uploads`
  specifically, since the frontend lives on a different origin and needs
  to render them in `<img>` tags — the rest of the API keeps the stricter
  same-origin default.
- **Server-side validation** on every write endpoint (`server/validate.js`)
  — length limits, required fields, phone/email format, and control
  characters (CR/LF) stripped from every string input as defense-in-depth
  against header injection. The enquiry `type` field is restricted to the
  exact allowlist the frontend's dropdown offers, rather than trusted as
  free text — it's the one field that ends up in an outgoing email subject
  line.
- **File uploads**: extension AND MIME type must both match an allowlist
  (JPG/PNG/WEBP/PDF only — SVG is deliberately excluded since an uploaded
  SVG can carry an executable `<script>`), 5MB size cap, randomized
  filenames.
- **No default admin password.** Earlier versions of this project silently
  created an admin account with a hardcoded fallback password if the env
  vars weren't set. That's fixed — now it just refuses to create an
  account at all until you configure real credentials.
- **Generic error messages in production** — the client never sees stack
  traces or raw error text; full detail still goes to the server logs for
  debugging.
- **All SQL is parameterized** (`better-sqlite3` prepared statements
  throughout) — no string-concatenated queries anywhere.
- **Dependencies audited** with `npm audit` — 0 known vulnerabilities as of
  this build. Notably, `nodemailer` was upgraded to v10 to fix a
  high-severity SMTP/header injection advisory that directly applied here,
  since customer-supplied data flows into outgoing emails.
- Before your first real push to GitHub: run `git status` and confirm
  `.env` is NOT listed (it's gitignored, but double-check), and if this
  was ever a copy of a repo that had real secrets committed before,
  rotate those secrets — `.gitignore` only stops *future* commits, it
  doesn't remove something already in git history.

## API overview

- `GET /api/health` — status check
- `GET /api/products`, `GET /api/products/:id` — public catalogue
- `POST /api/enquiries` — public contact/enquiry form
- `POST /api/auth/login` — admin login, returns a JWT
- `GET/POST/PUT/DELETE /api/admin/products` — requires `Authorization: Bearer <token>`
- `GET/PATCH /api/admin/enquiries` — requires auth
- `GET /api/admin/audit-logs` — requires auth
- `POST /api/admin/upload` — requires auth, multipart file upload
