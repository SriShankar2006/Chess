export class GameTimer {
    constructor(onTick, onTimeout) {
        this.onTick = onTick;
        this.onTimeout = onTimeout;
        this.interval = null;
        this.active = false;
        this.whiteSeconds = 180;
        this.blackSeconds = 180;
        this.currentPlayer = 'white';
    }

    initialize(minutes) {
        this.whiteSeconds = minutes * 60;
        this.blackSeconds = minutes * 60;
        this.currentPlayer = 'white';
        this.active = false;
        this.updateDisplay();
    }

    start(player) {
        this.currentPlayer = player;
        this.active = true;
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.tick(), 250);
    }

    pause() {
        this.active = false;
        if (this.interval) clearInterval(this.interval);
    }

    stop() {
        this.pause();
    }

    tick() {
        if (!this.active) return;
        if (this.currentPlayer === 'white') {
            this.whiteSeconds = Math.max(0, this.whiteSeconds - 0.25);
            if (this.whiteSeconds === 0) return this.onTimeout('white');
        } else {
            this.blackSeconds = Math.max(0, this.blackSeconds - 0.25);
            if (this.blackSeconds === 0) return this.onTimeout('black');
        }
        this.updateDisplay();
    }

    switchTo(player) {
        this.currentPlayer = player;
        this.active = true;
        this.updateDisplay();
    }

    reset(minutes) {
        this.initialize(minutes);
    }

    formatTime(seconds) {
        const total = Math.ceil(seconds);
        const minutes = Math.floor(total / 60).toString().padStart(2, '0');
        const secs = (total % 60).toString().padStart(2, '0');
        return `${minutes}:${secs}`;
    }

    updateDisplay() {
        if (typeof this.onTick === 'function') {
            this.onTick({
                white: this.formatTime(this.whiteSeconds),
                black: this.formatTime(this.blackSeconds),
                current: this.currentPlayer
            });
        }
    }
}
