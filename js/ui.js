import { gameState, startNewGame, getUnicode, getCurrentStatus, getMoveHistoryLines, selectSquare, makeMove, promotePawn, getLegalMovesForSquare, isWhite } from './game.js';
import { GameTimer } from './timer.js';
import { chooseAIMove } from './ai.js';
import { showToast } from './notification.js';

const state = {
    activeView: 'landing',
    theme: 'dark',
    soundEnabled: false,
    roomPending: null,
    deferredPrompt: null
};

const refs = {};
let timer;

function init() {
    refs.navTheme = document.getElementById('themeToggle');
    refs.landing = document.getElementById('landingSection');
    refs.gameScreen = document.getElementById('gameSection');
    refs.boardGrid = document.getElementById('boardGrid');
    refs.historyList = document.getElementById('historyList');
    refs.capturedWhite = document.getElementById('capturedWhite');
    refs.capturedBlack = document.getElementById('capturedBlack');
    refs.statusLabel = document.getElementById('statusLabel');
    refs.activeModeLabel = document.getElementById('activeModeLabel');
    refs.difficultySelect = document.getElementById('difficultySelect');
    refs.timerMode = document.getElementById('timerMode');
    refs.startAIBtn = document.getElementById('playAI');
    refs.startLocalBtn = document.getElementById('playLocal');
    refs.startOnlineBtn = document.getElementById('playOnline');
    refs.exitMatchBtn = document.getElementById('exitMatchBtn');
    refs.roomCodeInput = document.getElementById('roomCodeInput');
    refs.createRoomBtn = document.getElementById('createRoomBtn');
    refs.joinRoomBtn = document.getElementById('joinRoomBtn');
    refs.promotionModal = document.getElementById('promotionModal');
    refs.promotionOptions = document.getElementById('promotionOptions');
    refs.modalTitle = document.getElementById('modalTitle');
    refs.modalText = document.getElementById('modalText');
    refs.confirmYes = document.getElementById('confirmYes');
    refs.confirmNo = document.getElementById('confirmNo');
    refs.resultScreen = document.getElementById('resultScreen');
    refs.resultTitle = document.getElementById('resultTitle');
    refs.resultDesc = document.getElementById('resultDesc');
    refs.resultRestart = document.getElementById('resultRestart');
    refs.resultHome = document.getElementById('resultHome');
    refs.whiteTimer = document.getElementById('whiteTimer');
    refs.blackTimer = document.getElementById('blackTimer');
    refs.undoBtn = document.getElementById('undoBtn');
    refs.resignBtn = document.getElementById('resignBtn');
    refs.drawBtn = document.getElementById('drawBtn');
    refs.restartBtn = document.getElementById('restartBtn');

    state.theme = localStorage.getItem('chessTheme') || 'dark';
    setTheme(state.theme);

    timer = new GameTimer(updateTimers, handleTimeout);
    timer.initialize(gameState.timerMinutes);

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
    refs.confirmNo.addEventListener('click', closeModal);
    refs.resultRestart.addEventListener('click', () => { closeResult(); launchGame(gameState.mode); });
    refs.resultHome.addEventListener('click', () => { closeResult(); switchView('landing'); });
    refs.undoBtn.addEventListener('click', undoMove);
    refs.resignBtn.addEventListener('click', () => confirmAction('resign', 'Are you sure you want to resign?', resignGame));
    refs.drawBtn.addEventListener('click', offerDraw);
    refs.restartBtn.addEventListener('click', () => confirmAction('restart', 'Restart this game and clear the board?', () => launchGame(gameState.mode)));
    window.addEventListener('storage', handleStorageSync);
}

function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chessTheme', theme);
    refs.navTheme.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    showToast(`${state.theme.charAt(0).toUpperCase() + state.theme.slice(1)} mode enabled`, 'success');
}

function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    refs.soundToggle.textContent = state.soundEnabled ? 'Mute' : 'Sound Off';
    showToast(state.soundEnabled ? 'Sound enabled' : 'Sound disabled', 'default');
}

function registerInstallPrompt() {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        state.deferredPrompt = event;
        if (refs.installBtn) {
            refs.installBtn.style.display = 'inline-flex';
        }
    });

    window.addEventListener('appinstalled', () => {
        showToast('App installed successfully!', 'success');
        state.deferredPrompt = null;
        if (refs.installBtn) {
            refs.installBtn.style.display = 'none';
        }
    });
}

