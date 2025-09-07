# HexaWord Implementation Plan - Pragmatic Priority

## 🎯 Goal
Build a production-ready HexaWord game for Reddit's Devvit platform with deterministic, testable, and performant architecture.

---

## Priority Levels (Pragmatic Revision)
- 🔴 **P0 (Critical)** - Core functionality that blocks everything else
- 🟡 **P1 (High)** - Essential features for production
- 🟢 **P2 (Medium)** - Important enhancements
- 🔵 **P3 (Low)** - Nice-to-have improvements

---

## Phase 0: Deterministic Generation 🔴 P0 [FIRST PRIORITY - IN PROGRESS]

### Why This Comes First
- **Consistent puzzles per Reddit post**: Core Devvit requirement
- **Reproducibility**: Makes debugging possible
- **Trust boundary**: Client and server agree on single truth
- **Testing foundation**: Can't write reliable tests without determinism
- **Performance baseline**: Can optimize later without changing outcomes

### 0.1 Implement Seeded RNG
- [ ] Create `src/shared/utils/rng.ts` with pure RNG (mulberry32/xorshift)
- [ ] Expose `createRNG(seed: string): () => number` function
- [ ] Add helper methods for common operations (shuffle, pick, range)
- [ ] Unit test RNG for consistency and distribution

### 0.2 Thread Seed Through Generation
- [ ] Update `CrosswordGenerator` to accept seed in config
- [ ] Pass RNG instance through all random operations
- [ ] Update `WordPlacementService` for deterministic choices
- [ ] Sort candidates when multiple valid placements exist
- [ ] Remove any Math.random() calls

### 0.3 Remove Unseeded Randomness
- [ ] Fix `GridService.generateRandomLetter()` to use seeded RNG
- [ ] Audit all code for Math.random() usage
- [ ] Replace with seeded alternatives
- [ ] Ensure no external randomness affects puzzle

### 0.4 Connect Client-Server Seed Flow
- [ ] Server: Use `postId` as seed base in `/api/game/init`
- [ ] Client: Fetch seed from server
- [ ] Pass seed to `HexaWordGame` constructor
- [ ] Thread through to `CrosswordGenerator`
- [ ] Verify same seed produces same puzzle

### Acceptance Criteria
- ✅ Same `words[]` + same `seed` = identical board across reloads
- ✅ Different seed = materially different board
- ✅ Unit test proves determinism
- ✅ No unseeded randomness in puzzle generation

### Files to Modify
1. `src/shared/utils/rng.ts` (new)
2. `src/web-view/services/CrosswordGenerator.ts`
3. `src/shared/algorithms/WordPlacementService.ts`
4. `src/client/main.ts`
5. `src/web-view/HexaWordGame.ts`
6. `src/shared/game/application/services/GridService.ts`

---

## Phase 1: API Robustness 🔴 P0 [NEXT PRIORITY]

### 1.1 Typed API Client
- [ ] Create shared API types
- [ ] Add request/response validation
- [ ] Implement proper error types
- [ ] Add retry logic

### 1.2 Graceful Fallbacks
- [ ] Default words if server fails
- [ ] Cached puzzle fallback
- [ ] Offline mode support
- [ ] Error recovery

### 1.3 Server Response Validation
- [ ] Schema validation for API responses
- [ ] Type guards for runtime checks
- [ ] Sanitize user inputs
- [ ] Rate limiting

---

## Phase 2: Core Testing 🔴 P0

### 2.1 Unit Tests for Determinism
- [ ] Test seeded RNG consistency
- [ ] Test placement determinism
- [ ] Test word sorting stability
- [ ] Test seed propagation

### 2.2 Integration Tests
- [ ] Test full generation pipeline
- [ ] Test client-server seed flow
- [ ] Test fallback scenarios
- [ ] Test error paths

### 2.3 Regression Tests
- [ ] Snapshot tests for known seeds
- [ ] Performance benchmarks
- [ ] Memory usage tests
- [ ] Load testing

---

## Phase 3: Architecture Refactoring 🟡 P1 [PREVIOUSLY PHASE 0]

### 3.1 Domain-Driven Design ✅ PARTIALLY COMPLETE
- [x] Create domain entities
- [x] Create value objects
- [x] Define repository interfaces
- [x] Extract business rules
- [ ] Complete domain services

### 3.2 Dependency Injection
- [ ] Create DI container
- [ ] Register services
- [ ] Remove direct instantiation
- [ ] Implement factories

### 3.3 Application Layer
- [ ] Create use cases
- [ ] Implement DTOs
- [ ] Add command/query separation
- [ ] Error handling patterns

### 3.4 Infrastructure Layer
- [ ] Repository implementations
- [ ] External service adapters
- [ ] Framework integration
- [ ] Data persistence

---

