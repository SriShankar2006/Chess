import { gameState, startNewGame, getUnicode, getCurrentStatus, getMoveHistoryLines, selectSquare, makeMove, promotePawn, getLegalMovesForSquare, getGameStatus, getKingPosition, isKingSafe, isSquareAttacked, isWhite } from './game.js';
import { GameTimer } from './timer.js';
import { chooseAIMove } from './ai.js';
import { showToast } from './notification.js';

const state = {
    activeView: 'landing',
    theme: 'dark',
    soundEnabled: false,
    roomPending: null,
    deferredPrompt: null,
    timerEnabled: true
};

const refs = {};
let timer;
// Poll interval for the joining device to pick up room state changes
let syncPollInterval = null;

function init() {
    refs.navTheme            = document.getElementById('themeToggle');
    refs.landing             = document.getElementById('landingSection');
    refs.gameScreen          = document.getElementById('gameSection');
    refs.boardGrid           = document.getElementById('boardGrid');
    refs.historyList         = document.getElementById('historyList');
    refs.capturedWhite       = document.getElementById('capturedWhite');
    refs.capturedBlack       = document.getElementById('capturedBlack');
    refs.statusLabel         = document.getElementById('statusLabel');
    refs.activeModeLabel     = document.getElementById('activeModeLabel');
    refs.difficultySelect    = document.getElementById('difficultySelect');
    refs.timerMode           = document.getElementById('timerMode');
    refs.startAIBtn          = document.getElementById('playAI');
    refs.startLocalBtn       = document.getElementById('playLocal');
    refs.startOnlineBtn      = document.getElementById('playOnline');
    refs.exitMatchBtn        = document.getElementById('exitMatchBtn');
    refs.roomPanel           = document.getElementById('roomPanel');
    refs.roomCodeInput       = document.getElementById('roomCodeInput');
    refs.createRoomBtn       = document.getElementById('createRoomBtn');
    refs.joinRoomBtn         = document.getElementById('joinRoomBtn');
    refs.activeRoomDisplay   = document.getElementById('activeRoomDisplay');
    refs.activeRoomCode      = document.getElementById('activeRoomCode');
    refs.copyRoomBtn         = document.getElementById('copyRoomBtn');
    refs.roomJoinControls    = document.getElementById('roomJoinControls');
    refs.promotionModal      = document.getElementById('promotionModal');
    refs.promotionOptions    = document.getElementById('promotionOptions');
    refs.modalTitle          = document.getElementById('modalTitle');
    refs.promotionOptions    = document.getElementById('promotionOptions');
    refs.modalTitle          = document.getElementById('modalTitle');
    refs.modalText           = document.getElementById('modalText');
    refs.confirmYes          = document.getElementById('confirmYes');
    refs.confirmNo           = document.getElementById('confirmNo');
    refs.resultScreen        = document.getElementById('resultScreen');
    refs.resultTitle         = document.getElementById('resultTitle');
    refs.resultDesc          = document.getElementById('resultDesc');
    refs.resultRestart       = document.getElementById('resultRestart');
    refs.resultHome          = document.getElementById('resultHome');
    refs.whiteTimer          = document.getElementById('whiteTimer');
    refs.blackTimer          = document.getElementById('blackTimer');
    refs.timerToggleBtn      = document.getElementById('timerToggleBtn');
    refs.boardStateMessage   = document.getElementById('boardStateMessage');
    refs.undoBtn             = document.getElementById('undoBtn');
    refs.resignBtn           = document.getElementById('resignBtn');
    refs.drawBtn             = document.getElementById('drawBtn');
    refs.restartBtn          = document.getElementById('restartBtn');

    state.theme = localStorage.getItem('chessTheme') || 'dark';
    setTheme(state.theme);

    timer = new GameTimer(updateTimers, handleTimeout);
    timer.initialize(gameState.timerMinutes);
    updateTimerToggle();

    buildBoardGrid();
    applyEventListeners();
    registerInstallPrompt();
    registerServiceWorker();
}