function promptInstall() {
    if (!refs.installBtn) return;
    if (state.deferredPrompt) {
        state.deferredPrompt.prompt();
        state.deferredPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') {
                showToast('App install accepted', 'success');
            } else {
                showToast('App install dismissed', 'warning');
            }
            state.deferredPrompt = null;
            refs.installBtn.style.display = 'none';
        });
        return;
    }

    showToast('If install did not appear, use your browser menu to add this app to your desktop or home screen.', 'info');
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(() => {
            console.warn('Service worker registration failed');
        });
    }
}

function switchView(view) {
    refs.landing.style.display = view === 'landing' ? 'block' : 'none';
    refs.gameScreen.style.display = view === 'game' ? 'block' : 'none';
    state.activeView = view;
    if (view === 'landing') {
        timer.pause();
    }
}

function launchGame(mode) {
    startNewGame({ mode, aiLevel: refs.difficultySelect.value, timerMinutes: Number(refs.timerMode.value) });
    timer.initialize(Number(refs.timerMode.value));
    timer.start('white');
    refs.activeModeLabel.textContent = mode === 'ai' ? 'AI Opponent' : mode === 'online' ? 'Online Room' : 'Local Multiplayer';
    switchView('game');
    refs.boardGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    renderBoard();
    updateStatusPanel();
    updateCapturedLists();
    updateMoveHistory();
    if (mode === 'online') {
        showToast('Online room mode loaded. Create a room or enter a code to join.', 'success');
    } else {
        showToast(mode === 'ai' ? 'Playing against the AI' : 'Local multiplayer ready', 'success');
    }
}

function exitMatch() {
    timer.pause();
    if (gameState.mode === 'online') {
        gameState.roomCode = null;
        gameState.roomOwner = false;
    }
    gameState.isGameOver = true;
    switchView('landing');
    showToast('Exited current match', 'info');
}

function handleSquareClick(r, c) {
    if (gameState.isGameOver) return;
    if (gameState.pendingPromotion) return;
    const selected = gameState.selectedSquare;
    if (selected && selected.r === r && selected.c === c) {
        gameState.selectedSquare = null;
        gameState.legalMoves = [];
        renderBoard();
        return;
    }
    const before = gameState.selectedSquare;
    const legal = getLegalMovesForSquare(r, c, gameState.board, gameState.currentTurn);
    if (before && gameState.legalMoves.some(move => move.to.r === r && move.to.c === c)) {
        const result = makeMove(before, { r, c });
        completeMove(result);
        return;
    }
    if (legal.length) {
        gameState.selectedSquare = { r, c };
        gameState.legalMoves = legal;
        renderBoard();
        return;
    }
    gameState.selectedSquare = null;
    gameState.legalMoves = [];
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
    timer.switchTo(gameState.currentTurn);
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
    refs.promotionOptions.innerHTML = '';
    ['q','r','b','n'].forEach(choice => {
        const button = document.createElement('button');
        button.className = 'secondary-button';
        button.textContent = choice.toUpperCase();
        button.type = 'button';
        button.addEventListener('click', () => {
            promotePawn(choice);
            refs.promotionModal.classList.remove('active');
            refs.promotionModal.style.display = 'none';
            onMoveComplete();
        });
        refs.promotionOptions.appendChild(button);
    });
}

