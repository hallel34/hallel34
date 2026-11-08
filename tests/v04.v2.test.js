// v0.5 (QA P2-3): tests/v04.test.js again, on rngVersion 2 games (the v2 keyed piles; see tests/support/stack.js).
globalThis.__TEST_RNG = 2;
await import('./v04.test.js');