function buildBoardGrid() {
    refs.boardGrid.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('button');
            square.type = 'button';
            square.className = `square ${((r + c) % 2 === 0 ? 'white' : 'black')}`;
            square.dataset.row = r;
            square.dataset.col = c;
            square.setAttribute('aria-label', `Square ${String.fromCharCode(97 + c)}${8 - r}`);
            square.addEventListener('click', () => handleSquareClick(r, c));
            refs.boardGrid.appendChild(square);
        }
    }
}

function applyEventListeners() {
    refs.navTheme.addEventListener('click', () => toggleTheme());
    if (refs.exitMatchBtn) {
        refs.exitMatchBtn.addEventListener('click', exitMatch);
    }
    refs.startAIBtn.addEventListener('click', () => launchGame('ai'));
    refs.startLocalBtn.addEventListener('click', () => launchGame('local'));
    refs.startOnlineBtn.addEventListener('click', () => launchGame('online'));

    refs.createRoomBtn.addEventListener('click', createRoom);
    refs.joinRoomBtn.addEventListener('click', () => joinRoom(refs.roomCodeInput.value.trim()));
    refs.timerMode.addEventListener('change', handleTimerModeChange);
    refs.copyRoomBtn.addEventListener('click', copyRoomId);

    refs.confirmNo.addEventListener('click', closeModal);
    refs.resultRestart.addEventListener('click', () => { closeResult(); launchGame(gameState.mode); });
    refs.resultHome.addEventListener('click', () => { closeResult(); switchView('landing'); });
    refs.timerToggleBtn.addEventListener('click', toggleTimerEnabled);
    refs.undoBtn.addEventListener('click', undoMove);
    refs.resignBtn.addEventListener('click', () => confirmAction('resign', 'Are you sure you want to resign?', resignGame));
    refs.drawBtn.addEventListener('click', offerDraw);
    refs.restartBtn.addEventListener('click', () => confirmAction('restart', 'Restart this game and clear the board?', () => launchGame(gameState.mode)));

    // Cross-tab storage sync (works when both tabs are on the same origin/device)
    window.addEventListener('storage', handleStorageSync);
}

function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('chessTheme', theme);
    refs.navTheme.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    showToast(`${state.theme.charAt(0).toUpperCase() + state.theme.slice(1)} mode enabled`, 'success');
}
function updateTimerToggle() {
    if (!refs.timerToggleBtn) return;
    refs.timerToggleBtn.textContent = state.timerEnabled ? 'Timer On' : 'Timer Off';
    refs.timerToggleBtn.classList.toggle('active', state.timerEnabled);
}

function toggleTimerEnabled() {
    state.timerEnabled = !state.timerEnabled;
    updateTimerToggle();
    if (state.timerEnabled && !gameState.isGameOver) {
        timer.start(gameState.currentTurn);
        showToast('Timer enabled', 'success');
    } else {
        timer.pause();
        showToast('Timer disabled', 'info');
    }
}

function updateBoardOrientation() {
    const shouldFlip = gameState.mode === 'online' && !gameState.roomOwner;
    refs.boardGrid.classList.toggle('board-flipped', shouldFlip);
}

function showBoardMessage(message) {
    if (!refs.boardStateMessage) return;
    if (!message) {
        refs.boardStateMessage.style.display = 'none';
        refs.boardStateMessage.textContent = '';
        return;
    }
    refs.boardStateMessage.textContent = message;
    refs.boardStateMessage.style.display = 'flex';
}

function updateBoardStateMessage() {
    const status = getGameStatus();
    if (status.finished && status.reason === 'checkmate') {
        showBoardMessage(`🏆 Checkmate — ${status.winner.charAt(0).toUpperCase() + status.winner.slice(1)} wins`);
        return;
    }
    // Only show a center-board overlay for checkmate. For regular 'check',
    // highlight the king square only and leave the center overlay hidden.
    showBoardMessage('');
}
function registerInstallPrompt() {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        state.deferredPrompt = event;
    });
    window.addEventListener('appinstalled', () => {
        showToast('App installed successfully!', 'success');
        state.deferredPrompt = null;
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(() => {
            console.warn('Service worker registration failed');
        });
    }
}