function renderBoard() {
    const squares = refs.boardGrid.querySelectorAll('.square');
    squares.forEach(square => {
        const row = Number(square.dataset.row);
        const col = Number(square.dataset.col);
        square.classList.remove('selected', 'highlight-move', 'highlight-capture', 'last-move');
        square.innerHTML = '';
        if (gameState.lastMove && ((gameState.lastMove.from.r === row && gameState.lastMove.from.c === col) || (gameState.lastMove.to.r === row && gameState.lastMove.to.c === col))) {
            square.classList.add('last-move');
        }
        if (gameState.selectedSquare && gameState.selectedSquare.r === row && gameState.selectedSquare.c === col) {
            square.classList.add('selected');
        }
        const piece = gameState.board[row][col];
        if (piece) {
            const element = document.createElement('span');
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
}

function updateCapturedLists() {
    refs.capturedWhite.innerHTML = '';
    refs.capturedBlack.innerHTML = '';
    gameState.capturedWhite.forEach(piece => {
        const slot = document.createElement('span');
        slot.className = 'captured-piece';
        slot.textContent = piece;
        refs.capturedWhite.appendChild(slot);
    });
    gameState.capturedBlack.forEach(piece => {
        const slot = document.createElement('span');
        slot.className = 'captured-piece';
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
    gameState.isGameOver = true;
    gameState.result = { finished: true, winner: player === 'white' ? 'black' : 'white', reason: 'timeout' };
    openResultScreen();
    showToast(`${player.charAt(0).toUpperCase() + player.slice(1)} timed out`, 'danger');
}

function openResultScreen() {
    timer.pause();
    refs.resultTitle.textContent = gameState.result.winner ? `${gameState.result.winner.toUpperCase()} WINS` : 'DRAW';
    refs.resultDesc.textContent = gameState.result.reason.replace(/([a-z])([A-Z])/g, '$1 $2');
    refs.resultScreen.classList.add('active');
    refs.resultScreen.style.display = 'flex';
}

function closeResult() {
    refs.resultScreen.classList.remove('active');
    refs.resultScreen.style.display = 'none';
}

function confirmAction(key, text, callback) {
    refs.modalTitle.textContent = 'Confirmation';
    refs.modalText.textContent = text;
    refs.confirmYes.onclick = () => { callback(); closeModal(); };
    refs.confirmNo.onclick = closeModal;
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
    showToast(`${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)} offers a draw`, 'warning');
}

function undoMove() {
    if (!gameState.historySnapshots || !gameState.historySnapshots.length) {
        showToast('No move to undo', 'warning');
        return;
    }
    const snapshot = gameState.historySnapshots.pop();
    Object.assign(gameState, snapshot);
    gameState.isGameOver = false;
    gameState.result = null;
    timer.switchTo(gameState.currentTurn);
    if (gameState.mode === 'online') syncRoomState();
    renderBoard();
    updateCapturedLists();
    updateMoveHistory();
    updateStatusPanel();
    showToast('Move undone', 'success');
}

function createRoom() {
    if (gameState.mode !== 'online') launchGame('online');
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    gameState.roomCode = code;
    gameState.roomOwner = true;
    syncRoomState();
    showToast(`Room created: ${code}`, 'success');
}

function joinRoom(code) {
    if (!code) return showToast('Enter a room code to join', 'warning');
    const entry = localStorage.getItem(`chess-room-${code}`);
    if (!entry) return showToast('Room not found', 'danger');
    if (gameState.mode !== 'online') launchGame('online');
    const room = JSON.parse(entry);
    gameState.roomCode = code;
    gameState.roomOwner = false;
    gameState.board = room.board;
    gameState.currentTurn = room.currentTurn;
    gameState.lastMove = room.lastMove;
    gameState.moveHistory = room.moveHistory || [];
    gameState.capturedWhite = room.capturedWhite || [];
    gameState.capturedBlack = room.capturedBlack || [];
    gameState.lastSync = room.timestamp;
    renderBoard();
    updateStatusPanel();
    updateCapturedLists();
    updateMoveHistory();
    showToast(`Joined room ${code}`, 'success');
}

function syncRoomState() {
    if (gameState.mode !== 'online' || !gameState.roomCode) return;
    const roomState = {
        board: gameState.board,
        currentTurn: gameState.currentTurn,
        lastMove: gameState.lastMove,
        moveHistory: gameState.moveHistory,
        capturedWhite: gameState.capturedWhite,
        capturedBlack: gameState.capturedBlack,
        timestamp: Date.now()
    };
    localStorage.setItem(`chess-room-${gameState.roomCode}`, JSON.stringify(roomState));
}

function handleStorageSync(event) {
    if (!event.key || !event.key.startsWith('chess-room-')) return;
    if (gameState.roomCode && event.key.endsWith(gameState.roomCode)) {
        const latest = localStorage.getItem(event.key);
        if (latest) {
            const room = JSON.parse(latest);
            if (!room.timestamp || room.timestamp === gameState.lastSync) return;
            gameState.board = room.board;
            gameState.currentTurn = room.currentTurn;
            gameState.lastMove = room.lastMove;
            gameState.lastSync = room.timestamp;
            renderBoard();
            updateStatusPanel();
            updateCapturedLists();
            updateMoveHistory();
            showToast('Online room updated', 'success');
        }
    }
}

init();
