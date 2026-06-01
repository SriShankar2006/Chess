const UNICODE = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

const START_BOARD = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
];

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 10000 };

export const gameState = {
    board: [],
    currentTurn: 'white',
    mode: 'local',
    aiLevel: 'medium',
    timerMinutes: 3,
    selectedSquare: null,
    legalMoves: [],
    moveHistory: [],
    capturedWhite: [],
    capturedBlack: [],
    lastMove: null,
    isGameOver: false,
    result: null,
    pendingPromotion: null,
    drawOffer: null,
    roomCode: null,
    roomOwner: false,
    roomState: null
};

export function startNewGame(options = {}) {
    gameState.board = cloneBoard(START_BOARD);
    gameState.currentTurn = options.startColor || 'white';
    gameState.mode = options.mode || 'local';
    gameState.aiLevel = options.aiLevel || 'medium';
    gameState.timerMinutes = options.timerMinutes || 3;
    gameState.selectedSquare = null;
    gameState.legalMoves = [];
    gameState.moveHistory = [];
    gameState.capturedWhite = [];
    gameState.capturedBlack = [];
    gameState.lastMove = null;
    gameState.isGameOver = false;
    gameState.result = null;
    gameState.pendingPromotion = null;
    gameState.drawOffer = null;
    gameState.roomCode = null;
    gameState.roomOwner = false;
    gameState.roomState = null;
    gameState.historySnapshots = [];
    gameState.whiteKingMoved = false;
    gameState.blackKingMoved = false;
    gameState.whiteRookA = false;
    gameState.whiteRookH = false;
    gameState.blackRookA = false;
    gameState.blackRookH = false;
}

export function cloneBoard(board) {
    return board.map(row => row.slice());
}

export function getUnicode(piece) {
    return UNICODE[piece] || '';
}

export function isWhite(piece) {
    return !!piece && piece === piece.toUpperCase();
}

export function isBlack(piece) {
    return !!piece && piece === piece.toLowerCase() && piece !== '';
}

export function isOpposite(pieceA, pieceB) {
    return pieceA && pieceB && isWhite(pieceA) !== isWhite(pieceB);
}

export function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function getPieceAt(board, r, c) {
    return board[r][c] || '';
}

export function squareName(r, c) {
    return String.fromCharCode(97 + c) + (8 - r);
}

export function startNotation(move) {
    return squareName(move.from.r, move.from.c) + squareName(move.to.r, move.to.c);
}

export function getAllLegalMoves(color, board = gameState.board) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = getPieceAt(board, r, c);
            if (!piece) continue;
            if (color === 'white' ? isWhite(piece) : isBlack(piece)) {
                const pieceMoves = getLegalMovesForSquare(r, c, board, color);
                moves.push(...pieceMoves);
            }
        }
    }
    return moves;
}

export function getLegalMovesForSquare(r, c, board = gameState.board, color = gameState.currentTurn) {
    const piece = getPieceAt(board, r, c);
    if (!piece) return [];
    const legal = [];
    if ((color === 'white' && !isWhite(piece)) || (color === 'black' && !isBlack(piece))) return [];
    const candidates = generatePieceMoves(piece, r, c, board);
    for (const move of candidates) {
        const snapshot = cloneBoard(board);
        const captured = snapshot[move.to.r][move.to.c];
        snapshot[move.to.r][move.to.c] = snapshot[r][c];
        snapshot[r][c] = '';
        if (move.castle) {
            const rookFrom = move.rookFrom;
            const rookTo = move.rookTo;
            snapshot[rookTo.r][rookTo.c] = snapshot[rookFrom.r][rookFrom.c];
            snapshot[rookFrom.r][rookFrom.c] = '';
        }
        if (!isKingSafe(color, snapshot)) continue;
        legal.push({ from: { r, c }, to: move.to, capture: !!captured, piece, castle: move.castle, promotion: move.promotion });
    }
    return legal;
}

