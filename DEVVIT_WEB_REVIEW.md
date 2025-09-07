# HexaWord Devvit Web Game — Architecture & Engineering Review (2025)

## Summary
- Solid foundation for a Devvit web game with a clean separation between client rendering, shared core logic, and server routes.
- Reusable, platform-agnostic logic in `src/shared` is a good direction and aligns with Devvit best practices.
- Determinism, typed boundaries, and validation are partially present in intent but not fully implemented.
- Implementation plan is ambitious; focus first on determinism, typed client/server contracts, graceful fallbacks, and tests.

## Alignment With Devvit Best Practices
- **Determinism:** Intended (seed returned from server) but not applied in generation.
  - Server returns `seed` from postId (`src/server/routes/game.ts:1`), but the generator does not use it for RNG or ordering.
- **Shared Core:** Present and used correctly.
  - Domain entities, events, and services under `src/shared/game/...` and algorithms under `src/shared/algorithms/...`.
- **Typed Boundaries:** Partial.
  - Shared types exist for legacy endpoints (`src/shared/types/api.ts:1`) and initial game endpoint (`src/shared/types/game.ts:1`), but server doesn’t validate request/response and client fetches ad‑hoc.
- **Server Adapter:** Uses `@devvit/web/server` context/redis/reddit.
  - Proper use of `context` and internal install/menu routes (`src/server/index.ts:1`, `src/server/core/post.ts:1`).
- **Performance:** Lightweight client (no heavy frameworks), canvas rendering with dynamic hex sizing (`src/web-view/engine/HexRenderer.ts:1`). No workers yet; placement runs on main thread.
- **Resilience:** Client falls back to default words only when not on Reddit.
  - On Reddit, if `/api/game/init` fails, `fetchWordsFromServer()` returns `[]` and the generator throws (poor UX) (`src/client/main.ts:74` → `src/web-view/services/CrosswordGenerator.ts:22`).
- **Security/Robustness:** No schema validation on server; limited error envelopes; no rate-limit/circuit breaker needed yet but validation should be added.

## Code Review Highlights
- **Server**
  - `src/server/index.ts:1`: Express app built with `@devvit/web/server`; mounts legacy counter endpoints and game router.
  - `src/server/routes/game.ts:1`: `/api/game/init` returns static words + `seed = postId`. Good start for deterministic play but seed is not used downstream.
  - Error responses use `{status, message}` without structured error codes; no payload validation.
- **Shared Core**
  - `src/shared/game/domain/entities/Tile.ts:1`, `src/shared/game/domain/entities/GameState.ts:1`: Clear, testable domain state; event bus exists (`src/shared/game/domain/events/GameEvents.ts:1`).
  - `src/shared/game/application/services/GridService.ts:1`: Uses `honeycomb-grid`; random letters are unseeded → undermines determinism if used.
  - `src/shared/algorithms/WordPlacementService.ts:1`: Reasonable constraints (intersections must match; no adjacent collisions; in‑bounds by radius). Placement strategy is deterministic only by word ordering; no seeded randomness.
- **Client**
  - `src/web-view/HexaWordGame.ts:1`: Good composition of generator, renderer, and input grid. Rendering is centered and sized dynamically. Interaction stubs are in place (click/touch).
  - `src/client/main.ts:1`: Decides server vs local words via hostname. On Reddit failures, uses empty words rather than local defaults → leads to user‑visible error; update to graceful fallback.

## Gaps and Risks
- **Missing determinism:** Seed is not used in generator or RNG; repeated loads may differ if letters or ordering change.
- **No boundary validation:** Server accepts/returns JSON without validation (consider zod/valibot). Client trusts response shape.
- **Typed client missing:** No thin typed client for `/api/game/*`; direct `fetch` with implicit parsing.
- **Error handling and fallbacks:** Reddit path can surface “Invalid word list” rather than falling back to defaults.
- **Testing void:** No unit/integration tests; algorithm and services are untested.
- **DI/Interfaces:** Instantiation is manual. Reasonable for size, but a minimal DI or factory would aid testing and future growth.
- **Performance considerations:** Placement on the UI thread could jank under large word sets; no worker path yet.

