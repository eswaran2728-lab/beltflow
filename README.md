BeltFlow — student, attendance, grading and billing management for
Persatuan Silambam Malaysia Daerah Sepang. Built with [Next.js](https://nextjs.org)
and [Supabase](https://supabase.com).

## Getting Started

### 1. Connect a Supabase project

The app has no database of its own — every page reads from Supabase, so it does
nothing useful until this is set up. Copy the template and fill it in:

```bash
cp .env.example .env.local
```

Both values come from your Supabase dashboard under **Project Settings → API**.
They are public by design (they ship to the browser); access control is enforced
server-side by Row Level Security, never by keeping them secret.

There is deliberately **no hardcoded fallback project**. If these variables are
missing the login page says so directly, rather than failing with a network
error that looks like a wrong password.

### 2. Run the dev server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Troubleshooting

**"Cannot reach the BeltFlow server" when logging in.** The app cannot open a
connection to Supabase at all. Most often the Supabase project has been
**paused** — free-tier projects are paused automatically after a period of
inactivity, and a paused project's hostname stops resolving in DNS, so the
browser reports it as a failed fetch. Check the project's status in the Supabase
dashboard and restore it if it shows as inactive. To confirm the cause:

```bash
getent hosts <your-project-ref>.supabase.co   # no output = project is paused or deleted
```

**"BeltFlow is not connected to a database."** `.env.local` is missing or
incomplete. See step 1 above, then restart the dev server — Next.js only reads
env files at startup.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
