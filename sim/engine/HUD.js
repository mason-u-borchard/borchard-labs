/**
 * HUD — heads-up display for simulation controls and stats.
 *
 * Renders transport controls (play, pause, step, reset, speed slider),
 * a generation counter, state indicator, and experiment-specific stats.
 * Sits adjacent to the canvas. All UI matches the field notebook aesthetic.
 *
 * Subclasses populate custom stats via setStats().
 */

export class HUD {
    /**
     * @param {Simulation} simulation - The simulation instance to control.
     */
    constructor(simulation) {
        this._sim = simulation;
        this._el = null;
        this._statsEl = null;
        this._genEl = null;
        this._stateEl = null;
        this._playBtn = null;
        this._stepBtn = null;
        this._speedLabel = null;

        // Bound handlers for event cleanup
        this._onStateChange = this._handleStateChange.bind(this);
        this._onTick = this._handleTick.bind(this);
        this._onReset = this._handleReset.bind(this);
    }

    /**
     * Build the HUD DOM inside the given container.
     * @param {HTMLElement} container
     */
    mount(container) {
        var sim = this._sim;

        // Root
        var el = document.createElement('div');
        el.className = 'sim-hud';
        this._el = el;

        // --- Transport controls ---
        var transport = document.createElement('div');
        transport.className = 'sim-transport';

        // Play / Pause
        var playBtn = document.createElement('button');
        playBtn.className = 'btn btn-sm btn-primary';
        playBtn.textContent = sim.state === 'running' ? '\u23F8 Pause' : '\u25B6 Play';
        playBtn.addEventListener('click', function () {
            if (sim.state === 'running') {
                sim.pause();
            } else {
                sim.resume();
            }
        });
        this._playBtn = playBtn;
        transport.appendChild(playBtn);

        // Step
        var stepBtn = document.createElement('button');
        stepBtn.className = 'btn btn-sm btn-secondary';
        stepBtn.textContent = '\u23ED Step';
        stepBtn.disabled = sim.state === 'running';
        stepBtn.addEventListener('click', function () {
            sim.step();
        });
        this._stepBtn = stepBtn;
        transport.appendChild(stepBtn);

        // Reset
        var resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn-sm btn-ghost';
        resetBtn.textContent = '\u21BA Reset';
        resetBtn.addEventListener('click', function () {
            sim.reset();
        });
        transport.appendChild(resetBtn);

        // Speed slider group
        var speedGroup = document.createElement('div');
        speedGroup.className = 'sim-speed-group';

        var speedLabel = document.createElement('span');
        speedLabel.className = 'sim-speed-label mono';
        speedLabel.textContent = sim.speed + 'x';
        this._speedLabel = speedLabel;

        var speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.className = 'sim-speed-slider';
        speedSlider.min = '0.5';
        speedSlider.max = '5';
        speedSlider.step = '0.5';
        speedSlider.value = String(sim.speed);
        speedSlider.setAttribute('aria-label', 'Simulation speed');
        speedSlider.addEventListener('input', function () {
            var val = parseFloat(speedSlider.value);
            sim.setSpeed(val);
            speedLabel.textContent = val + 'x';
        });

        speedGroup.appendChild(speedSlider);
        speedGroup.appendChild(speedLabel);
        transport.appendChild(speedGroup);

        el.appendChild(transport);

        // --- Status section ---
        var status = document.createElement('div');
        status.className = 'sim-status';

        var genEl = document.createElement('div');
        genEl.className = 'sim-generation mono';
        this._genEl = genEl;

        var stateEl = document.createElement('span');
        stateEl.className = 'sim-state-indicator';
        this._stateEl = stateEl;

        status.appendChild(genEl);
        status.appendChild(stateEl);
        el.appendChild(status);

        // --- Stats panel ---
        var statsEl = document.createElement('dl');
        statsEl.className = 'sim-stats';
        this._statsEl = statsEl;
        el.appendChild(statsEl);

        container.appendChild(el);

        // Initial display
        this._refreshGeneration();
        this._refreshState();

        // Listen to simulation events
        sim.on('stateChange', this._onStateChange);
        sim.on('tick', this._onTick);
        sim.on('reset', this._onReset);
    }

    /**
     * Update displayed generation counter and state. Called by the simulation on tick.
     */
    update() {
        this._refreshGeneration();
        this._refreshState();
    }

    /**
     * Update the stats panel with key-value pairs.
     * @param {Object} statsObj - e.g. {p: '0.500', q: '0.500', 'Pop Size': '200'}
     */
    setStats(statsObj) {
        if (!this._statsEl) return;

        // Clear existing entries
        while (this._statsEl.firstChild) {
            this._statsEl.removeChild(this._statsEl.firstChild);
        }

        var keys = Object.keys(statsObj);
        for (var i = 0; i < keys.length; i++) {
            var dt = document.createElement('dt');
            dt.textContent = keys[i];

            var dd = document.createElement('dd');
            dd.className = 'mono';
            dd.textContent = statsObj[keys[i]];

            this._statsEl.appendChild(dt);
            this._statsEl.appendChild(dd);
        }
    }

    /**
     * Remove all DOM elements and detach event listeners.
     */
    destroy() {
        if (this._sim) {
            this._sim.off('stateChange', this._onStateChange);
            this._sim.off('tick', this._onTick);
            this._sim.off('reset', this._onReset);
        }
        if (this._el && this._el.parentNode) {
            this._el.parentNode.removeChild(this._el);
        }
        this._el = null;
        this._statsEl = null;
        this._genEl = null;
        this._stateEl = null;
        this._playBtn = null;
        this._stepBtn = null;
        this._speedLabel = null;
    }

    // -- Private helpers --

    _refreshGeneration() {
        if (!this._genEl) return;
        var sim = this._sim;
        var text = 'Generation: ' + sim.tickCount;
        if (sim.maxTicks > 0) {
            text += ' / ' + sim.maxTicks;
        }
        this._genEl.textContent = text;
    }

    _refreshState() {
        if (!this._stateEl) return;
        var sim = this._sim;
        var state = sim.state;
        var label = state.charAt(0).toUpperCase() + state.slice(1);
        this._stateEl.textContent = label;

        // Remove old state classes
        this._stateEl.className = 'sim-state-indicator';
        this._stateEl.classList.add('sim-state-' + state);
    }

    _syncButtons() {
        var sim = this._sim;
        if (this._playBtn) {
            if (sim.state === 'running') {
                this._playBtn.textContent = '\u23F8 Pause';
            } else {
                this._playBtn.textContent = '\u25B6 Play';
            }
            this._playBtn.disabled = sim.state === 'complete';
        }
        if (this._stepBtn) {
            this._stepBtn.disabled = sim.state === 'running' || sim.state === 'complete';
        }
    }

    _handleStateChange() {
        this._syncButtons();
        this._refreshState();
    }

    _handleTick() {
        this.update();
    }

    _handleReset() {
        this.setStats({});
        this._refreshGeneration();
        this._refreshState();
        this._syncButtons();
    }
}
