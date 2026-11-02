# 02: Agree on match setup and start

**What to build:** Two players in a private lobby agree on a Difficulty, prepare for the race, and begin the same Puzzle together.

**Blocked by:** 01: Create and join a private lobby.

**Status:** ready-for-human

- [x] The host can propose Easy, Medium, or Hard.
- [x] The other player can accept the proposal or counter-propose another Difficulty; the match cannot start until both agree.
- [x] Each player can mark themselves ready after agreeing on the Difficulty; the match cannot start until both are ready.
- [x] Both players receive the same standard 9x9 Puzzle at the agreed Difficulty.
- [x] Both players see a shared start countdown and the match begins together when it completes.
- [x] When the countdown starts, both players automatically navigate from `/room/{code}` to `/game/{code}`; opening the Room route after the match starts redirects to Game.
- [x] Browser end-to-end tests verify the agreement, readiness, shared Puzzle, and synchronized start using two player sessions.