function switchView(view) {
    refs.landing.style.display    = view === 'landing' ? 'block' : 'none';
    refs.gameScreen.style.display = view === 'game'    ? 'block' : 'none';
    state.activeView = view;
    if (view === 'landing') {
        timer.pause();
        stopSyncPoll();
    }
}

// Show / hide the Room Setup panel based on mode
function updateRoomPanelVisibility() {
    if (gameState.mode === 'online') {
        refs.roomPanel.style.display = 'block';
    } else {
        refs.roomPanel.style.display = 'none';
    }
}

// After a room is created or joined, show the room ID badge and hide the join controls
function showActiveRoom(code) {
    refs.activeRoomCode.textContent  = code;
    refs.activeRoomDisplay.style.display = 'block';
    refs.roomJoinControls.style.display  = 'none';
    // Remove copy button in online multiplayer — show only the room code
    if (refs.copyRoomBtn) {
        refs.copyRoomBtn.style.display = 'none';
        refs.copyRoomBtn.disabled = true;
    }
}

// Reset to the join controls (e.g. when exiting match)
function resetRoomPanel() {
    refs.activeRoomDisplay.style.display = 'none';
    refs.roomJoinControls.style.display  = 'block';
    refs.roomCodeInput.value             = '';
    refs.activeRoomCode.textContent      = '';
    if (refs.copyRoomBtn) {
        refs.copyRoomBtn.style.display = 'none';
        refs.copyRoomBtn.disabled = true;
    }
}

function copyRoomId() {
    // Prefer the displayed room code (safer) and fall back to gameState
    const displayed = refs.activeRoomCode ? refs.activeRoomCode.textContent.trim() : '';
    const code = displayed || gameState.roomCode;
    if (!code) {
        // If there's no code, hide the button to avoid confusion
        if (refs.copyRoomBtn) {
            refs.copyRoomBtn.style.display = 'none';
            refs.copyRoomBtn.disabled = true;
        }
        showToast('No room code to copy', 'warning');
        return;
    }
    navigator.clipboard.writeText(code)
        .then(() => showToast('📋 Room ID copied to clipboard!', 'success'))
        .catch(() => {
            // Fallback for older browsers / http contexts
            const el = document.createElement('textarea');
            el.value = code;
            el.style.position = 'fixed';
            el.style.opacity  = '0';
            document.body.appendChild(el);
            el.select();
            try {
                document.execCommand('copy');
                showToast('📋 Room ID copied!', 'success');
            } catch (e) {
                showToast('Unable to copy room ID', 'danger');
            }
            document.body.removeChild(el);
        });
}

function launchGame(mode) {
    startNewGame({ mode, aiLevel: refs.difficultySelect.value, timerMinutes: Number(refs.timerMode.value) });
    timer.initialize(Number(refs.timerMode.value));
    updateTimerToggle();
    if (state.timerEnabled) {
        timer.start('white');
    } else {
        timer.pause();
    }
    refs.activeModeLabel.textContent = mode === 'ai' ? 'AI Opponent' : mode === 'online' ? 'Online Multiplayer' : 'Local Multiplayer';
    switchView('game');
    updateRoomPanelVisibility();
    resetRoomPanel();
    stopSyncPoll();
    refs.boardGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    renderBoard();
    updateStatusPanel();
    updateCapturedLists();
    updateMoveHistory();
    if (mode === 'online') {
        showToast('Online mode ready. Create a room or enter an ID to join.', 'success');
    } else {
        showToast(mode === 'ai' ? 'Playing against the AI' : 'Local multiplayer ready', 'success');
    }
}

