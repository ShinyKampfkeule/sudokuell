Status: ready-for-agent

## Problem Statement

Players who want to compete at Sudoku with a friend lack a simple way to race on the same puzzle while solving independently. A shared board would let one player's entries affect the other's game, while showing the opponent's answers would undermine the race.

## Solution

Build a responsive browser app for casual, private, live Sudoku matches between two guests. Both players solve the same standard 9x9 puzzle on separate boards. They can track the opponent's progress through a masked board view, and the first player whose complete, correct solution is explicitly checked wins.

## User Stories

1. As a guest player, I want to enter a nickname that is remembered on my device, so that my opponent can identify me without requiring an account.
2. As a host, I want to create a private match and share an invite link or room code, so that I can play with a friend.
3. As an invited player, I want to join a private match from its invite link or room code, so that I can enter the same lobby as the host.
4. As a player, I want to see when my opponent has joined, so that I know who I am playing.
5. As a host, I want to propose an Easy, Medium, or Hard difficulty, so that we can choose the challenge for our match.
6. As the other player, I want to accept the proposed difficulty or counter-propose another one, so that both players agree on the challenge.
7. As either player, I want to mark myself ready after we agree on a difficulty, so that the match starts only when we are both prepared.
8. As a player, I want the match to start with a shared countdown, so that neither player gets an unfair head start.
9. As a player, I want to solve a standard 9x9 Sudoku puzzle, so that the rules are familiar and consistent.
10. As a player, I want my board to be independent from my opponent's board, so that their entries never change my puzzle.
11. As a player, I want to select cells and enter digits using touch or a mouse and an on-screen number pad, so that I can play on phones, tablets, and computers.
12. As a player using a physical keyboard, I want to enter digits and navigate with the keyboard, skipping Puzzle clues and stopping at board edges, so that I can play efficiently without relying on pointer input.
13. As a player, I want to add optional pencil marks to empty cells, so that I can track candidate digits while solving.
14. As a player, I want my pencil marks to remain private, so that the opponent cannot see my working notes.
15. As a player, I want Sudoku rule conflicts to be highlighted when a digit duplicates another digit in its row, column, or 3x3 box, so that I can notice invalid entries.
16. As a player, I do not want the game to reveal whether an individual digit matches the solution before I check a complete Board; after an incorrect check, I want wrong entries highlighted without revealing their correct values.
17. As a player, I want to see the elapsed match time, so that I can track how long the race has lasted.
18. As a player, I want to see the opponent's original clues and a masked version of their board, so that I can follow their progress without seeing their entered digits.
19. As a player, I want each opponent-entered digit represented by “?” and their currently selected cell highlighted, so that I can see progress and focus without learning their answers.
20. As a player, I want to explicitly check a complete Board, so that only a correct checked solution wins the match.
21. As a player, I want an incomplete or incorrect grid not to count as a win, so that victory always means solving the whole puzzle correctly.
22. As a player, I want the first correct check processed by the server to win, so that near-simultaneous submissions have a deterministic outcome.
23. As a player, I want the match to have no overall time limit, so that we can continue until someone solves or forfeits.
24. As a player, I want an explicit choice to leave to forfeit the match, so that the remaining player can be declared the winner.
25. As a player whose connection is unexpectedly lost, I want 60 seconds to reconnect, so that a brief network interruption does not immediately end my match.
26. As the connected player, I want to win by forfeit if my opponent does not reconnect within the grace period, so that the match has a clear outcome after an extended disconnection.
27. As a player, I want the result screen to show the winner and elapsed time, so that the outcome is clear.
28. As a player, I want to offer a rematch after a match ends, so that we can continue playing together.
29. As either player, I want a rematch to start only when both players accept, so that neither player is forced into another match.
30. As a player accepting a rematch, I want a fresh puzzle at the previous difficulty by default, so that a rematch feels new while preserving the agreed challenge.
31. As a first-time player, I want a brief, dismissible guide to number entry, pencil marks, the masked opponent view, and the win condition, so that I can start playing without a lengthy tutorial.
32. As a player, I want to play without in-app chat or reactions, so that the first version stays focused on the Sudoku race.