export function generatePieceMoves(piece, r, c, board) {
    const moves = [];
    const color = isWhite(piece) ? 'white' : 'black';
    const dir = color === 'white' ? -1 : 1;
    const enemy = color === 'white' ? isBlack : isWhite;
    const same = color === 'white' ? isWhite : isBlack;
    const target = (rr, cc) => inBounds(rr, cc) ? getPieceAt(board, rr, cc) : null;

    if (piece.toLowerCase() === 'p') {
        const front = target(r + dir, c);
        if (front === '') {
            moves.push({ to: { r: r + dir, c }, promotion: (r + dir === 0 || r + dir === 7) });
            const startRow = color === 'white' ? 6 : 1;
            if (r === startRow && target(r + dir * 2, c) === '') {
                moves.push({ to: { r: r + dir * 2, c }, doublePawn: true });
            }
        }
        for (const dc of [-1, 1]) {
            const capture = target(r + dir, c + dc);
            if (capture && enemy(capture)) {
                moves.push({ to: { r: r + dir, c: c + dc }, capture: true, promotion: (r + dir === 0 || r + dir === 7) });
            }
        }
    }

    if (piece.toLowerCase() === 'n') {
        const jumps = [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]];
        for (const [dr, dc] of jumps) {
            const rr = r + dr, cc = c + dc;
            const destination = target(rr, cc);
            if (!inBounds(rr, cc)) continue;
            if (!destination || enemy(destination)) moves.push({ to: { r: rr, c: cc }, capture: !!destination });
        }
    }

    if (piece.toLowerCase() === 'b' || piece.toLowerCase() === 'q') {
        for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
            let rr = r + dr, cc = c + dc;
            while (inBounds(rr, cc)) {
                const destination = target(rr, cc);
                if (!destination) {
                    moves.push({ to: { r: rr, c: cc } });
                } else {
                    if (enemy(destination)) moves.push({ to: { r: rr, c: cc }, capture: true });
                    break;
                }
                rr += dr; cc += dc;
            }
        }
    }

    if (piece.toLowerCase() === 'r' || piece.toLowerCase() === 'q') {
        for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            let rr = r + dr, cc = c + dc;
            while (inBounds(rr, cc)) {
                const destination = target(rr, cc);
                if (!destination) {
                    moves.push({ to: { r: rr, c: cc } });
                } else {
                    if (enemy(destination)) moves.push({ to: { r: rr, c: cc }, capture: true });
                    break;
                }
                rr += dr; cc += dc;
            }
        }
    }

    if (piece.toLowerCase() === 'k') {
        for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
            const rr = r + dr, cc = c + dc;
            if (!inBounds(rr, cc)) continue;
            const destination = target(rr, cc);
            if (!destination || enemy(destination)) moves.push({ to: { r: rr, c: cc }, capture: !!destination });
        }
        if (canCastle(r, c, board, color)) {
            const kingRow = r;
            if (canCastleSide(board, kingRow, c, 7, false, color)) {
                moves.push({ to: { r: kingRow, c: c + 2 }, castle: true, rookFrom: { r: kingRow, c: 7 }, rookTo: { r: kingRow, c: c + 1 } });
            }
            if (canCastleSide(board, kingRow, c, 0, true, color)) {
                moves.push({ to: { r: kingRow, c: c - 2 }, castle: true, rookFrom: { r: kingRow, c: 0 }, rookTo: { r: kingRow, c: c - 1 } });
            }
        }
    }

    return moves;
}

export function canCastle(r, c, board, colorArg) {
    const king = getPieceAt(board, r, c);
    if (!king || king.toLowerCase() !== 'k') return false;
    const color = colorArg || (isWhite(king) ? 'white' : 'black');
    const kingSide = color === 'white' ? !gameState.whiteKingMoved : !gameState.blackKingMoved;
    return kingSide;
}

export function canCastleSide(board, kr, kc, rookCol, queenSide = false, colorArg) {
    const king = getPieceAt(board, kr, kc);
    if (!king || king.toLowerCase() !== 'k') return false;
    const color = colorArg || (isWhite(king) ? 'white' : 'black');
    const rank = kr;
    const rook = getPieceAt(board, rank, rookCol);
    if (!rook || rook.toLowerCase() !== 'r') return false;
    const rookNotMoved = color === 'white' ? (rookCol === 0 ? !gameState.whiteRookA : !gameState.whiteRookH) : (rookCol === 0 ? !gameState.blackRookA : !gameState.blackRookH);
    if (!rookNotMoved) return false;
    const step = rookCol === 0 ? -1 : 1;
    let c = kc + step;
    while (c !== rookCol) {
        if (getPieceAt(board, rank, c)) return false;
        c += step;
    }
    const limit = rookCol === 0 ? kc - 2 : kc + 2;
    for (let checkCol = Math.min(kc, limit); checkCol <= Math.max(kc, limit); checkCol++) {
        if (isSquareAttacked(rank, checkCol, color, board)) return false;
    }
    return true;
}

