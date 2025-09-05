HexaWord Architecture (2025-ready)

Goals
- Ship a smooth, fast Devvit Web game with a clean separation of concerns.
- Share pure game logic across client and server (validation, seeding, scoring).
- Keep bundles small and predictable, with deterministic gameplay per post.
- Provide a typed request/response contract between client and server.

High-Level Design
- Layered (Ports & Adapters) structure:
  - Core (shared): Pure TypeScript domain and application logic, platform-agnostic.
  - Client adapter: Canvas rendering and input, fetch-based API client.
  - Server adapter: Express/Devvit routes, persistence (Redis), Reddit APIs.

Directories
- src/shared/game
  - domain: Entities (Tile, GameState), events (EventBus), value objects.
  - application: Services (GridService, GameService), deterministic RNG, rules.
- src/shared/types
  - api.ts: Common API types (legacy counter API kept for compatibility).
  - game.ts: Game-specific API contracts (init, state, submit, etc.).
- src/server
  - routes/game.ts: Game API routes (/api/game/*).
  - core: Server-only helpers (e.g., Reddit post creation).
- src/client
  - services/api.ts (future): Thin typed client for game API.
  - presentation: Canvas renderer(s) using shared core services.
  - main.ts: Bootstraps view, fetches init, renders.

Key Practices for Devvit Web Games (2025)
- Determinism: Seed game generation with post ID and/or UTC date so all viewers see the same puzzle. Keep RNG centralized in shared core.
- Shared core: Keep rules, validation, and generation in shared code so both client and server agree on the truth.
- Typed boundaries: Define request/response types in shared and validate on the server. Keep the client strict about parsing/handling unknowns.
- Performance: Canvas or WebGL for rendering; avoid heavy libraries. Keep bundles small, lazy-load non-critical UI.
- Resilience: Client gracefully falls back if API is unavailable (e.g., offline playtest), but prefers server-provided seeds/words.
- Devvit specifics: Use `@devvit/web/server` context, Redis for per-post/user state, and expose internal endpoints for installs/menu actions.

API Surface (initial)
- GET /api/game/init → { postId, username, words[], seed }
  - Server determines `seed` (e.g., based on postId) and provides words/puzzle config.
  - Client uses the data for deterministic generation.

Next Steps
- Add deterministic RNG helper in shared core and use it in word placement and grid generation.
- Persist progress/scores per post+user in Redis; add endpoints `/api/game/submit` and `/api/game/state`.
- Consolidate client rendering to the shared-core-first architecture (HexGridRenderer + GameService), or adapt current main.ts to consume shared services.

