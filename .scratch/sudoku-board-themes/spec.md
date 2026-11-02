Status: ready-for-agent

## Problem Statement

The Sudoku Board has a heavy outer frame and uses the same visual treatment for every digit. Players want the cleaner board and distinct, rounded digit colors shown in the reference image. The app also needs a coherent light and dark appearance, rather than applying the reference's dark background only to the Board.

## Solution

Remove the Board's outer perimeter while preserving its internal cell grid and stronger 3x3 separators. Give visible Sudoku digits rounded colored backgrounds, with a consistent digit-to-color mapping on the Board and number pad. Support light and dark themes throughout the app, initially following the device preference and allowing a persistent user override from the shared header.

## User Stories

1. As a player, I want the Board to have no outer perimeter, so that its grid feels lighter and closer to the visual reference.
2. As a player, I want the internal cell lines and stronger 3x3 separators to remain visible, so that the Board stays easy to read.
3. As a player, I want each visible Sudoku digit to appear on its own rounded color tile, so that different digits are easy to distinguish at a glance.
4. As a player, I want a given Puzzle clue and an entered digit to use the same color for the same digit, so that color consistently identifies the digit rather than who entered it.
5. As a player, I want the number pad's 1–9 keys to use the same digit colors as the Board, so that choosing a digit is visually consistent with seeing it.
6. As a player, I want the digit colors to retain their identities in both themes, so that changing the theme does not change what each color means.
7. As a player, I want white numerals on readable colored tiles, so that the digits remain legible against their backgrounds.
8. As a player, I want pencil marks to remain neutral, so that candidate notes do not compete visually with placed digits.
9. As a player viewing the Opponent view, I want masked entries and their “?” markers to remain neutral, so that styling never reveals hidden answers.
10. As a player, I want the selected-cell indicator to remain visible without covering its digit color, so that focus and digit identity are both clear.
11. As a player, I want Conflict and incorrect-entry feedback to remain clear without removing the digit's color, so that I can recognize both the digit and the error.
12. As a player, I want the Clear number-pad control to remain neutral, so that only digit keys receive digit colors.
13. As a player, I want the app to follow my device's light or dark preference by default, so that it matches my environment without setup.
14. As a player, I want to switch between light and dark themes in the shared header, so that I can choose the appearance that suits me.
15. As a player, I want my explicit theme choice to persist across reloads and future visits, so that the app remembers my preference.
16. As a player, I want the theme to apply consistently to the home, lobby, game, and result experiences, so that the app remains visually coherent as I play.
17. As a player on a phone, tablet, or desktop, I want the theme control and colored digits to remain usable at my screen size, so that the visual changes do not impair play.

## Implementation Decisions

- The Board loses only its outer perimeter. Internal cell lines and the stronger 3x3 separators remain.
- Each visible placed digit uses a rounded background tile. The screenshot's digit mapping is retained: 1 blue, 2 green, 3 violet, 4 amber, 5 pink, 6 green-teal, 7 red, 8 cyan, and 9 purple. The same mapping is used on the Board and the 1–9 number-pad controls.
- Puzzle clues and the player's entered digits receive the same color treatment. The palette may use contrast-adjusted shades in light and dark themes while keeping each digit's identity recognizable; white numerals must remain legible.
- Pencil marks, masked opponent entries (including “?”), and the Clear control remain neutral. A visible Puzzle clue in the Opponent view is still a visible digit and receives its digit color.
- Selection and Conflict/incorrect-entry feedback remain distinct from the digit background: selecting a cell uses a separate outline or ring, and errors use a clear red indicator. These indicators must remain discernible when they overlap.
- Both light and dark themes cover all app screens and shared controls, not only the Board. The system preference supplies the default; a user override is available in the shared header and persists across visits.
- Theme state is a presentation preference and does not change Match, Board, Puzzle, or opponent-masking behavior.
- No new domain concepts or Match rules are introduced.

## Testing Decisions

- Good tests exercise externally visible behavior: a player's theme choice, its persistence and system-preference fallback, and the rendered Board and number-pad appearance. Tests should not depend on CSS implementation details such as selector names.
- Use a browser-level test of the running app as the primary feature seam. Verify both themes, system preference, explicit override after reload, the Board's missing outer perimeter with retained internal separators, digit tile consistency on the Board and number pad, and neutral styling for notes, masked values, and Clear. Include selection and error indicators where the game state permits.
- The repository currently has Vitest tests for game rules and shared Match behavior, including opponent masking, but no browser or component-test harness. Add browser test tooling only as needed for this end-to-end seam; retain existing Vitest coverage for non-visual behavior.

## Out of Scope

- Changing Sudoku rules, Match lifecycle, Puzzle generation, scoring, or the solution-check process.
- Revealing opponent entries or changing the privacy of pencil marks.
- Adding per-digit palette customization, additional themes, or a new settings page.
- Redesigning unrelated application features or changing the existing responsive game layout beyond what is needed to accommodate the theme control and digit tiles.

## Further Notes

- The app uses one shared Match experience for its home, room, and game routes, and all routes share the root layout. The visual treatment and theme must therefore remain consistent across those surfaces.
- The requested appearance is based on the user's attached “Board Screenshot.png” reference.