export function isSquareAttacked(r, c, color, board) {
    const opponent = color === 'white' ? 'black' : 'white';
    for (let rr = 0; rr < 8; rr++) {
        for (let cc = 0; cc < 8; cc++) {
            const piece = getPieceAt(board, rr, cc);
            if (!piece) continue;
            if (opponent === 'white' ? isWhite(piece) : isBlack(piece)) {
                const pseudo = generatePieceMoves(piece, rr, cc, board);
                if (pseudo.some(move => move.to.r === r && move.to.c === c)) return true;
            }
        }
    }
    return false;
}

export function isKingSafe(color, board) {
    const kingSymbol = color === 'white' ? 'K' : 'k';
    let kr = -1, kc = -1;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingSymbol) {
                kr = r; kc = c;
            }
        }
    }
    if (kr < 0) return false;
    return !isSquareAttacked(kr, kc, color, board);
}

export function getKingPosition(color, board = gameState.board) {
    const kingSymbol = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingSymbol) {
                return { r, c };
            }
        }
    }
    return null;
}

export function getGameStatus(board = gameState.board) {
    const color = gameState.currentTurn;
    const legal = getAllLegalMoves(color, board);
    const inCheck = !isKingSafe(color, board);
    if (legal.length === 0) {
        if (inCheck) {
            return { finished: true, winner: color === 'white' ? 'black' : 'white', reason: 'checkmate' };
        }
        return { finished: true, winner: null, reason: 'stalemate' };
    }
    return { finished: false, winner: null, reason: inCheck ? 'check' : 'playing' };
}

export function makeMove(from, to, promotion = 'q', board = gameState.board) {
    if (gameState.isGameOver) return { success: false };
    const piece = getPieceAt(board, from.r, from.c);
    if (!piece) return { success: false };
    const legal = getLegalMovesForSquare(from.r, from.c, board, gameState.currentTurn);
    const chosen = legal.find(move => move.to.r === to.r && move.to.c === to.c);
    if (!chosen) return { success: false };

    gameState.historySnapshots.push({
        board: cloneBoard(board),
        currentTurn: gameState.currentTurn,
        moveHistory: gameState.moveHistory.slice(),
        capturedWhite: gameState.capturedWhite.slice(),
        capturedBlack: gameState.capturedBlack.slice(),
        lastMove: gameState.lastMove ? { ...gameState.lastMove } : null,
        pendingPromotion: gameState.pendingPromotion ? { ...gameState.pendingPromotion } : null,
        whiteKingMoved: gameState.whiteKingMoved,
        blackKingMoved: gameState.blackKingMoved,
        whiteRookA: gameState.whiteRookA,
        whiteRookH: gameState.whiteRookH,
        blackRookA: gameState.blackRookA,
        blackRookH: gameState.blackRookH
    });
    const captured = getPieceAt(board, to.r, to.c);
    board[to.r][to.c] = board[from.r][from.c];
    board[from.r][from.c] = '';
    if (chosen.castle) {
        board[chosen.rookTo.r][chosen.rookTo.c] = board[chosen.rookFrom.r][chosen.rookFrom.c];
        board[chosen.rookFrom.r][chosen.rookFrom.c] = '';
    }
    if (chosen.promotion) {
        gameState.pendingPromotion = { r: to.r, c: to.c, color: gameState.currentTurn, piece: board[to.r][to.c] };
    }

    const notation = getAlgebraicNotation(piece, from, to, captured, chosen);
    if (captured) {
        if (isWhite(captured)) gameState.capturedWhite.push(getUnicode(captured));
        else gameState.capturedBlack.push(getUnicode(captured));
    }
    if (chosen.promotion && promotion !== 'q') {
        board[to.r][to.c] = gameState.currentTurn === 'white' ? promotion.toUpperCase() : promotion.toLowerCase();
    } else if (chosen.promotion && promotion === 'q' && !gameState.pendingPromotion) {
        board[to.r][to.c] = gameState.currentTurn === 'white' ? 'Q' : 'q';
    }

    gameState.lastMove = { from, to };
    gameState.moveHistory.push({ notation, player: gameState.currentTurn, check: null, capture: !!captured, promotion: chosen.promotion });
    const status = getGameStatus(board);
    if (gameState.pendingPromotion) {
        gameState.currentTurn = gameState.currentTurn;
    } else {
        gameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
    }
    gameState.selectedSquare = null;
    gameState.legalMoves = [];
    if (status.finished) {
        gameState.isGameOver = true;
        gameState.result = status;
    }
    updateMovementFlags(piece, from);
    return { success: true, pendingPromotion: !!gameState.pendingPromotion };
}

