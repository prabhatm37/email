This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase Storage Attachments

Production uploads use direct browser uploads to Supabase Storage so files do not pass through Vercel Serverless Function payload limits.

Set these environment variables in Vercel:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_STORAGE_BUCKET=
```

Where to get them:

- `SUPABASE_URL`: Supabase Dashboard -> Project Settings -> API -> Project URL.
- `NEXT_PUBLIC_SUPABASE_URL`: same value as `SUPABASE_URL`. This is safe to expose to the browser.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase Dashboard -> Project Settings -> API -> Project API keys -> publishable key. This is safe to expose to the browser. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported for older projects.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard -> Project Settings -> API -> service_role key. Keep this server-only; never prefix it with `NEXT_PUBLIC_`.
- `SUPABASE_STORAGE_BUCKET`: Supabase Dashboard -> Storage -> create a private bucket. Use the exact bucket name, for example `email-attachments`.

Add the same variables to `.env.local` for local testing, and to Vercel under Project Settings -> Environment Variables for Production. Redeploy after saving them.

Create the bucket as private. The app creates signed upload URLs on the server, uploads directly from the browser with the public anon key, and stores only attachment metadata in MongoDB.
