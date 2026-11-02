# 02: Add persistent app-wide light and dark themes

**What to build:** Let players use a consistent light or dark appearance throughout Sudokuell, following their device preference by default and remembering an explicit choice.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Apply coherent light and dark themes to the home, lobby, game, and result experiences, including shared controls.
- [ ] Use the device's light/dark preference when the player has not selected a theme.
- [ ] Provide an accessible theme switch in the shared header and persist the player's explicit choice across reloads and visits.
- [ ] Ensure theme changes do not alter Match behavior, Board state, or opponent masking.
- [ ] Preserve recognizable digit colors in both themes and maintain readable contrast for text, controls, Board grid lines, and selection/error indicators.
- [ ] Verify system-preference fallback, theme switching and persistence, and consistent appearance in browser-level tests.
