# Multiplayer Sudoku Match

This context describes private, live Sudoku races between two players solving the same puzzle independently.

## Language

**Match**:
A private two-player Sudoku race, beginning in a Lobby and ending with a result.

**Lobby**:
The pre-game stage of a Match where players join, agree on difficulty, and indicate readiness.

**Room code**:
An invitation identifier shared with another player to find an open Match.

**Player**:
A guest participant identified by a display name remembered on their device.
_Avoid_: User, account

**Puzzle**:
A standard 9x9 Sudoku challenge shared by both players in a match.
_Avoid_: Board

**Puzzle clue**:
A fixed given digit in the Puzzle, displayed on both players' Boards and not editable.

**Board**:
One player's entries and pencil marks for the match's puzzle.

**Opponent view**:
A masked presentation of the other player's board: shared clues remain visible, entered digits are hidden, and the selected cell is indicated.

**Complete Board**:
A Board with a digit in every editable cell.

**Solution check**:
A player's explicit submission of a Complete Board for validation. An incorrect check identifies wrong editable entries without revealing their correct values; a correct check marks the Board Solved.

**Difficulty**:
The Easy, Medium, or Hard level agreed by both players for a match.

**Pencil mark**:
A player's private candidate digit note in an empty cell.

**Conflict**:
A digit duplicated within a row, column, or 3x3 box.

**Solved**:
A Board confirmed as a complete, correct solution by a Solution check.

**Forfeit**:
An end to a match caused by a player choosing to leave or failing to reconnect within the allowed grace period.

**Rematch**:
A new match between the same players, started only when both agree, with a fresh puzzle at the previous difficulty by default.
