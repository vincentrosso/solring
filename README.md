# Sol Ring

Paul's personal assistant, monitored by Katherine (his PA). Live: https://solring.pages.dev

- **Paul** chats with Sol (an AI). Questions get answered; anything that needs doing becomes a task for Katherine.
- **Katherine** sees the whole conversation, works the task list, writes to Paul as herself, and keeps private notes.
  She picks who answers Paul: **Auto** (Sol replies at once), **Review** (nothing reaches Paul until she approves or edits it), **Off** (Sol silent).
- Sol cannot act in the world (no email, calendar, calls). It only talks and hands work to Katherine.

## How it is built
Static page (`public/index.html`) + one Cloudflare Pages Function (`functions/api/[[path]].js`) + D1 (`schema.sql`).
The model is Cloudflare Workers AI (free daily allowance, `[ai]` binding). If the model fails or the allowance runs out,
Paul's message becomes a task for Katherine instead.

Sign-in is one access code per person (Pages secrets `PAUL_CODE`, `KAT_CODE`); codes are in `~/tmp/solring-codes.txt`.
Magic link: `https://solring.pages.dev/#k=<code>`.

## Commands
- `./deploy.sh` applies the schema and deploys (pastrami Cloudflare token).
- `./domain.sh` one-time: adds solring.ndex.us.
- `./reset.sh` wipes all messages and tasks on the live site.
- Local: `npx wrangler pages dev` after removing the `[ai]` block from `wrangler.toml` (the binding needs a remote
  session and fails to start); local codes are in `.dev.vars`.

## Logo
Original flat SVG drawn by `make_logo.py` (burning ring, a nod to the Alpha Sol Ring card; no card art is used).
`python3 make_logo.py` rewrites `public/logo.svg` + `logo-full.svg`; the PNG app icons are `logo-full.svg` rendered with `qlmanage` and resized with `sips`.

## Phone apps
`ios/` and `android/` are thin shells that load https://solring.ndex.us; a web deploy updates both with no store release.
App id `us.ndex.solring`. Sign in inside the app by typing the code or pasting the whole magic link. **Build on GitHub Actions only, never on the laptop.**
- **Android** (plain Java, one WebView activity, minSdk 26; CI supplies Gradle 8.9). The `android` workflow uploads a debug APK
  artifact (`solring-debug-apk`) that installs directly on a phone.
- **iOS** (XcodeGen `project.yml` + one SwiftUI file). The `ios` workflow builds unsigned for the simulator only. A real iPhone or
  TestFlight needs an Apple Developer account ($99/yr) and signing in CI. Until then: Safari > Share > Add to Home Screen.
- macOS runners bill at 10x on a private repo; the iOS workflow only runs when `ios/` changes.