function handleTimerModeChange() {
    const minutes = Number(refs.timerMode.value) || 3;
    gameState.timerMinutes = minutes;
    // Reinitialize local timer to new setting
    timer.initialize(minutes);
    if (state.timerEnabled && !gameState.isGameOver) {
        timer.start(gameState.currentTurn);
    }
    showToast(`Timer set to ${minutes} minute${minutes > 1 ? 's' : ''}`, 'success');
    // If in online mode, propagate timer change to room state so opponent updates too
    if (gameState.mode === 'online' && gameState.roomCode) syncRoomState();
}

function exitMatch() {
    timer.pause();
    stopSyncPoll();
    if (gameState.mode === 'online' && gameState.roomCode) {
        // Clean up the room from localStorage so the slot is freed
        localStorage.removeItem(`chess-room-${gameState.roomCode}`);
        gameState.roomCode  = null;
        gameState.roomOwner = false;
    }
    gameState.isGameOver = true;
    resetRoomPanel();
    switchView('landing');
    showToast('Exited current match', 'info');
}

function handleSquareClick(r, c) {
    if (gameState.isGameOver) return;
    if (gameState.pendingPromotion) return;

    // In online mode, only the correct player can move
    if (gameState.mode === 'online') {
        // Owner plays white, guest plays black
        const myColor = gameState.roomOwner ? 'white' : 'black';
        if (gameState.currentTurn !== myColor) {
            showToast("It's your opponent's turn", 'warning');
            return;
        }
    }

    const selected = gameState.selectedSquare;
    if (selected && selected.r === r && selected.c === c) {
        gameState.selectedSquare = null;
        gameState.legalMoves     = [];
        renderBoard();
        return;
    }
    const before = gameState.selectedSquare;
    const legal  = getLegalMovesForSquare(r, c, gameState.board, gameState.currentTurn);
    if (before && gameState.legalMoves.some(move => move.to.r === r && move.to.c === c)) {
        const result = makeMove(before, { r, c });
        completeMove(result);
        return;
    }
    if (legal.length) {
        gameState.selectedSquare = { r, c };
        gameState.legalMoves     = legal;
        renderBoard();
        return;
    }
    gameState.selectedSquare = null;
    gameState.legalMoves     = [];
    renderBoard();
}

function completeMove(result) {
    if (!result.success) {
        showToast('Invalid move', 'warning');
        return;
    }
    if (result.pendingPromotion) {
        openPromotionModal();
    } else {
        if (gameState.mode === 'online') syncRoomState();
        onMoveComplete();
    }
}

function onMoveComplete() {
    if (state.timerEnabled) {
        timer.switchTo(gameState.currentTurn);
    } else {
        timer.pause();
    }
    renderBoard();
    updateCapturedLists();
    updateMoveHistory();
    updateStatusPanel();
    if (gameState.isGameOver) {
        openResultScreen();
    } else if (gameState.mode === 'ai' && gameState.currentTurn === 'black') {
        setTimeout(runAI, 450);
    }
}

function runAI() {
    if (gameState.mode !== 'ai' || gameState.isGameOver) return;
    const move = chooseAIMove(gameState.aiLevel, 'black', gameState.board);
    if (!move) return;
    const result = makeMove(move.from, move.to);
    completeMove(result);
}

function openPromotionModal() {
    refs.promotionModal.classList.add('active');
    refs.promotionModal.style.display = 'flex';
    refs.promotionOptions.innerHTML   = '';
    ['q', 'r', 'b', 'n'].forEach(choice => {
        const button = document.createElement('button');
        button.className   = 'secondary-button';
        button.textContent = choice.toUpperCase();
        button.type        = 'button';
        button.addEventListener('click', () => {
            promotePawn(choice);
            refs.promotionModal.classList.remove('active');
            refs.promotionModal.style.display = 'none';
            if (gameState.mode === 'online') syncRoomState();
            onMoveComplete();
        });
        refs.promotionOptions.appendChild(button);
    });
}

