# 01: Create and join a private lobby

**What to build:** A guest can create a private match and invite one other guest by link or room code. Both players see the same lobby and can identify one another by nickname.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [x] A guest can set a nickname that is remembered on their device without creating an account.
- [x] A host can create a private match and share an invite link to its `/room/{code}` route and a room-code fallback.
- [x] A second guest can join the intended match from its invite link or room code and land on the Room route.
- [x] Both players can see that the other has joined the lobby.
- [x] The responsive browser experience supports desktop, tablet, and mobile layouts.
- [x] A first-time player can view and dismiss a brief guide to number entry, Pencil marks, the Opponent view, and how a player wins.
- [x] Browser end-to-end tests verify the host and invited guest reach the same private lobby in separate player sessions.
