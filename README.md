# AdonisBlue

AdonisBlue is a practice management platform built for aesthetic nurse injectors. It gives nurses an AI-powered client chatbot, automated aftercare emails, a client hub for logging treatments, emergency monitoring, and Stripe-based subscription billing — all in one place. Nurses set up their bot once and AdonisBlue handles client intake, aftercare, rebooking reminders, and follow-ups automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, server components, API routes) |
| Database & Auth | Supabase (Postgres + Row Level Security + Auth) |
| Hosting | Vercel (auto-deploy from `main`) |
| Email | Resend |
| Payments | Stripe (subscriptions, webhooks, billing portal) |
| AI | Anthropic Claude (chatbot, aftercare generation, prep guides) |
| SMS Alerts | Twilio |
| Newsletter | Beehiiv |

---

## Running Locally

```bash
# 1. Clone
git clone https://github.com/your-org/adonisblue.git
cd adonisblue

# 2. Install dependencies
npm install

# 3. Set environment variables
cp .env.example .env.local
# Fill in all values in .env.local (see Environment Variables below)

# 4. Start dev server
npm run dev
```

App runs at `http://localhost:3000`.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in every value. See `.env.example` for descriptions of each variable.

**Required for core functionality:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`

**Required for billing:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY` / `STRIPE_PRICE_STARTER_ANNUAL`
- `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_ANNUAL`

**Required for emergency SMS alerts:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

**Required for cron jobs:**
- `CRON_SECRET`

---

## Key Directories

```
app/
├── api/                  # All API routes (Next.js Route Handlers)
│   ├── chat/             # AI chatbot endpoint — handles client messages, emergency detection
│   ├── treatments/       # Log treatments, send aftercare emails
│   ├── intakes/          # Client intake records (CRUD)
│   ├── send-aftercare/   # Send aftercare email to a specific client
│   ├── send-prep-guide/  # Send pre-appointment prep guide email
│   ├── generate-aftercare/         # Claude: generate aftercare for custom procedures
│   ├── generate-prep-instructions/ # Claude: generate prep guide for custom procedures
│   ├── incidents/        # Emergency incident feed (flag, resolve, delete)
│   ├── emergency-keywords/ # Custom emergency keyword management
│   ├── cron/             # Scheduled jobs (rebooking reminders, review requests)
│   ├── admin/            # Internal admin routes (preview mode, feedback, user management)
│   └── stripe-webhook/   # Stripe webhook handler (subscription lifecycle)
│
├── dashboard/            # Nurse dashboard (main home after login)
├── aftercare/            # Client Hub — log treatments, send aftercare, monitor emergencies
├── chat/[slug]/          # Public AI chatbot for clients (nurse's branded chat page)
├── healing/[treatment_id]/ # Client post-treatment recovery chat
├── onboarding/           # New nurse setup flow (bot config, procedures, profile)
├── admin/                # Internal admin panel (nurse list, feedback, preview mode)
├── auth/                 # Login, magic link, password reset
├── insights/             # Analytics (treatment stats, bot conversion)
├── survey/[id]/          # Post-treatment client satisfaction survey
└── ref/[slug]/           # Referral tracking pages
```

---

## Cron Jobs

Cron jobs live in `app/api/cron/` and are configured in `vercel.json`. They run on a schedule and are protected by the `CRON_SECRET` bearer token.

| Route | Schedule | What it does |
|---|---|---|
| `/api/cron/reminders` | Daily | Sends rebooking reminder emails when a client's reminder date has passed |
| `/api/cron/treatment-reminders` | Daily | Sends treatment follow-up reminders |
| `/api/cron/reviews` | Daily | Sends post-treatment review request emails |

To test a cron job locally, call the endpoint with `Authorization: Bearer <CRON_SECRET>`.

---

## Deploying

Push to `main` → Vercel auto-deploys.

```bash
git push origin main
```

Make sure to also configure in Vercel / external services:
- **Stripe webhook** pointing to `https://yourdomain.com/api/stripe-webhook`
- **Supabase Auth redirect URLs** to include your production domain
- **Vercel Cron** jobs (defined in `vercel.json`)
- All environment variables set in the Vercel project dashboard
