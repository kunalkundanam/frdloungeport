# FrdLounge

A movie-discovery front end and walkable 3D lounge with an independent room backend.

## Run locally

Requires Node.js 24 (built-in SQLite) and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:4174. Local identities use an HttpOnly cookie; use different browser profiles to try multiple participants. Local SQLite records live in `.local/` and are not committed. The preview listens only on this computer.

```sh
pnpm test
```

## Features

- Create/join a room with a six-character code; shared movie selection, chat, seats, ready checks and host controls.
- Cinema, Couples and Friends themes, redesigned lounge pods and materials.
- Couples invitations must be accepted by the recipient. Friends mode includes blasters, health, server-checked hits, cooldowns and respawning.
- WASD/arrows to walk, Shift to run, Space to jump, E to sit/stand, Q to fire in Friends mode, P for native video playback.
- App overlays and navigation disappear while seated. Press E to stand, or use the bottom-left exit control, revealed on hover/keyboard focus and available by touch.

## Backend

`server/api.mjs` contains room authorization and state transitions. SQLite locally and Cloudflare D1 in production use the migrations in `drizzle/`. Room writes use version checks to avoid conflicting seat assignments and actions. The Cloudflare entry point is `server/worker.mjs`; it needs a D1 binding named `DB`, an asset binding named `ASSETS`, and trusted platform-provided `oai-authenticated-user-id` headers. Never expose it behind a proxy that permits clients to spoof identity headers.

The hosted backend has not yet been deployed. Production requires provisioning these bindings, applying migrations, and configuring trusted authentication and sharing. The `.openai` folder identifies the existing private Sites project; it is local deployment metadata, excluded from this Git repository.

## Media and provenance

The catalog/theater front end was adapted from AethoFlix's publicly served compiled client, not its original source repository. FrdLounge branding, room backend, social modes, seating visibility and scene modifications are local additions. Original publisher ads and Firebase connections are disabled. Check the original assets' redistribution rights before public distribution.

External catalogs and streaming providers remain external dependencies. Embedded players share title/provider selection; frame playback stays local to each participant. Direct HTTPS video playback supports host synchronization. Local video files cannot be shared across devices. No movie files are hosted here.
