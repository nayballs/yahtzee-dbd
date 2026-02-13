class Yatzy {
    constructor() {
        this.dice = [0, 0, 0, 0, 0];
        this.held = [false, false, false, false, false];
        this.scores = {};
        this.yatzyCount = 0;
        this.round = 0;
        this.rollsLeft = 0;
        this.rolled = false;
        this.totalCategories = 15;
        this.categories = [
            'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
            'one-pair', 'two-pairs', 'three-kind', 'four-kind',
            'small-straight', 'large-straight', 'full-house', 'chance', 'yatzy'
        ];

        // Game mode config (defaults to standard)
        this.config = {
            singleThrow: false,
            doubleBonus: false,
            unlimitedYatzy: false
        };

        this.loadStats();
        this.loadModes();
        this.setupEventListeners();
    }

    // ===== MODE SELECTION =====

    loadModes() {
        // Restore last-used mode selection
        try {
            const saved = localStorage.getItem('yatzy-dbd-mode');
            if (saved) {
                const radio = document.querySelector(`input[name="game-mode"][value="${saved}"]`);
                if (radio) radio.checked = true;
            }
        } catch { /* ignore */ }
    }

    saveModes(mode) {
        try {
            localStorage.setItem('yatzy-dbd-mode', mode);
        } catch { /* ignore */ }
    }

    startFromModeScreen() {
        // Read selected radio
        const selected = document.querySelector('input[name="game-mode"]:checked');
        const mode = selected ? selected.value : 'standard';

        // Map mode to config
        this.config = {
            singleThrow: mode === 'single-throw',
            doubleBonus: mode === 'double-bonus',
            unlimitedYatzy: mode === 'unlimited-yatzy'
        };
        this.saveModes(mode);

        // Update bonus display
        const bonusAmt = this.config.doubleBonus ? 100 : 50;
        document.getElementById('bonus-target').innerHTML = `&ge;63 = ${bonusAmt}`;

        // Show/hide rolls display
        const rollsEl = document.getElementById('rolls-display');
        rollsEl.classList.toggle('hidden', this.config.singleThrow);

        // Switch screens
        document.getElementById('mode-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');

        this.newGame();
    }

    showModeScreen() {
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('mode-screen').classList.remove('hidden');
        document.getElementById('win-modal').classList.add('hidden');
    }

    // ===== GAME LOGIC =====

    newGame() {
        this.dice = [0, 0, 0, 0, 0];
        this.held = [false, false, false, false, false];
        this.scores = {};
        this.yatzyCount = 0;
        this.round = 0;
        this.rollsLeft = 0;
        this.rolled = false;

        // Remove any leftover yatzy bonus elements
        document.querySelectorAll('.yatzy-bonus').forEach(el => el.remove());

        this.render();
        this.updateRollButton();
    }

    setupEventListeners() {
        // Start game from mode screen
        document.getElementById('start-game-btn').addEventListener('click', () => this.startFromModeScreen());

        // Dice clicks (hold/unhold in multi-roll mode)
        document.querySelectorAll('.die').forEach(die => {
            die.addEventListener('click', () => {
                if (this.config.singleThrow) return; // No holding in single-throw
                if (!this.rolled) return; // Must have rolled first
                if (this.rollsLeft <= 0) return; // No rolls left means must score

                const idx = parseInt(die.dataset.index);
                this.held[idx] = !this.held[idx];
                this.renderDice();
                this.vibrate(5);
            });
        });

        // Roll button
        document.getElementById('roll-btn').addEventListener('click', () => this.roll());

        // Score row clicks
        document.querySelectorAll('.score-row[data-category]').forEach(row => {
            row.addEventListener('click', () => {
                const cat = row.dataset.category;
                if (this.rolled && !(cat in this.scores)) {
                    this.scoreCategory(cat);
                }
            });
        });

        // New game (same mode)
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());

        // Play again from modal (same mode)
        document.getElementById('play-again-btn').addEventListener('click', () => {
            document.getElementById('win-modal').classList.add('hidden');
            this.newGame();
        });

        // Change mode from modal
        document.getElementById('change-mode-btn').addEventListener('click', () => this.showModeScreen());

        // Back to mode select from header
        document.getElementById('back-to-modes').addEventListener('click', () => this.showModeScreen());
    }

    roll() {
        if (this.round >= this.totalCategories && this.rollsLeft <= 0) return;

        if (this.config.singleThrow) {
            // Single throw mode: one roll per round
            if (this.rolled) return;
            this.rolled = true;
            this.round++;
            this.rollsLeft = 0;

            // Roll all dice
            for (let i = 0; i < 5; i++) {
                this.dice[i] = Math.floor(Math.random() * 6) + 1;
            }
        } else {
            // Standard mode: up to 3 rolls, can hold dice
            if (this.rollsLeft <= 0 && this.rolled) return; // Used all rolls

            if (!this.rolled) {
                // First roll of a new round
                this.round++;
                this.rollsLeft = 2; // 2 more rolls after this one
                this.rolled = true;
                this.held = [false, false, false, false, false];

                // Roll all dice
                for (let i = 0; i < 5; i++) {
                    this.dice[i] = Math.floor(Math.random() * 6) + 1;
                }
            } else {
                // Re-roll: only roll unheld dice
                this.rollsLeft--;
                for (let i = 0; i < 5; i++) {
                    if (!this.held[i]) {
                        this.dice[i] = Math.floor(Math.random() * 6) + 1;
                    }
                }
            }
        }

        // Animate
        const dieEls = document.querySelectorAll('.die');
        dieEls.forEach((el, i) => {
            if (!this.held[i] || this.config.singleThrow) {
                el.classList.add('rolling');
                setTimeout(() => el.classList.remove('rolling'), 400);
            }
            el.dataset.value = this.dice[i];
        });

        this.vibrate(20);
        this.renderDice();
        this.showPreviews();
        this.updateRollButton();
    }

    scoreCategory(cat) {
        const score = this.calculateScore(cat, this.dice);

        // Unlimited Yatzy bonus tracking
        if (this.config.unlimitedYatzy) {
            if (cat === 'yatzy' && score === 50) {
                this.yatzyCount++;
            } else if (cat !== 'yatzy' && this.isYatzy(this.dice) && this.yatzyCount > 0) {
                this.yatzyCount++;
            }
        }

        this.scores[cat] = score;
        this.rolled = false;
        this.rollsLeft = 0;
        this.held = [false, false, false, false, false];

        // Flash scored row
        const row = document.querySelector(`.score-row[data-category="${cat}"]`);
        if (row) {
            row.classList.add('score-flash');
            setTimeout(() => row.classList.remove('score-flash'), 500);
        }

        // Yatzy celebration
        if (score === 50 && cat === 'yatzy') {
            document.getElementById('dice-area').classList.add('yatzy-celebration');
            this.vibrate([30, 50, 30, 50, 80]);
            setTimeout(() => document.getElementById('dice-area').classList.remove('yatzy-celebration'), 1000);
        } else {
            this.vibrate(10);
        }

        this.render();
        this.updateRollButton();

        // Check game over
        if (Object.keys(this.scores).length >= this.totalCategories) {
            this.endGame();
        }
    }

    calculateScore(cat, dice) {
        const counts = [0, 0, 0, 0, 0, 0];
        dice.forEach(d => counts[d - 1]++);
        const sorted = [...dice].sort((a, b) => a - b);
        const sum = dice.reduce((a, b) => a + b, 0);

        switch (cat) {
            case 'ones': return counts[0] * 1;
            case 'twos': return counts[1] * 2;
            case 'threes': return counts[2] * 3;
            case 'fours': return counts[3] * 4;
            case 'fives': return counts[4] * 5;
            case 'sixes': return counts[5] * 6;

            case 'one-pair': {
                for (let i = 5; i >= 0; i--) {
                    if (counts[i] >= 2) return (i + 1) * 2;
                }
                return 0;
            }
            case 'two-pairs': {
                const pairs = [];
                for (let i = 5; i >= 0; i--) {
                    if (counts[i] >= 2) pairs.push(i + 1);
                }
                if (pairs.length >= 2) return pairs[0] * 2 + pairs[1] * 2;
                return 0;
            }
            case 'three-kind': {
                for (let i = 5; i >= 0; i--) {
                    if (counts[i] >= 3) return (i + 1) * 3;
                }
                return 0;
            }
            case 'four-kind': {
                for (let i = 5; i >= 0; i--) {
                    if (counts[i] >= 4) return (i + 1) * 4;
                }
                return 0;
            }
            case 'small-straight': {
                if (sorted.join('') === '12345') return 15;
                return 0;
            }
            case 'large-straight': {
                if (sorted.join('') === '23456') return 20;
                return 0;
            }
            case 'full-house': {
                const hasThree = counts.some(c => c === 3);
                const hasTwo = counts.some(c => c === 2);
                if (hasThree && hasTwo) return sum;
                return 0;
            }
            case 'chance': return sum;
            case 'yatzy': {
                if (counts.some(c => c === 5)) return 50;
                return 0;
            }
            default: return 0;
        }
    }

    isYatzy(dice) {
        return dice.every(d => d === dice[0]);
    }

    getUpperSum() {
        let sum = 0;
        ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].forEach(cat => {
            if (cat in this.scores) sum += this.scores[cat];
        });
        return sum;
    }

    getUpperBonus() {
        const bonusAmt = this.config.doubleBonus ? 100 : 50;
        return this.getUpperSum() >= 63 ? bonusAmt : 0;
    }

    getYatzyBonuses() {
        if (!this.config.unlimitedYatzy) return 0;
        return Math.max(0, this.yatzyCount - 1) * 50;
    }

    getTotalScore() {
        let total = 0;
        for (const cat in this.scores) {
            total += this.scores[cat];
        }
        total += this.getUpperBonus();
        total += this.getYatzyBonuses();
        return total;
    }

    showPreviews() {
        this.categories.forEach(cat => {
            const row = document.querySelector(`.score-row[data-category="${cat}"]`);
            if (!row) return;
            const preview = row.querySelector('.cat-preview');

            if (cat in this.scores) {
                preview.textContent = '';
                return;
            }

            if (this.rolled) {
                const score = this.calculateScore(cat, this.dice);
                preview.textContent = score > 0 ? score : '-';
                row.classList.add('available');
            } else {
                preview.textContent = '';
                row.classList.remove('available');
            }
        });
    }

    updateRollButton() {
        const btn = document.getElementById('roll-btn');
        const gameOver = Object.keys(this.scores).length >= this.totalCategories;

        if (gameOver) {
            btn.disabled = true;
            btn.textContent = 'Trial Over';
        } else if (this.config.singleThrow) {
            // Single throw mode
            if (this.rolled) {
                btn.disabled = true;
                btn.textContent = 'Choose a Category';
            } else {
                btn.disabled = false;
                btn.textContent = 'Roll the Bones';
            }
        } else {
            // Standard mode (3 rolls)
            if (this.rolled && this.rollsLeft <= 0) {
                btn.disabled = true;
                btn.textContent = 'Choose a Category';
            } else if (this.rolled) {
                btn.disabled = false;
                btn.textContent = `Re-Roll (${this.rollsLeft} left)`;
            } else {
                btn.disabled = false;
                btn.textContent = 'Roll the Bones';
            }
        }

        // Update rolls display for standard mode
        if (!this.config.singleThrow) {
            const rollsEl = document.getElementById('rolls-display');
            if (this.rolled) {
                const rollNum = 3 - this.rollsLeft;
                rollsEl.textContent = ` \u2014 Roll ${rollNum} / 3`;
                rollsEl.classList.remove('hidden');
            } else {
                rollsEl.classList.add('hidden');
            }
        }
    }

    renderDice() {
        const dieEls = document.querySelectorAll('.die');
        dieEls.forEach((el, i) => {
            el.dataset.value = this.dice[i];
            el.classList.toggle('held', this.held[i]);

            // Show hold hint in standard mode
            if (!this.config.singleThrow && this.rolled && this.rollsLeft > 0) {
                el.classList.add('holdable');
            } else {
                el.classList.remove('holdable');
            }

            // Render pips
            el.innerHTML = '';
            if (this.dice[i] === 0) return;

            const grid = document.createElement('div');
            grid.className = 'pip-grid';

            const positions = {
                1: [4],
                2: [2, 6],
                3: [2, 4, 6],
                4: [0, 2, 6, 8],
                5: [0, 2, 4, 6, 8],
                6: [0, 2, 3, 5, 6, 8]
            };

            for (let pos = 0; pos < 9; pos++) {
                const cell = document.createElement('div');
                if (positions[this.dice[i]].includes(pos)) {
                    cell.className = 'pip';
                }
                grid.appendChild(cell);
            }

            el.appendChild(grid);
        });
    }

    render() {
        this.renderDice();

        // Update score rows
        this.categories.forEach(cat => {
            const row = document.querySelector(`.score-row[data-category="${cat}"]`);
            if (!row) return;
            const scoreEl = row.querySelector('.cat-score');
            const previewEl = row.querySelector('.cat-preview');

            row.classList.remove('scored', 'zero-scored', 'available');

            if (cat in this.scores) {
                scoreEl.textContent = this.scores[cat];
                previewEl.textContent = '';
                if (this.scores[cat] === 0) {
                    row.classList.add('zero-scored');
                } else {
                    row.classList.add('scored');
                }
                // Show yatzy bonus count
                if (cat === 'yatzy' && this.config.unlimitedYatzy && this.yatzyCount > 1) {
                    let bonusEl = row.querySelector('.yatzy-bonus');
                    if (!bonusEl) {
                        bonusEl = document.createElement('span');
                        bonusEl.className = 'yatzy-bonus';
                        scoreEl.parentNode.insertBefore(bonusEl, scoreEl);
                    }
                    bonusEl.textContent = `+${(this.yatzyCount - 1) * 50}`;
                }
            } else {
                scoreEl.textContent = '';
            }
        });

        if (!this.rolled) {
            this.categories.forEach(cat => {
                const row = document.querySelector(`.score-row[data-category="${cat}"]`);
                if (row) {
                    row.querySelector('.cat-preview').textContent = '';
                    row.classList.remove('available');
                }
            });
        }

        // Upper sum & bonus
        const upperSum = this.getUpperSum();
        document.getElementById('upper-sum').textContent = upperSum;
        const bonus = this.getUpperBonus();
        document.getElementById('upper-bonus').textContent = bonus;
        const bonusRow = document.querySelector('.bonus-row');
        bonusRow.classList.toggle('earned', bonus > 0);

        // Total
        document.getElementById('total-score').textContent = this.getTotalScore();

        // Round display
        const scored = Object.keys(this.scores).length;
        document.getElementById('round-display').textContent =
            `Round ${Math.min(scored + 1, this.totalCategories)} / ${this.totalCategories}`;

        // Stats display
        document.getElementById('streak').innerHTML = `&#x1F525; ${this.stats.streak}`;
        document.getElementById('high-score').textContent = `Best: ${this.stats.highScore}`;
        document.getElementById('games-played').textContent = `Games: ${this.stats.gamesPlayed}`;
    }

    endGame() {
        const total = this.getTotalScore();
        this.updateStats(total);

        const titleEl = document.getElementById('win-title');
        const flavorEl = document.getElementById('win-flavor');

        if (total >= 300) {
            titleEl.textContent = 'Entity Pleased';
            flavorEl.textContent = 'A worthy sacrifice. The Entity grants you freedom.';
        } else if (total >= 200) {
            titleEl.textContent = 'Trial Complete';
            flavorEl.textContent = 'You survived the trial. For now.';
        } else if (total >= 100) {
            titleEl.textContent = 'Sacrificed';
            flavorEl.textContent = 'The Entity consumes your offering.';
        } else {
            titleEl.textContent = 'Entity Displeased';
            flavorEl.textContent = 'Your bones were not enough.';
        }

        const bonusText = [];
        if (this.getUpperBonus() > 0) {
            bonusText.push(this.config.doubleBonus ? 'Double Bonus!' : 'Upper Bonus!');
        }
        if (this.config.unlimitedYatzy && this.yatzyCount > 1) {
            bonusText.push(`${this.yatzyCount}x Yatzy!`);
        }

        document.getElementById('win-stats').innerHTML =
            `Score: ${total}` +
            (bonusText.length ? `<br><span style="font-size:14px">${bonusText.join(' ')}</span>` : '');

        setTimeout(() => {
            document.getElementById('win-modal').classList.remove('hidden');
        }, 600);
    }

    // ===== PERSISTENCE =====

    loadStats() {
        try {
            const saved = localStorage.getItem('yatzy-dbd-stats');
            this.stats = saved ? JSON.parse(saved) : {
                highScore: 0,
                gamesPlayed: 0,
                streak: 0,
                lastPlayDate: null
            };
        } catch {
            this.stats = { highScore: 0, gamesPlayed: 0, streak: 0, lastPlayDate: null };
        }
    }

    updateStats(score) {
        if (score > this.stats.highScore) {
            this.stats.highScore = score;
        }
        this.stats.gamesPlayed++;

        // Streak tracking
        const today = new Date().toISOString().split('T')[0];
        if (this.stats.lastPlayDate) {
            const last = new Date(this.stats.lastPlayDate);
            const now = new Date(today);
            const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                this.stats.streak++;
            } else if (diffDays > 1) {
                this.stats.streak = 1;
            }
        } else {
            this.stats.streak = 1;
        }
        this.stats.lastPlayDate = today;

        try {
            localStorage.setItem('yatzy-dbd-stats', JSON.stringify(this.stats));
        } catch { /* ignore */ }
    }

    vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => new Yatzy());