## Phase 4: Performance Optimization 🟡 P1

### 4.1 Algorithm Optimization
- [ ] Implement constraint solver (only after determinism works)
- [ ] Add backtracking with pruning
- [ ] Implement AC-3 arc consistency
- [ ] Performance profiling

### 4.2 Rendering Performance
- [ ] Implement dirty region tracking
- [ ] Add canvas layering
- [ ] Optimize hex calculations
- [ ] Add requestAnimationFrame batching

### 4.3 Memory Optimization
- [ ] Implement object pooling
- [ ] Add weak references where appropriate
- [ ] Optimize data structures
- [ ] Memory profiling

---

## Phase 5: Devvit Features 🟡 P1

### 5.1 Redis Integration
- [ ] Implement puzzle caching
- [ ] Add leaderboard storage
- [ ] User progress persistence
- [ ] Daily puzzle storage

### 5.2 Reddit Integration
- [ ] User authentication
- [ ] Subreddit theming
- [ ] Comment integration
- [ ] Award system

### 5.3 Daily Puzzles
- [ ] Date-based seeding
- [ ] Puzzle rotation
- [ ] Streak tracking
- [ ] Historical puzzles

---

## Phase 6: User Experience 🟢 P2

### 6.1 Mobile Optimization
- [ ] Touch controls
- [ ] Responsive sizing
- [ ] Gesture support
- [ ] Orientation handling

### 6.2 Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Font size options

### 6.3 Polish
- [ ] Animations
- [ ] Sound effects
- [ ] Visual feedback
- [ ] Loading states

---

## Implementation Timeline (Revised)

### Week 1: Deterministic Foundation 🔴
- Day 1-2: Seeded RNG implementation
- Day 3-4: Thread through generators
- Day 5: Client-server integration
- Day 6-7: Testing and verification

### Week 2: API & Testing 🔴
- Day 1-2: API client and validation
- Day 3-4: Fallback mechanisms
- Day 5-6: Unit tests
- Day 7: Integration tests

### Week 3: Performance & Redis 🟡
- Day 1-2: Algorithm optimization
- Day 3-4: Redis integration
- Day 5-6: Caching layer
- Day 7: Performance testing

### Week 4: Polish & Deploy 🟢
- Day 1-2: Mobile optimization
- Day 3-4: Final testing
- Day 5-6: Deployment
- Day 7: Monitoring setup

---

## Success Metrics (Pragmatic)

### Functionality
- [ ] Deterministic puzzle generation working
- [ ] Same seed always produces same puzzle
- [ ] Different seeds produce different puzzles
- [ ] No random variations between loads

### Reliability
- [ ] 99.9% uptime
- [ ] <1% error rate
- [ ] Graceful degradation
- [ ] Automatic recovery

### Performance
- [ ] Puzzle generation <100ms
- [ ] Initial load <2s
- [ ] 60 FPS rendering
- [ ] <50MB memory usage

### Quality
- [ ] 80% test coverage on critical paths
- [ ] Zero critical bugs in production
- [ ] Consistent experience across devices
- [ ] Positive user feedback

---

## Technical Debt (Revised Priority)

### 🔴 Must Fix Now
1. ❌ Non-deterministic generation
2. ❌ No seeded RNG
3. ❌ Unseeded randomness in grid
4. ❌ No server-client seed sync

### 🟡 Fix Soon
1. ❌ No tests for determinism
2. ❌ No API validation
3. ❌ No error handling
4. ❌ No Redis caching
5. ❌ Inefficient algorithm

### 🟢 Fix Later
1. ❌ No dependency injection
2. ❌ Missing abstraction layers
3. ❌ No use cases
4. ❌ Tight coupling

### 🔵 Nice to Have
1. ❌ Perfect DDD architecture
2. ❌ 100% test coverage
3. ❌ WebGL rendering
4. ❌ AI features

---

## Why This Order Works

1. **Determinism First**: Can't test or cache without it
2. **API Robustness Second**: Need reliable data flow
3. **Testing Third**: Verify everything works
4. **Architecture Later**: Refactor working code
5. **Polish Last**: Optimize what's proven

This pragmatic approach delivers **working features fast** while keeping the door open for architectural improvements later.

---

## Definition of Done (Pragmatic)

Each task is complete when:
- [ ] Feature works as specified
- [ ] Critical paths have tests
- [ ] No regressions introduced
- [ ] Code reviewed
- [ ] Deployed and verified

We can add more criteria as the codebase matures.

---

## Notes

- **Ship working code first**, refactor later
- **Determinism is the foundation** - everything depends on it
- **Test the critical paths**, not everything
- **Measure before optimizing**
- **User value over architectural purity**

---

*Last Updated: 2024*
*Version: 3.0 - Pragmatic Priority (Determinism First)*