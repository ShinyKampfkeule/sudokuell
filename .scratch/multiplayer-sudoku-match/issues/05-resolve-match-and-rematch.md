# 05: See match results and play a Rematch

**What to build:** Players receive a clear outcome when the race ends and can mutually start a fresh match together.

**Blocked by:** 03: Solve a Puzzle on a private Board.

**Status:** ready-for-agent

- [ ] The first correct Solution check processed by the server wins; an incomplete, incorrect, or unchecked Board cannot win.
- [ ] A player who explicitly leaves the match forfeits, and the remaining player is declared the winner.
- [ ] The result shows the winner and elapsed match time.
- [ ] Either player can offer or accept a Rematch; a new match starts only after both agree.
- [ ] A Rematch uses a fresh Puzzle at the previous Difficulty by default.
- [ ] Browser end-to-end tests verify a checked win, first-processed outcome for near-simultaneous checks, explicit Forfeit, result display, and mutual Rematch using two player sessions.
