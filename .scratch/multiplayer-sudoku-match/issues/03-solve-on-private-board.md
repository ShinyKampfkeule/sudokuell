# 03: Solve a Puzzle on a private Board

**What to build:** Each player can solve the match's Puzzle on their own Board, with practical input controls and private working notes. Solution correctness is withheld until a complete Board is explicitly checked.

**Blocked by:** 02: Agree on match setup and start.

**Status:** ready-for-human

- [x] Each player can enter and change digits on their own Board without changing the other player's Board.
- [x] Puzzle clues are visible and locked on each player's own Board.
- [x] Players can select cells and enter digits using touch, mouse, and an on-screen number pad; physical keyboards support digit entry and arrow navigation that skips Puzzle clues and stops at board edges without wrapping.
- [x] The clickable number pad is centered below the Boards at the bottom of the Game view in normal page flow.
- [x] Players can add and remove optional Pencil marks that are visible only to themselves.
- [x] Conflicts are highlighted for duplicate digits in a row, column, or 3x3 box.
- [x] Before a complete Board is checked, the app does not reveal whether an individual conflict-free digit matches the Puzzle solution and does not penalize mistakes.
- [x] A Check solution action is available only when every editable cell is filled; a Board cannot win before it is explicitly checked.
- [x] An incorrect check identifies wrong editable entries without revealing their correct values. Editing any cell clears all check feedback until another full-Board check.
- [x] A correct check marks the Board Solved; an incomplete, incorrect, or unchecked Board cannot win.
- [x] Browser end-to-end tests verify independent Boards, visible locked clues, supported controls, private Pencil marks, Conflict feedback, incorrect-check feedback and reset, and checked-solution validation in two player sessions.