function renderBoard() {
    updateBoardOrientation();
    const kingPos = getKingPosition(gameState.currentTurn, gameState.board);
    const kingInCheck = kingPos ? isSquareAttacked(kingPos.r, kingPos.c, gameState.currentTurn, gameState.board) : false;
    const checkKing = kingInCheck ? kingPos : null;
    const squares = refs.boardGrid.querySelectorAll('.square');
    squares.forEach(square => {
        const row = Number(square.dataset.row);
        const col = Number(square.dataset.col);
        square.classList.remove('selected', 'highlight-move', 'highlight-capture', 'last-move', 'king-in-check');
        square.innerHTML = '';
        if (checkKing && checkKing.r === row && checkKing.c === col) {
            square.classList.add('king-in-check');
        }
        if (gameState.lastMove && (
            (gameState.lastMove.from.r === row && gameState.lastMove.from.c === col) ||
            (gameState.lastMove.to.r   === row && gameState.lastMove.to.c   === col)
        )) {
            square.classList.add('last-move');
        }
        if (gameState.selectedSquare && gameState.selectedSquare.r === row && gameState.selectedSquare.c === col) {
            square.classList.add('selected');
        }
        const piece = gameState.board[row][col];
        if (piece) {
            const element     = document.createElement('span');
            element.className = `piece ${isWhite(piece) ? 'white-piece' : 'black-piece'}`;
            element.textContent = getUnicode(piece);
            square.appendChild(element);
        }
        gameState.legalMoves.forEach(move => {
            if (move.to.r === row && move.to.c === col) {
                square.classList.add(move.capture ? 'highlight-capture' : 'highlight-move');
            }
        });
    });
}

function updateStatusPanel() {
    refs.statusLabel.textContent = getCurrentStatus();
    updateBoardStateMessage();
}

function updateCapturedLists() {
    refs.capturedWhite.innerHTML = '';
    refs.capturedBlack.innerHTML = '';
    gameState.capturedWhite.forEach(piece => {
        const slot = document.createElement('span');
        slot.className   = 'captured-piece';
        slot.textContent = piece;
        refs.capturedWhite.appendChild(slot);
    });
    gameState.capturedBlack.forEach(piece => {
        const slot = document.createElement('span');
        slot.className   = 'captured-piece';
        slot.textContent = piece;
        refs.capturedBlack.appendChild(slot);
    });
}

function updateMoveHistory() {
    const lines = getMoveHistoryLines();
    refs.historyList.innerHTML = lines.map(row => `<li>${row}</li>`).join('');
}

function updateTimers(payload) {
    refs.whiteTimer.textContent = payload.white;
    refs.blackTimer.textContent = payload.black;
}

function handleTimeout(player) {
    timer.pause();
    stopSyncPoll();
    gameState.isGameOver = true;
    gameState.result = { finished: true, winner: player === 'white' ? 'black' : 'white', reason: 'timeout' };
    openResultScreen();
    showToast(`${player.charAt(0).toUpperCase() + player.slice(1)} timed out`, 'danger');
}

