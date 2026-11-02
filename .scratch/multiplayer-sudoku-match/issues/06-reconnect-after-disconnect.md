# 06: Reconnect or resolve a disconnect

**What to build:** A player can recover from an unexpected connection loss during a match, while an opponent who remains disconnected beyond the grace period receives a clear Forfeit result.

**Blocked by:** 05: See match results and play a Rematch.

**Status:** ready-for-agent

- [ ] An unexpected disconnect starts a 60-second reconnection grace period rather than immediately ending the match.
- [ ] A player who reconnects within the grace period can resume the same match and continue from their existing progress.
- [ ] If the player does not reconnect within 60 seconds, the connected player wins by Forfeit.
- [ ] The disconnect outcome is shown through the normal result experience with the winner and elapsed match time.
- [ ] Browser end-to-end tests verify recovery within the grace period and Forfeit after it expires using two player sessions.
