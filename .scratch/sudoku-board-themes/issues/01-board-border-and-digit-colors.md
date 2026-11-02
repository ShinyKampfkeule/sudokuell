# 01: Remove the Board border and color digits

**What to build:** Make visible Sudoku digits easier to distinguish while giving the Board the lighter, borderless-edge appearance from the reference.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Remove only the Board's outer perimeter; keep the internal cell grid and stronger 3x3 separators.
- [ ] Give visible Puzzle clues and player-entered digits rounded backgrounds using the reference mapping: 1 blue, 2 green, 3 violet, 4 amber, 5 pink, 6 green-teal, 7 red, 8 cyan, and 9 purple.
- [ ] Use the same digit colors on number-pad keys 1–9, with readable white numerals; keep Clear neutral.
- [ ] Keep pencil marks and masked opponent entries (including “?”) neutral; color visible clues in the Opponent view.
- [ ] Preserve the digit background while keeping selected-cell and Conflict/incorrect-entry feedback clearly distinguishable.
- [ ] Verify the visual behavior in the browser at desktop and narrow viewport sizes.