function openResultScreen() {
    timer.pause();
    const reason = gameState.result.reason;
    if (reason === 'checkmate') {
        refs.resultTitle.textContent = '🏆 Checkmate';
        refs.resultDesc.textContent = `🎉 ${gameState.result.winner.charAt(0).toUpperCase() + gameState.result.winner.slice(1)} wins!`;
    } else if (reason === 'stalemate') {
        refs.resultTitle.textContent = '🤝 Stalemate';
        refs.resultDesc.textContent = 'The game ends in a draw.';
    } else if (reason === 'timeout') {
        refs.resultTitle.textContent = '⏰ Time Out';
        refs.resultDesc.textContent = `${gameState.result.winner.charAt(0).toUpperCase() + gameState.result.winner.slice(1)} wins by timeout.`;
    } else if (reason === 'resign') {
        refs.resultTitle.textContent = '🏳️ Resignation';
        refs.resultDesc.textContent = `${gameState.result.winner.charAt(0).toUpperCase() + gameState.result.winner.slice(1)} wins.`;
    } else if (reason === 'draw') {
        refs.resultTitle.textContent = '🤝 Draw';
        refs.resultDesc.textContent = 'The game ends in a draw.';
    } else {
        refs.resultTitle.textContent = gameState.result.winner
            ? `🏆 ${gameState.result.winner.toUpperCase()} WINS`
            : 'DRAW';
        refs.resultDesc.textContent = reason.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    updateBoardStateMessage();
    refs.resultScreen.classList.add('active');
    refs.resultScreen.style.display = 'flex';
}

function closeResult() {
    refs.resultScreen.classList.remove('active');
    refs.resultScreen.style.display = 'none';
}

function confirmAction(key, text, callback) {
    refs.modalTitle.textContent = 'Confirmation';
    refs.modalText.textContent  = text;
    refs.confirmYes.onclick = () => { callback(); closeModal(); };
    refs.confirmNo.onclick  = closeModal;
    openModal();
}

function openModal() {
    document.getElementById('confirmModal').classList.add('active');
    document.getElementById('confirmModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
    document.getElementById('confirmModal').style.display = 'none';
}

function resignGame() {
    gameState.isGameOver = true;
    gameState.result = { finished: true, winner: gameState.currentTurn === 'white' ? 'black' : 'white', reason: 'resign' };
    openResultScreen();
}

function offerDraw() {
    if (gameState.drawOffer === gameState.currentTurn) {
        gameState.isGameOver = true;
        gameState.result = { finished: true, winner: null, reason: 'draw' };
        openResultScreen();
        return;
    }
    gameState.drawOffer = gameState.currentTurn;
    showToast(`${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)} offers a draw. Click "Offer Draw" again to accept.`, 'warning');
}

function undoMove() {
    if (!gameState.historySnapshots || !gameState.historySnapshots.length) {
        showToast('No move to undo', 'warning');
        return;
    }
    const snapshot = gameState.historySnapshots.pop();
    Object.assign(gameState, snapshot);
    gameState.isGameOver = false;
    gameState.result     = null;
    timer.switchTo(gameState.currentTurn);
    if (gameState.mode === 'online') syncRoomState();
    renderBoard();
    updateCapturedLists();
    updateMoveHistory();
    updateStatusPanel();
    showToast('Move undone', 'success');
}

// ─── Online Room Logic ────────────────────────────────────────────────────────

function createRoom() {
    // Generate a readable 6-char room code
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    gameState.roomCode  = code;
    gameState.roomOwner = true;

    // Write initial room state to localStorage so the other device can find it
    syncRoomState();

    // Update UI
    showActiveRoom(code);
    showToast(`Room created: ${code}`, 'success');

    // Start polling so the owner can see the guest joining and moves being made
    startSyncPoll();
}

function joinRoom(code) {
    if (!code) {
        showToast('Enter a room ID to join', 'warning');
        return;
    }

    const key   = `chess-room-${code}`;
    const entry = localStorage.getItem(key);

    if (!entry) {
        showToast('Room not found. Make sure the room ID is correct and the host device has created the room.', 'danger');
        return;
    }

    // Parse room state from storage
    const room = JSON.parse(entry);

    // Apply room state WITHOUT calling launchGame (which would reset everything)
    gameState.mode        = 'online';
    gameState.roomCode    = code;
    gameState.roomOwner   = false;
    gameState.board       = room.board;
    gameState.currentTurn = room.currentTurn;
    gameState.lastMove    = room.lastMove  || null;
    gameState.moveHistory = room.moveHistory   || [];
    gameState.capturedWhite = room.capturedWhite || [];
    gameState.capturedBlack = room.capturedBlack || [];
    gameState.timerMinutes = room.timerMinutes || Number(refs.timerMode.value) || 3;
    gameState.lastSync    = room.timestamp;
    gameState.isGameOver  = false;
    gameState.result      = null;
    gameState.selectedSquare = null;
    gameState.legalMoves     = [];
    gameState.historySnapshots = gameState.historySnapshots || [];

    // Switch to game view if not already there
    if (state.activeView !== 'game') {
        refs.activeModeLabel.textContent = 'Online Multiplayer';
        switchView('game');
        updateRoomPanelVisibility();
    }

    // Show active room UI
    showActiveRoom(code);

    timer.initialize(gameState.timerMinutes || 3);
    updateTimerToggle();
    if (state.timerEnabled) {
        timer.start(gameState.currentTurn);
    } else {
        timer.pause();
    }

    renderBoard();
    updateStatusPanel();
    updateCapturedLists();
    updateMoveHistory();
    showToast(`Joined room ${code}. You are playing as Black.`, 'success');

    // Poll for opponent's moves
    startSyncPoll();
}

/**
 * Write the current game state to localStorage so the other device can read it.
 */
function syncRoomState() {
    if (gameState.mode !== 'online' || !gameState.roomCode) return;
    const roomState = {
        board:         gameState.board,
        currentTurn:   gameState.currentTurn,
        lastMove:      gameState.lastMove,
        moveHistory:   gameState.moveHistory,
        capturedWhite: gameState.capturedWhite,
        capturedBlack: gameState.capturedBlack,
        isGameOver:    gameState.isGameOver,
        result:        gameState.result,
        timerMinutes:  gameState.timerMinutes,
        timestamp:     Date.now()
    };
    localStorage.setItem(`chess-room-${gameState.roomCode}`, JSON.stringify(roomState));
}

/**
 * Apply a room snapshot from localStorage to live game state and re-render.
 */
function applyRoomSnapshot(room) {
    if (!room || room.timestamp === gameState.lastSync) return;
    gameState.board         = room.board;
    gameState.currentTurn   = room.currentTurn;
    gameState.lastMove      = room.lastMove  || null;
    gameState.moveHistory   = room.moveHistory   || [];
    gameState.capturedWhite = room.capturedWhite || [];
    gameState.capturedBlack = room.capturedBlack || [];
    // adopt timerMinutes if provided by room snapshot
    if (typeof room.timerMinutes === 'number' || room.timerMinutes) {
        gameState.timerMinutes = Number(room.timerMinutes) || gameState.timerMinutes;
        timer.initialize(gameState.timerMinutes);
        if (state.timerEnabled && !gameState.isGameOver) timer.start(gameState.currentTurn);
    }
    gameState.lastSync      = room.timestamp;

    if (room.isGameOver && !gameState.isGameOver) {
        gameState.isGameOver = true;
        gameState.result     = room.result;
    }

    renderBoard();
    updateStatusPanel();
    updateCapturedLists();
    updateMoveHistory();

    if (gameState.isGameOver) {
        openResultScreen();
    }
}

/**
 * storage event fires on OTHER tabs on the same browser.
 * This handles same-browser two-tab testing.
 */
function handleStorageSync(event) {
    if (!event.key || !event.key.startsWith('chess-room-')) return;
    if (!gameState.roomCode || !event.key.endsWith(gameState.roomCode)) return;
    if (gameState.mode !== 'online') return;

    const latest = localStorage.getItem(event.key);
    if (!latest) return;

    try {
        const room = JSON.parse(latest);
        applyRoomSnapshot(room);
    } catch (e) {
        console.warn('Room sync parse error', e);
    }
}

/**
 * Polling is necessary for cross-device scenarios where storage events
 * don't fire (different browsers / devices sharing the same localStorage
 * via a shared server, or during development via file:// where storage
 * events are unreliable).
 *
 * Polls every 1.5 seconds.
 */
function startSyncPoll() {
    stopSyncPoll();
    syncPollInterval = setInterval(() => {
        if (gameState.mode !== 'online' || !gameState.roomCode) return;
        const key    = `chess-room-${gameState.roomCode}`;
        const latest = localStorage.getItem(key);
        if (!latest) return;
        try {
            const room = JSON.parse(latest);
            applyRoomSnapshot(room);
        } catch (e) {
            console.warn('Room poll parse error', e);
        }
    }, 1500);
}

function stopSyncPoll() {
    if (syncPollInterval) {
        clearInterval(syncPollInterval);
        syncPollInterval = null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────

init();
