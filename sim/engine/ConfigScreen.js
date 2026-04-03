/**
 * ConfigScreen — pre-simulation parameter setup UI.
 *
 * Renders a form with experiment-specific parameters before the simulation
 * starts. Each parameter has a label, input, description, and default value.
 * "Start Simulation" button hides the config screen and initializes the sim.
 *
 * Subclasses define their parameter list via getParams().
 */

export class ConfigScreen {
    /**
     * @param {Object} options
     * @param {Function} options.onStart - Called with the config object when the user clicks Start.
     */
    constructor(options) {
        this._onStart = options.onStart;
        this._el = null;
        this._values = {};
        this._inputEls = {};
    }

    /**
     * Return the parameter definitions. Subclasses override this.
     * @returns {Array<{key: string, label: string, type: string, default: *, min?: number, max?: number, step?: number, options?: Array, description?: string, dependsOn?: string}>}
     */
    getParams() {
        return [];
    }

    /**
     * Build the config form DOM inside the given container.
     * @param {HTMLElement} container
     */
    mount(container) {
        var self = this;
        var params = this.getParams();

        // Initialize defaults
        for (var i = 0; i < params.length; i++) {
            this._values[params[i].key] = params[i].default;
        }

        // Root
        var el = document.createElement('div');
        el.className = 'config-screen';
        this._el = el;

        // Heading
        var heading = document.createElement('h3');
        heading.textContent = 'Simulation Parameters';
        el.appendChild(heading);

        // Build a map of checkbox keys to their dependent param keys
        var dependentMap = {};
        for (var i = 0; i < params.length; i++) {
            var dep = params[i].dependsOn;
            if (dep) {
                if (!dependentMap[dep]) dependentMap[dep] = [];
                dependentMap[dep].push(params[i].key);
            }
        }

        // Render each parameter
        for (var i = 0; i < params.length; i++) {
            var param = params[i];
            var row = this._buildParamRow(param, dependentMap);
            el.appendChild(row);
        }

        // Apply initial disabled state for dependsOn params
        for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param.dependsOn && !this._values[param.dependsOn]) {
                this._setParamDisabled(param.key, true);
            }
        }

        // Start button
        var startBtn = document.createElement('button');
        startBtn.className = 'btn btn-primary btn-lg';
        startBtn.textContent = 'Start Simulation';
        startBtn.addEventListener('click', function () {
            self._onStart(self.getValues());
        });
        el.appendChild(startBtn);

        container.appendChild(el);
    }

    /**
     * Get current parameter values as a plain object.
     * @returns {Object}
     */
    getValues() {
        return Object.assign({}, this._values);
    }

    /**
     * Remove DOM elements.
     */
    destroy() {
        if (this._el && this._el.parentNode) {
            this._el.parentNode.removeChild(this._el);
        }
        this._el = null;
        this._inputEls = {};
    }

    // -- Private helpers --

    /**
     * Build a single parameter row.
     * @param {Object} param
     * @param {Object} dependentMap - Maps checkbox keys to arrays of dependent keys.
     * @returns {HTMLElement}
     */
    _buildParamRow(param, dependentMap) {
        var self = this;

        var wrapper = document.createElement('div');
        wrapper.className = 'config-param';
        if (param.dependsOn) {
            wrapper.classList.add('config-param-dependent');
        }
        wrapper.setAttribute('data-param', param.key);

        // Label
        var label = document.createElement('label');
        label.className = 'config-label';
        label.textContent = param.label;
        label.setAttribute('for', 'param-' + param.key);

        var input;

        switch (param.type) {
            case 'checkbox':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.id = 'param-' + param.key;
                input.className = 'config-checkbox';
                input.checked = !!param.default;
                input.addEventListener('change', function () {
                    self._values[param.key] = input.checked;
                    // Toggle dependents
                    var deps = dependentMap[param.key];
                    if (deps) {
                        for (var d = 0; d < deps.length; d++) {
                            self._setParamDisabled(deps[d], !input.checked);
                        }
                    }
                });
                // For checkboxes, put the input before the label text
                wrapper.appendChild(input);
                wrapper.appendChild(label);
                break;

            case 'select':
                input = document.createElement('select');
                input.id = 'param-' + param.key;
                input.className = 'config-select';
                var opts = param.options || [];
                for (var j = 0; j < opts.length; j++) {
                    var opt = document.createElement('option');
                    if (typeof opts[j] === 'object') {
                        opt.value = opts[j].value;
                        opt.textContent = opts[j].label;
                    } else {
                        opt.value = opts[j];
                        opt.textContent = opts[j];
                    }
                    if (String(opts[j].value || opts[j]) === String(param.default)) {
                        opt.selected = true;
                    }
                    input.appendChild(opt);
                }
                input.addEventListener('change', function () {
                    self._values[param.key] = input.value;
                });
                wrapper.appendChild(label);
                wrapper.appendChild(input);
                break;

            case 'range':
                input = document.createElement('input');
                input.type = 'range';
                input.id = 'param-' + param.key;
                input.className = 'config-range';
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
                if (param.step !== undefined) input.step = param.step;
                input.value = param.default;

                var valueDisplay = document.createElement('span');
                valueDisplay.className = 'config-range-value mono';
                valueDisplay.textContent = param.default;

                input.addEventListener('input', function () {
                    var val = parseFloat(input.value);
                    self._values[param.key] = val;
                    valueDisplay.textContent = input.value;
                });

                wrapper.appendChild(label);
                var rangeRow = document.createElement('div');
                rangeRow.className = 'config-range-row';
                rangeRow.appendChild(input);
                rangeRow.appendChild(valueDisplay);
                wrapper.appendChild(rangeRow);
                break;

            default: // 'number' and fallback
                input = document.createElement('input');
                input.type = 'number';
                input.id = 'param-' + param.key;
                input.className = 'config-number';
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
                if (param.step !== undefined) input.step = param.step;
                input.value = param.default;
                input.addEventListener('input', function () {
                    var val = parseFloat(input.value);
                    if (!isNaN(val)) {
                        self._values[param.key] = val;
                    }
                });
                wrapper.appendChild(label);
                wrapper.appendChild(input);
                break;
        }

        // Description text
        if (param.description) {
            var desc = document.createElement('p');
            desc.className = 'config-description text-small text-muted';
            desc.textContent = param.description;
            wrapper.appendChild(desc);
        }

        this._inputEls[param.key] = { wrapper: wrapper, input: input };
        return wrapper;
    }

    /**
     * Enable or disable a parameter's input and visual state.
     * @param {string} key
     * @param {boolean} disabled
     */
    _setParamDisabled(key, disabled) {
        var entry = this._inputEls[key];
        if (!entry) return;
        entry.input.disabled = disabled;
        if (disabled) {
            entry.wrapper.classList.add('config-param-disabled');
        } else {
            entry.wrapper.classList.remove('config-param-disabled');
        }
    }
}