## Plan Review (IMPLEMENTATION_PLAN.md)
- The plan is comprehensive but over‑ambitious for early sprints (e.g., AC‑3, multiplayer, DI container, CQRS, event sourcing, circuit breakers).
- Recommend narrowing P0 to a pragmatic subset that materially improves stability, determinism, and developer velocity:
  - Deterministic generation, typed API client, graceful fallback, server validation, and tests.
  - Only minimal DI (constructor injection) where it improves testability; full containers can wait.

## Prioritized Recommendations

### P0 — Foundation (this week)
- **Seeded RNG end‑to‑end:**
  - Introduce a tiny seeded RNG (xorshift or mulberry32) in shared core and thread `seed` through `CrosswordGenerator` and `WordPlacementService` to drive any non‑deterministic choices.
  - Ensure any random letter generation (`src/shared/game/application/services/GridService.ts:1`) is disabled for crossword boards or seeded if used.
- **Typed client + graceful fallback:**
  - Add `src/client/services/api.ts` using `GameInitResponse` from `src/shared/types/game.ts:1`.
  - If fetch fails or payload invalid, fall back to local `defaultWords` instead of erroring (`src/client/main.ts:1`).
- **Server schema validation:**
  - Validate and serialize responses with a schema (zod) at `/api/game/init` and standardize error payloads with codes.
- **Minimal tests:**
  - Add unit tests for `WordPlacementService` core checks (intersection match, adjacency, bounds), and `CrosswordGenerator.validateWords()`; smoke test for `/api/game/init` shape.

### P1 — Productize
- **Deterministic word selection:**
  - If using a larger dictionary, select a daily subset deterministically by `postId` + UTC date.
- **Interaction and UX:**
  - Implement input grid interactions and basic word submission flow; connect to `GameService` for validation and to the server for canonical verification if desired.
- **Boundary contracts everywhere:**
  - Add request/response types for future endpoints (submit/state), centralize in `src/shared/types` and validate on server.
- **Performance hedge:**
  - Offload word placement to a Web Worker when word sets exceed N (configurable threshold) to keep FPS stable.

### P2 — Architecture Hygiene
- **Constructor injection over full DI:**
  - Convert services to accept dependencies via constructor params; keep DI container optional until complexity demands.
- **Telemetry and error envelopes:**
  - Add structured logs on server, and a simple client error overlay with idempotent retry for init fetch.

## Concrete Changes (Suggested)
- **Use seed in generator:**
  - `src/web-view/services/CrosswordGenerator.ts:1`: Accept a `rng` function injected from seed; use it for any shuffles/choices.
  - `src/shared/algorithms/WordPlacementService.ts:1`: Where multiple placements are valid, pick deterministically (e.g., sort candidates or use `rng`).
- **Typed API client:**
  - `src/client/services/api.ts`: `getGameInit(): Promise<GameInitResponse>` with narrow parsing and error handling.
  - `src/client/main.ts:1`: Replace ad‑hoc fetch with the typed client; on failure, log and use `defaultWords`.
- **Server validation and error shape:**
  - `src/server/routes/game.ts:1`: Wrap response with a zod schema and return `{ error: { code, message } }` for 4xx/5xx.
- **Tests (minimal):**
  - Place under `src/shared/__tests__/` for domain/algorithms; add a server route test if a test runner is configured. Keep it small and focused.

## Quick Wins
- Graceful fallback to default words on Reddit when `/api/game/init` fails (`src/client/main.ts:1`).
- Remove dead random letter generation for crosswords or gate it with a config flag (`src/shared/game/application/services/GridService.ts:1`).
- Standardize response types and narrow them to `GameInitResponse` where used on the client.

## Longer-Term Ideas (Optional)
- Daily puzzle determinism based on `postId + day` for shared experience.
- Persist progress/scores in Redis keyed by `postId+user` with simple endpoints (`/api/game/state`, `/api/game/submit`).
- Web Worker for heavy placement; progress events to update UI.

## Verdict
The codebase is clean, modular, and close to best practices for Devvit web games. Focusing on determinism, typed boundaries, validation, graceful fallbacks, and a few targeted tests will elevate this from a strong prototype to a robust, review‑ready app. The current implementation plan is solid but should be trimmed to a pragmatic P0/P1 scope to accelerate high‑impact wins.

