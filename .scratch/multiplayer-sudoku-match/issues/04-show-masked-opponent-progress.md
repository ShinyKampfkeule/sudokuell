# 04: Follow masked opponent progress

**What to build:** During a live match, each player can follow the opponent's progress and elapsed time without seeing the opponent's answers or private Pencil marks.

**Blocked by:** 03: Solve a Puzzle on a private Board.

**Status:** ready-for-agent

- [ ] Each player can see the opponent's original Puzzle clues in an Opponent view.
- [ ] Every digit entered by the opponent is represented as “?”; the opponent's actual entries are never exposed.
- [ ] The opponent's currently selected cell is highlighted.
- [ ] The Opponent view does not reveal the opponent's private Pencil marks.
- [ ] On larger screens, the Opponent view is half the own Board's width and height; on narrow screens, it stacks below the own Board.
- [ ] A count-up timer begins at the shared match start, is centered at the top of Game, and shows elapsed time to both players without being fixed to the viewport.
- [ ] Browser end-to-end tests verify the masked view, responsive Board sizing, and timer update across two separate player sessions.
