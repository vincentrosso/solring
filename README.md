# Beatrix

Named Beatrix since 2026-11-24 (was Sol Ring, first Mana Transfer). The assistant is also called Beatrix.
Only what people see was renamed: the repo, folder, Pages project, D1 database, address `solring.ndex.us`, app id `us.ndex.solring`,
Xcode target `SolRing` and the browser storage key `solring-code` keep the old name on purpose.

Paul's personal assistant, monitored by Katherine (his PA). Live: https://solring.ndex.us

- **Paul** chats with Beatrix (an AI). Questions get answered; anything that needs doing becomes a task for Katherine.
- **Katherine** sees the whole conversation, works the task list, writes to Paul as herself, and keeps private notes.
  She picks who answers Paul: **Auto** (Beatrix replies at once), **Review** (nothing reaches Paul until she approves or edits it), **Off** (Beatrix silent).
- **Vincent** has an admin sign-in: everything Katherine has, plus delete any message or task, Wipe all, and Beatrix's reply count against the daily cap.
- Beatrix cannot act in the world (no email, calendar, calls). It only talks and hands work to Katherine.

## How it is built
Static page (`public/index.html`) + one Cloudflare Pages Function (`functions/api/[[path]].js`) + D1 (`schema.sql`).
The model is Cloudflare Workers AI (free daily allowance, `[ai]` binding). If the model fails or the allowance runs out,
Paul's message becomes a task for Katherine instead.

Sign-in is one access code per person (Pages secrets `PAUL_CODE`, `KAT_CODE`, `ADMIN_CODE`). The three full magic links are in `~/tmp/solring-codes.txt`.

## Commands
- `./deploy.sh` applies the schema and deploys (pastrami Cloudflare token).
- `./domain.sh <name>` adds `<name>.ndex.us` as an address for the site (solring was added 2026-11-24; beatrix is not added).
- `./reset.sh yes` wipes all messages, tasks and settings on the live site (the admin Wipe all button does the same from the page, keeping settings).
- Local: `npx wrangler pages dev` after removing the `[ai]` block from `wrangler.toml` (the binding needs a remote
  session and fails to start); local codes are in `.dev.vars`.

## Logo
Original flat SVG drawn by `make_logo.py` (burning ring, a nod to the Alpha Beatrix card; no card art is used).
`python3 make_logo.py` rewrites `public/logo.svg` + `logo-full.svg`; the PNG app icons are `logo-full.svg` rendered with `qlmanage` and resized with `sips`.

## Phone apps
`ios/` and `android/` are thin shells that load https://solring.ndex.us; a web deploy updates both with no store release.
App id `us.ndex.solring`. Sign in inside the app by typing the code or pasting the whole magic link. **Build on GitHub Actions only, never on the laptop.**
- **Android** (plain Java, one WebView activity, minSdk 26; CI supplies Gradle 8.9). The `android` workflow uploads a debug APK
  artifact (`solring-debug-apk`) that installs directly on a phone.
- **iOS** (XcodeGen `project.yml` + one SwiftUI file). The `ios` workflow builds unsigned for the simulator only. A real iPhone or
  TestFlight needs an Apple Developer account ($99/yr) and signing in CI. Until then: Safari > Share > Add to Home Screen.
- The repo is **public** (since 2026-11-24) so Actions is free; keep codes and keys out of it. Both builds passed that day.
- Android download for a phone: https://github.com/vincentrosso/solring/releases/latest/download/Beatrix.apk (after an Android change: download the `solring-debug-apk` artifact and publish it as `Beatrix.apk` in a new release).

## Public page
`public/about/index.html` is the only page open to the world: what the app is, privacy (`/about/#privacy`), help (`/about/#support`).
It lists no contact address on purpose; the App Store will want one.