## Implementation Decisions

- The first release is a responsive browser app for desktop, tablet, and mobile browsers.
- Matches are private, live, and limited to two players. A host shares an invite link with a room-code fallback.
- Both players join as guests. A player chooses a nickname that is remembered on that device; accounts, public matchmaking, rankings, and spectator mode are not part of this release.
- A match uses one standard 9x9 Sudoku puzzle at an Easy, Medium, or Hard difficulty. The host proposes a difficulty; the other player can accept it or counter-propose. Both players must agree on the difficulty and mark ready before a shared start countdown begins.
- Each player has a separate board for the same puzzle. A player's entries and pencil marks do not alter the opponent's board.
- Puzzle clues are visible and locked on both players' Boards. The Opponent view preserves those clues, masks every opponent-entered digit as “?”, and highlights the opponent's currently selected cell without exposing actual entries.
- The Room and Game experiences use distinct routes. Invite links open the Room route for the Lobby; when the shared countdown starts, both players move to the Game route. Opening the Room route after the match starts redirects to Game. Countdown, play, results, and rematches remain on the Game route.
- On larger screens, the Opponent view is half the own Board's width and height; on narrow screens it stacks below the own Board. The timer is centered at the top of Game, and the number pad is centered below the boards at the bottom of Game. Neither is fixed to the viewport.
- Pencil marks are optional and visible only to the player who entered them.
- Rule-conflict feedback is limited to duplicate digits in a row, column, or 3x3 box. The app does not disclose solution correctness before a complete Board is checked and does not apply a mistake penalty. An incorrect check highlights wrong editable entries; editing any cell clears all such feedback until the next check.
- The elapsed-time clock counts up from the shared match start. There is no match deadline.
- A complete Board must be explicitly checked before it can win. The first correct check processed by the server wins; there is no tie window for near-simultaneous checks.
- Explicitly leaving forfeits immediately. An unexpected disconnect allows 60 seconds to reconnect; after that, the connected player wins by forfeit.
- The result presents the outcome and elapsed time, and offers a rematch. A rematch requires both players' agreement and uses a fresh puzzle at the previous difficulty by default.
- No in-app chat, reactions, or full interactive Sudoku tutorial are included. First-time players receive a brief, dismissible how-to guide.
- No application modules, APIs, persistence model, framework, or hosting platform beyond the browser target have been selected; the repository currently contains documentation only.

## Testing Decisions

- Tests should verify externally observable behavior, not internal implementation details.
- The primary seam is browser end-to-end testing with two isolated player sessions. Cover guest entry, invite/link or room-code joining, lobby agreement and readiness, route transitions, shared start, separate boards and visible clues, masked opponent progress, conflict feedback, failed and successful explicit checks, first-processed wins, and the result/rematch flow.
- Include end-to-end scenarios for explicit forfeit and reconnecting within or beyond the 60-second grace period.
- Verify that the opponent view never reveals entered digits or private pencil marks, incorrect checks expose only which entries are wrong, edits clear check feedback, and an unchecked, incorrect, or incomplete board does not produce a win.
- The workspace contains no application code or existing test suite, so there is no prior test pattern or existing module to name. Add tests alongside the application as its architecture is established, preserving the browser-level seam above.

## Out of Scope

- Accounts, persistent player profiles, public matchmaking, ranked play, leaderboards, and tournaments.
- Spectators, in-app text chat, and reactions.
- Sudoku variants other than standard 9x9 Sudoku.
- Asynchronous matches.
- Shared-board play, visible opponent answers, solution hints, solution correctness feedback before a complete Board check, and mistake penalties.
- A match deadline, or a full interactive Sudoku tutorial.

## Further Notes

- The product glossary is recorded in the root glossary. The accepted decision to use separate boards and masked opponent progress is recorded in ADR 0001.
- Puzzle generation or sourcing, invite-code lifetime and collision handling, reconnect state synchronization, and nickname validation rules are not yet specified and should be resolved during implementation design without changing the user-facing decisions above.
