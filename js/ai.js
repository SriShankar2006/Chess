import { cloneBoard, getAllLegalMoves, getUnicode, isWhite, isBlack } from './game.js';

const PIECE_SCORE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 10000 };

function baseScore(board) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            const value = PIECE_SCORE[piece.toLowerCase()] || 0;
            score += isWhite(piece) ? value : -value;
        }
    }
    return score;
}

function simulate(board, move) {
    const next = cloneBoard(board);
    const piece = next[move.from.r][move.from.c];
    next[move.to.r][move.to.c] = piece;
    next[move.from.r][move.from.c] = '';
    if (move.castle) {
        next[move.rookTo.r][move.rookTo.c] = next[move.rookFrom.r][move.rookFrom.c];
        next[move.rookFrom.r][move.rookFrom.c] = '';
    }
    return next;
}

function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export function chooseAIMove(level, color, board) {
    const moves = getAllLegalMoves(color, board);
    if (!moves.length) return null;
    if (level === 'easy') {
        return randomChoice(moves);
    }
    if (level === 'medium') {
        const captures = moves.filter(move => move.capture);
        if (captures.length) return randomChoice(captures);
        return randomChoice(moves);
    }
    return minimaxRoot(board, moves, color, 2);
}

function minimaxRoot(board, moves, color, depth) {
    let bestScore = -Infinity;
    let bestMove = moves[0];
    const maximize = color === 'white';
    for (const move of moves) {
        const nextBoard = simulate(board, move);
        const score = minimax(nextBoard, depth - 1, !maximize, -Infinity, Infinity);
        if (maximize ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

function minimax(board, depth, maximize, alpha, beta) {
    if (depth === 0) return baseScore(board);
    const color = maximize ? 'white' : 'black';
    const moves = getAllLegalMoves(color, board);
    if (!moves.length) return maximize ? -100000 : 100000;
    if (maximize) {
        let best = -Infinity;
        for (const move of moves) {
            const nextBoard = simulate(board, move);
            const score = minimax(nextBoard, depth - 1, false, alpha, beta);
            best = Math.max(best, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return best;
    }
    let best = Infinity;
    for (const move of moves) {
        const nextBoard = simulate(board, move);
        const score = minimax(nextBoard, depth - 1, true, alpha, beta);
        best = Math.min(best, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
    }
    return best;
}