export function promotePawn(choice) {
    if (!gameState.pendingPromotion) return;
    const { r, c, color } = gameState.pendingPromotion;
    const promoted = color === 'white' ? choice.toUpperCase() : choice.toLowerCase();
    gameState.board[r][c] = promoted;
    gameState.pendingPromotion = null;
    gameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
    const status = getGameStatus(gameState.board);
    if (status.finished) {
        gameState.isGameOver = true;
        gameState.result = status;
    }
}

function getAlgebraicNotation(piece, from, to, captured, move) {
    const isPawn = piece.toLowerCase() === 'p';
    const file = String.fromCharCode(97 + to.c);
    const rank = 8 - to.r;
    const captureSymbol = captured ? 'x' : '';
    const promotion = move && move.promotion ? '=' + (gameState.currentTurn === 'white' ? 'Q' : 'q').toUpperCase() : '';
    const pieceName = isPawn ? '' : piece.toUpperCase();
    const checkSymbol = '';
    return `${pieceName}${captureSymbol}${file}${rank}${promotion}${checkSymbol}`;
}

export function selectSquare(r, c) {
    if (gameState.isGameOver || gameState.pendingPromotion) return;
    if (!gameState.selectedSquare) {
        const moves = getLegalMovesForSquare(r, c, gameState.board, gameState.currentTurn);
        if (moves.length) {
            gameState.selectedSquare = { r, c };
            gameState.legalMoves = moves;
        }
        return;
    }
    const from = gameState.selectedSquare;
    const result = makeMove(from, { r, c });
    if (!result.success) {
        const newMoves = getLegalMovesForSquare(r, c, gameState.board, gameState.currentTurn);
        if (newMoves.length) {
            gameState.selectedSquare = { r, c };
            gameState.legalMoves = newMoves;
        } else {
            gameState.selectedSquare = null;
            gameState.legalMoves = [];
        }
    }
}

export function undoMove() {
    const snapshot = gameState.historySnapshots.pop();
    if (!snapshot) return false;
    gameState.board = cloneBoard(snapshot.board);
    gameState.currentTurn = snapshot.currentTurn;
    gameState.moveHistory = snapshot.moveHistory;
    gameState.capturedWhite = snapshot.capturedWhite;
    gameState.capturedBlack = snapshot.capturedBlack;
    gameState.lastMove = snapshot.lastMove;
    gameState.pendingPromotion = snapshot.pendingPromotion;
    gameState.whiteKingMoved = snapshot.whiteKingMoved;
    gameState.blackKingMoved = snapshot.blackKingMoved;
    gameState.whiteRookA = snapshot.whiteRookA;
    gameState.whiteRookH = snapshot.whiteRookH;
    gameState.blackRookA = snapshot.blackRookA;
    gameState.blackRookH = snapshot.blackRookH;
    gameState.isGameOver = false;
    gameState.result = null;
    gameState.selectedSquare = null;
    gameState.legalMoves = [];
    return true;
}

function updateMovementFlags(piece, from) {
    if (!piece) return;
    if (!gameState.whiteKingMoved && piece === 'K') gameState.whiteKingMoved = true;
    if (!gameState.blackKingMoved && piece === 'k') gameState.blackKingMoved = true;
    if (!gameState.whiteRookA && piece === 'R' && from.c === 0) gameState.whiteRookA = true;
    if (!gameState.whiteRookH && piece === 'R' && from.c === 7) gameState.whiteRookH = true;
    if (!gameState.blackRookA && piece === 'r' && from.c === 0) gameState.blackRookA = true;
    if (!gameState.blackRookH && piece === 'r' && from.c === 7) gameState.blackRookH = true;
}

export function getCurrentStatus() {
    const status = getGameStatus(gameState.board);
    const turnLabel = gameState.currentTurn === 'white' ? 'White' : 'Black';
    if (status.finished) {
        if (status.winner) return `${status.winner.charAt(0).toUpperCase() + status.winner.slice(1)} wins by ${status.reason}`;
        return 'Stalemate';
    }
    if (status.reason === 'check') return `${turnLabel} to move — Check!`;
    return `${turnLabel} to move`;
}

export function getMoveHistoryLines() {
    const lines = [];
    for (let index = 0; index < gameState.moveHistory.length; index += 2) {
        const white = gameState.moveHistory[index];
        const black = gameState.moveHistory[index + 1];
        const moveNumber = Math.floor(index / 2) + 1;
        const whiteText = white ? white.notation : '';
        const blackText = black ? black.notation : '';
        lines.push(`${moveNumber}. ${whiteText}${blackText ? ' ' + blackText : ''}`);
    }
    return lines;
}

startNewGame();
