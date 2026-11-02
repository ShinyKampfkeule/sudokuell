# Require explicit checks for completed Sudoku Boards

Players must explicitly check a Complete Board before it can win: the server validates it, reports whether it is correct, and, after an incorrect check, identifies wrong editable entries without revealing their correct values. Any edit clears that feedback, and the first correct check processed by the server wins; this preserves a deterministic race while withholding solution hints during normal play.
