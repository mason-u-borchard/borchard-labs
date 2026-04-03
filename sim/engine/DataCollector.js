/**
 * DataCollector — data recording, table UI, and CSV export.
 *
 * Maintains a table of observations as an array of row objects.
 * Renders a scrollable data table below the simulation canvas.
 * Handles CSV generation and browser download.
 *
 * Subclasses define their column list and any experiment-specific formatting.
 */

export class DataCollector {
    /**
     * @param {Object} options
     * @param {string[]} options.columns - Column headers for the data table.
     * @param {string} options.experimentName - Used in the CSV filename.
     */
    constructor(options) {
        this.columns = options.columns || [];
        this.experimentName = options.experimentName || 'experiment';
        this._rows = [];
        this._el = null;
        this._tableBody = null;
        this._countEl = null;
        this._downloadBtn = null;
        this._clearBtn = null;
        this._wrapEl = null;
    }

    /**
     * Add a row of data. Updates the table UI and scrolls to the new row.
     * @param {Object} rowData - Keys should match column names.
     */
    record(rowData) {
        this._rows.push(rowData);
        if (this._tableBody) {
            this._appendRowToDOM(rowData);
            this._updateCounter();
            this._updateButtons();
            this._wrapEl.scrollTop = this._wrapEl.scrollHeight;
        }
    }

    /**
     * Return all recorded data as an array of objects (shallow copy).
     * @returns {Object[]}
     */
    getTable() {
        return this._rows.slice();
    }

    /**
     * Generate a CSV string from the current dataset.
     * Handles quoting for values containing commas, newlines, or double-quotes.
     * Uses CRLF line endings for maximum compatibility.
     * @returns {string}
     */
    toCSV() {
        var lines = [];
        lines.push(this.columns.map(escapeCSVField).join(','));

        for (var i = 0; i < this._rows.length; i++) {
            var row = this._rows[i];
            var fields = [];
            for (var j = 0; j < this.columns.length; j++) {
                var val = row[this.columns[j]];
                var str = (val === null || val === undefined) ? '' : String(val);
                fields.push(escapeCSVField(str));
            }
            lines.push(fields.join(','));
        }

        return lines.join('\r\n') + '\r\n';
    }

    /**
     * Trigger a browser download of the CSV file.
     * @param {string} [filename] - Override filename. Auto-generates if omitted.
     */
    download(filename) {
        if (!filename) {
            var now = new Date();
            var y = now.getFullYear();
            var mo = pad2(now.getMonth() + 1);
            var d = pad2(now.getDate());
            var h = pad2(now.getHours());
            var mi = pad2(now.getMinutes());
            var s = pad2(now.getSeconds());
            filename = this.experimentName + '_' + y + '-' + mo + '-' + d + '_' + h + mi + s + '.csv';
        }

        var csv = this.toCSV();
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }

    /**
     * Clear all recorded data and update the UI.
     */
    clear() {
        this._rows = [];
        if (this._tableBody) {
            while (this._tableBody.firstChild) {
                this._tableBody.removeChild(this._tableBody.firstChild);
            }
            this._updateCounter();
            this._updateButtons();
        }
    }

    /**
     * Build the data table DOM inside the given container.
     * @param {HTMLElement} container
     */
    mount(container) {
        var self = this;

        // Outer wrapper
        var el = document.createElement('div');
        el.className = 'data-collector';
        this._el = el;

        // Header bar
        var header = document.createElement('div');
        header.className = 'data-collector-header';

        var counter = document.createElement('span');
        counter.className = 'data-collector-count';
        this._countEl = counter;

        var downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-sm btn-primary';
        downloadBtn.textContent = 'Download CSV';
        downloadBtn.disabled = true;
        downloadBtn.addEventListener('click', function () {
            self.download();
        });
        this._downloadBtn = downloadBtn;

        var clearBtn = document.createElement('button');
        clearBtn.className = 'btn btn-sm btn-ghost';
        clearBtn.textContent = 'Clear Data';
        clearBtn.disabled = true;
        clearBtn.addEventListener('click', function () {
            self.clear();
        });
        this._clearBtn = clearBtn;

        header.appendChild(counter);
        header.appendChild(downloadBtn);
        header.appendChild(clearBtn);
        el.appendChild(header);

        // Scrollable table container
        var wrap = document.createElement('div');
        wrap.className = 'data-table-wrap';
        wrap.style.maxHeight = '300px';
        wrap.style.overflowY = 'auto';
        this._wrapEl = wrap;

        var table = document.createElement('table');
        table.className = 'data-table';

        // Table head
        var thead = document.createElement('thead');
        var headRow = document.createElement('tr');
        for (var i = 0; i < this.columns.length; i++) {
            var th = document.createElement('th');
            th.textContent = this.columns[i];
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        // Table body
        var tbody = document.createElement('tbody');
        this._tableBody = tbody;
        table.appendChild(tbody);

        // Render any rows that were recorded before mount()
        for (var j = 0; j < this._rows.length; j++) {
            this._appendRowToDOM(this._rows[j]);
        }

        wrap.appendChild(table);
        el.appendChild(wrap);
        container.appendChild(el);

        this._updateCounter();
        this._updateButtons();
    }

    /**
     * Remove all DOM elements created by mount().
     */
    destroy() {
        if (this._el && this._el.parentNode) {
            this._el.parentNode.removeChild(this._el);
        }
        this._el = null;
        this._tableBody = null;
        this._countEl = null;
        this._downloadBtn = null;
        this._clearBtn = null;
        this._wrapEl = null;
    }

    // -- Private helpers --

    /** Append a single row to the table body. */
    _appendRowToDOM(rowData) {
        var tr = document.createElement('tr');
        for (var i = 0; i < this.columns.length; i++) {
            var td = document.createElement('td');
            var val = rowData[this.columns[i]];
            td.textContent = (val === null || val === undefined) ? '' : val;
            tr.appendChild(td);
        }
        this._tableBody.appendChild(tr);
    }

    /** Update the observation counter text. */
    _updateCounter() {
        if (this._countEl) {
            var n = this._rows.length;
            this._countEl.textContent = n + ' observation' + (n === 1 ? '' : 's') + ' recorded';
        }
    }

    /** Enable/disable action buttons based on row count. */
    _updateButtons() {
        var hasData = this._rows.length > 0;
        if (this._downloadBtn) this._downloadBtn.disabled = !hasData;
        if (this._clearBtn) this._clearBtn.disabled = !hasData;
    }
}


// -- Module-level helpers --

/**
 * Escape a value for safe inclusion in a CSV field.
 * Wraps in double-quotes if the value contains a comma, newline, or quote.
 * Internal double-quotes are doubled per RFC 4180.
 */
function escapeCSVField(value) {
    var str = String(value);
    if (str.indexOf('"') !== -1 || str.indexOf(',') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Zero-pad a number to two digits.
 */
function pad2(n) {
    return n < 10 ? '0' + n : String(n);
}
