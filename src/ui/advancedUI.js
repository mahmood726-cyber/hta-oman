/**
 * Advanced Features UI Module for HTA Artifact Standard v0.2
 *
 * Adds UI support for:
 * - Microsimulation
 * - EVPPI with metamodeling
 * - Model Calibration
 * - Survival Curve Fitting
 * - Discrete Event Simulation (DES)
 */

class AdvancedFeaturesUI {
    constructor(app) {
        this.app = app;
        this.survivalEngine = null;
        this.microsimEngine = null;
        this.desEngine = null;
        this.calibrationEngine = null;
        this.evppiCalculator = null;

        this.initEngines();
        this.setupEventListeners();
    }

    initEngines() {
        // Initialize engines if available
        if (typeof SurvivalAnalysisEngine !== 'undefined') {
            this.survivalEngine = new SurvivalAnalysisEngine();
        }
        if (typeof MicrosimulationEngine !== 'undefined') {
            this.microsimEngine = new MicrosimulationEngine();
        }
        if (typeof DiscreteEventSimulationEngine !== 'undefined') {
            this.desEngine = new DiscreteEventSimulationEngine();
        }
        if (typeof CalibrationEngine !== 'undefined') {
            this.calibrationEngine = new CalibrationEngine();
        }
        if (typeof EVPPICalculator !== 'undefined') {
            this.evppiCalculator = new EVPPICalculator();
        }
    }

    setupEventListeners() {
        // Microsimulation
        const microsimBtn = document.getElementById('btn-run-microsim');
        if (microsimBtn) {
            microsimBtn.addEventListener('click', () => this.runMicrosimulation());
        }

        // Survival Fitting
        const survivalBtn = document.getElementById('btn-fit-survival');
        if (survivalBtn) {
            survivalBtn.addEventListener('click', () => this.fitSurvivalCurves());
        }

        // DES
        const desBtn = document.getElementById('btn-run-des');
        if (desBtn) {
            desBtn.addEventListener('click', () => this.runDES());
        }

        // Calibration
        const calibrationBtn = document.getElementById('btn-run-calibration');
        if (calibrationBtn) {
            calibrationBtn.addEventListener('click', () => this.runCalibration());
        }

        // EVPPI
        const evppiBtn = document.getElementById('btn-calc-evppi');
        if (evppiBtn) {
            evppiBtn.addEventListener('click', () => this.calculateEVPPI());
        }

        // KM Data import
        const kmImportBtn = document.getElementById('btn-import-km');
        if (kmImportBtn) {
            kmImportBtn.addEventListener('click', () => this.importKaplanMeier());
        }

        // File input for KM data
        const kmFileInput = document.getElementById('km-file-input');
        if (kmFileInput) {
            kmFileInput.addEventListener('change', (e) => this.handleKMFileUpload(e));
        }
    }

    // ============ MICROSIMULATION ============

    async runMicrosimulation() {
        if (!this.app.project) {
            this.app.showToast('No model loaded', 'error');
            return;
        }

        if (!this.microsimEngine) {
            this.app.showToast('Microsimulation engine not available', 'error');
            return;
        }

        const numPatients = parseInt(document.getElementById('microsim-patients')?.value || '10000');
        const recordHistory = document.getElementById('microsim-record-history')?.checked || false;
        const seed = parseInt(document.getElementById('microsim-seed')?.value || '12345');

        this.app.showLoading('Running microsimulation...');
        const progressBar = document.getElementById('microsim-progress-bar');
        const progressText = document.getElementById('microsim-progress-text');
        document.getElementById('microsim-progress').style.display = 'block';

        try {
            this.microsimEngine.options = {
                patients: numPatients,
                seed: seed,
                recordHistory: recordHistory
            };

            this.microsimEngine.onProgress = (current, total) => {
                const pct = Math.round((current / total) * 100);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressText) progressText.textContent = `${pct}%`;
            };

            // Get strategy overrides
            const strategies = this.app.project.strategies || {};
            let intOverrides = {}, compOverrides = {};

            for (const [id, strat] of Object.entries(strategies)) {
                if (strat.is_comparator) {
                    compOverrides = strat.parameter_overrides || {};
                } else {
                    intOverrides = strat.parameter_overrides || {};
                }
            }

            const results = await this.microsimEngine.run(this.app.project, intOverrides, compOverrides);

            this.displayMicrosimResults(results);
            this.app.hideLoading();
            document.getElementById('microsim-progress').style.display = 'none';
            this.app.showToast(`Microsimulation complete (${numPatients} patients)`, 'success');

        } catch (e) {
            this.app.hideLoading();
            document.getElementById('microsim-progress').style.display = 'none';
            this.app.showToast(`Error: ${e.message}`, 'error');
        }
    }

    displayMicrosimResults(results) {
        const container = document.getElementById('microsim-results');
        if (!container) return;

        container.style.display = 'block';

        // Summary statistics - handle both camelCase and snake_case property names
        const s = results.summary || {};
        const meanCost = s.meanCost ?? s.mean_costs;
        const meanQaly = s.meanQALY ?? s.mean_qalys;
        const meanLy = s.meanLY ?? s.mean_lys;

        document.getElementById('microsim-mean-cost').textContent =
            Number.isFinite(meanCost) ? this.app.formatCurrency(meanCost, 2) : '-';
        document.getElementById('microsim-mean-qaly').textContent =
            Number.isFinite(meanQaly) ? meanQaly.toFixed(4) : '-';
        document.getElementById('microsim-mean-ly').textContent =
            Number.isFinite(meanLy) ? meanLy.toFixed(2) : '-';

        // Handle CI as array or as separate lower/upper properties
        const costCiLower = s.costCI?.[0] ?? s.ci_costs_lower;
        const costCiUpper = s.costCI?.[1] ?? s.ci_costs_upper;
        if (Number.isFinite(costCiLower) && Number.isFinite(costCiUpper)) {
            document.getElementById('microsim-cost-ci').textContent =
                `[${this.app.formatCurrency(costCiLower, 0)} - ${this.app.formatCurrency(costCiUpper, 0)}]`;
        }

        const qalyCiLower = s.qalyCI?.[0] ?? s.ci_qalys_lower;
        const qalyCiUpper = s.qalyCI?.[1] ?? s.ci_qalys_upper;
        if (Number.isFinite(qalyCiLower) && Number.isFinite(qalyCiUpper)) {
            document.getElementById('microsim-qaly-ci').textContent =
                `[${qalyCiLower.toFixed(4)} - ${qalyCiUpper.toFixed(4)}]`;
        }

        // State time distribution
        if (results.stateTimeDistribution) {
            this.renderStateTimeChart(results.stateTimeDistribution);
        }

        // Trace comparison
        if (results.intervention && results.comparator) {
            this.renderMicrosimTraceComparison(results);
        }
    }

    renderStateTimeChart(distribution) {
        const ctx = document.getElementById('microsim-state-chart');
        if (!ctx) return;

        if (this.app.charts.microsimState) {
            this.app.charts.microsimState.destroy();
        }

        const labels = Object.keys(distribution);
        const data = Object.values(distribution).map(d => d.mean);

        this.app.charts.microsimState = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Mean Time in State',
                    data: data,
                    backgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { title: { display: true, text: 'Years' } }
                }
            }
        });
    }

    renderMicrosimTraceComparison(results) {
        const ctx = document.getElementById('microsim-trace-chart');
        if (!ctx) return;

        if (this.app.charts.microsimTrace) {
            this.app.charts.microsimTrace.destroy();
        }

        const intTrace = results.intervention.trace;
        const compTrace = results.comparator.trace;

        const datasets = [];
        const colors = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6'];

        // Add traces for each state
        const stateNames = Object.keys(intTrace);
        stateNames.forEach((state, i) => {
            const color = colors[i % colors.length];
            datasets.push({
                label: `Int: ${state}`,
                data: intTrace[state].map((v, j) => ({ x: j, y: v })),
                borderColor: color,
                fill: false,
                tension: 0.1
            });
            datasets.push({
                label: `Comp: ${state}`,
                data: compTrace[state].map((v, j) => ({ x: j, y: v })),
                borderColor: color,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1
            });
        });

        this.app.charts.microsimTrace = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'Cycle' } },
                    y: { title: { display: true, text: 'Proportion' }, min: 0, max: 1 }
                }
            }
        });
    }

    // ============ SURVIVAL CURVE FITTING ============

    importKaplanMeier() {
        const input = document.getElementById('km-file-input');
        if (input) input.click();
    }

    async handleKMFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            let data;

            if (file.name.endsWith('.json')) {
                data = JSON.parse(text);
            } else if (file.name.endsWith('.csv')) {
                data = this.parseCSV(text);
            } else {
                throw new Error('Unsupported file format. Use .json or .csv');
            }

            this.kmData = this.survivalEngine.importKaplanMeier(data);
            this.displayKMData();
            this.app.showToast('Kaplan-Meier data imported', 'success');

        } catch (error) {
            this.app.showToast(`Error: ${error.message}`, 'error');
        }
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const timeIdx = header.findIndex(h => h === 'time' || h === 't');
        const survIdx = header.findIndex(h => h === 'survival' || h === 's' || h === 'surv');
        const riskIdx = header.findIndex(h => h === 'atrisk' || h === 'n' || h === 'at_risk');

        if (timeIdx === -1 || survIdx === -1) {
            throw new Error('CSV must have time and survival columns');
        }

        return lines.slice(1).map(line => {
            const parts = line.split(',').map(p => parseFloat(p.trim()));
            return {
                time: parts[timeIdx],
                survival: parts[survIdx],
                atRisk: riskIdx >= 0 ? parts[riskIdx] : undefined
            };
        }).filter(p => !isNaN(p.time) && !isNaN(p.survival));
    }

    displayKMData() {
        const container = document.getElementById('km-data-summary');
        if (!container || !this.kmData) return;

        container.innerHTML = `
            <p><strong>Points:</strong> ${this.kmData.points.length}</p>
            <p><strong>Total Patients:</strong> ${this.kmData.raw.totalPatients}</p>
            <p><strong>Total Events:</strong> ${this.kmData.raw.totalEvents}</p>
            <p><strong>Median Survival:</strong> ${this.kmData.medianSurvival?.toFixed(2) || 'Not reached'}</p>
            <p><strong>RMST:</strong> ${this.kmData.meanSurvival?.toFixed(2)}</p>
        `;

        this.renderKMChart();
    }

    renderKMChart() {
        const ctx = document.getElementById('km-chart');
        if (!ctx || !this.kmData) return;

        if (this.app.charts.km) {
            this.app.charts.km.destroy();
        }

        const data = this.kmData.points.map(p => ({ x: p.time, y: p.survival }));

        this.app.charts.km = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Kaplan-Meier',
                    data: data,
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb20',
                    stepped: 'before',
                    fill: true,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'Time' } },
                    y: { min: 0, max: 1, title: { display: true, text: 'Survival Probability' } }
                }
            }
        });
    }

    async fitSurvivalCurves() {
        if (!this.kmData) {
            this.app.showToast('Import Kaplan-Meier data first', 'warning');
            return;
        }

        if (!this.survivalEngine) {
            this.app.showToast('Survival engine not available', 'error');
            return;
        }

        this.app.showLoading('Fitting survival curves...');

        try {
            const distributions = [];
            const checkboxes = document.querySelectorAll('.dist-checkbox:checked');
            checkboxes.forEach(cb => distributions.push(cb.value));

            if (distributions.length === 0) {
                distributions.push('exponential', 'weibull', 'lognormal', 'loglogistic', 'gompertz', 'gamma');
            }

            this.survivalFitResults = this.survivalEngine.fitAllDistributions(this.kmData, {
                distributions
            });

            this.displaySurvivalFitResults();
            this.app.hideLoading();
            this.app.showToast('Survival curves fitted', 'success');

        } catch (e) {
            this.app.hideLoading();
            this.app.showToast(`Error: ${e.message}`, 'error');
        }
    }

    displaySurvivalFitResults() {
        const container = document.getElementById('survival-fit-results');
        if (!container || !this.survivalFitResults) return;

        container.style.display = 'block';

        // Best model
        const best = this.survivalFitResults.best;
        document.getElementById('best-model').textContent = best?.distribution || '-';
        document.getElementById('best-aic').textContent = best?.aic?.toFixed(2) || '-';
        document.getElementById('best-bic').textContent = best?.bic?.toFixed(2) || '-';
        document.getElementById('best-r2').textContent = best?.r2?.toFixed(4) || '-';

        // Recommendation
        document.getElementById('model-recommendation').textContent =
            this.survivalFitResults.recommendation || '';

        // Fit comparison table
        const tbody = document.getElementById('survival-fit-body');
        let html = '';
        for (const result of this.survivalFitResults.ranked) {
            const deltaAIC = result.deltaAIC?.toFixed(2) || '0.00';
            html += `
                <tr class="${result.rank === 1 ? 'best-fit' : ''}">
                    <td>${result.rank}</td>
                    <td>${result.distribution}</td>
                    <td>${result.aic?.toFixed(2) || '-'}</td>
                    <td>${result.bic?.toFixed(2) || '-'}</td>
                    <td>${deltaAIC}</td>
                    <td>${result.r2?.toFixed(4) || '-'}</td>
                    <td>${result.convergence ? '✓' : '✗'}</td>
                </tr>
            `;
        }
        tbody.innerHTML = html;

        // Render comparison chart
        this.renderSurvivalComparisonChart();
    }

    renderSurvivalComparisonChart() {
        const ctx = document.getElementById('survival-comparison-chart');
        if (!ctx || !this.survivalFitResults || !this.kmData) return;

        if (this.app.charts.survivalComparison) {
            this.app.charts.survivalComparison.destroy();
        }

        const maxTime = Math.max(...this.kmData.points.map(p => p.time));
        const datasets = [];

        // KM curve
        datasets.push({
            label: 'Kaplan-Meier',
            data: this.kmData.points.map(p => ({ x: p.time, y: p.survival })),
            borderColor: '#000000',
            borderWidth: 2,
            stepped: 'before',
            fill: false,
            pointRadius: 0
        });

        // Fitted curves
        const colors = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899'];
        this.survivalFitResults.ranked.slice(0, 6).forEach((result, i) => {
            if (!result.fitted) return;

            const curve = this.survivalEngine.generateCurve(result.fitted, maxTime * 1.2, 100);
            datasets.push({
                label: result.distribution,
                data: curve.map(p => ({ x: p.time, y: p.survival })),
                borderColor: colors[i],
                borderWidth: 1.5,
                fill: false,
                pointRadius: 0
            });
        });

        this.app.charts.survivalComparison = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'Time' } },
                    y: { min: 0, max: 1, title: { display: true, text: 'Survival Probability' } }
                },
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }

    // ============ DISCRETE EVENT SIMULATION ============

    async runDES() {
        if (!this.app.project) {
            this.app.showToast('No model loaded', 'error');
            return;
        }

        if (!this.desEngine) {
            this.app.showToast('DES engine not available', 'error');
            return;
        }

        const numPatients = parseInt(document.getElementById('des-patients')?.value || '1000');
        const maxTime = parseInt(document.getElementById('des-max-time')?.value || '50');
        const seed = parseInt(document.getElementById('des-seed')?.value || '12345');

        this.app.showLoading('Running DES...');
        const progressBar = document.getElementById('des-progress-bar');
        const progressText = document.getElementById('des-progress-text');
        document.getElementById('des-progress').style.display = 'block';

        try {
            this.desEngine.options = {
                patients: numPatients,
                maxTime: maxTime,
                seed: seed,
                recordHistory: true
            };

            // Convert Markov model to DES model
            const desModel = this.convertToDesModel(this.app.project);
            const guidanceSettings = this.app.getGuidanceSettings();

            const results = await this.desEngine.run(desModel, null, {
                discountRate: guidanceSettings.discount_rate_costs,
                settings: guidanceSettings,
                onProgress: (progress) => {
                    const pct = Math.round(progress.percent);
                    if (progressBar) progressBar.style.width = `${pct}%`;
                    if (progressText) progressText.textContent = `${pct}%`;
                }
            });

            this.displayDESResults(results);
            this.app.hideLoading();
            document.getElementById('des-progress').style.display = 'none';
            this.app.showToast(`DES complete (${numPatients} patients)`, 'success');

        } catch (e) {
            this.app.hideLoading();
            document.getElementById('des-progress').style.display = 'none';
            this.app.showToast(`Error: ${e.message}`, 'error');
            console.error(e);
        }
    }

    convertToDesModel(project) {
        // Convert Markov cohort to DES model structure
        const states = {};
        const events = {};
        const transitions = [];

        // Get parameter values
        const params = {};
        for (const [id, param] of Object.entries(project.parameters || {})) {
            params[id] = typeof param === 'object' ? param.value : param;
        }

        // Convert states
        for (const [id, state] of Object.entries(project.states || {})) {
            const costExpr = state.cost;
            const utilExpr = state.utility;

            let costValue = 0;
            if (typeof costExpr === 'number') {
                costValue = costExpr;
            } else if (typeof costExpr === 'string' && params[costExpr] !== undefined) {
                costValue = params[costExpr];
            }

            let utilValue = 0;
            if (typeof utilExpr === 'number') {
                utilValue = utilExpr;
            } else if (typeof utilExpr === 'string' && params[utilExpr] !== undefined) {
                utilValue = params[utilExpr];
            }

            states[id] = {
                costPerTime: costValue,
                utilityPerTime: utilValue,
                terminal: state.type === 'absorbing',
                scheduledEvents: []
            };
        }

        // Convert transitions to events
        for (const [id, trans] of Object.entries(project.transitions || {})) {
            const from = trans.from;
            const to = trans.to;

            if (from === to) continue; // Skip self-loops

            let prob = 0;
            if (typeof trans.probability === 'number') {
                prob = trans.probability;
            } else if (typeof trans.probability === 'string') {
                try {
                    prob = this.evaluateExpression(trans.probability, params);
                } catch (e) {
                    prob = 0.1; // Default
                }
            }

            if (prob > 0 && prob < 1) {
                const eventName = `${from}_to_${to}`;
                const rate = -Math.log(1 - prob); // Convert probability to rate

                events[eventName] = {
                    cost: 0
                };

                // Add to state's scheduled events
                if (states[from] && !states[from].terminal) {
                    states[from].scheduledEvents.push({
                        event: eventName,
                        distribution: 'exponential',
                        parameters: { rate: rate }
                    });
                }

                transitions.push({
                    trigger: eventName,
                    from: from,
                    to: to
                });
            }
        }

        // Determine initial state
        let initialState = 'stable';
        for (const [id, state] of Object.entries(project.states || {})) {
            if (state.initial_probability > 0) {
                initialState = id;
                break;
            }
        }

        return {
            initialState,
            states,
            events,
            transitions
        };
    }

    evaluateExpression(expr, params) {
        // Use safe expression parser instead of eval()
        if (typeof ExpressionParser !== 'undefined' && ExpressionParser.evaluate) {
            try {
                return ExpressionParser.evaluate(expr, params);
            } catch (e) {
                console.warn(`Expression evaluation failed for "${expr}":`, e.message);
                return 0;
            }
        }
        // Fallback: simple numeric parsing if expression is just a number
        const num = parseFloat(expr);
        return isNaN(num) ? 0 : num;
    }

    displayDESResults(results) {
        const container = document.getElementById('des-results');
        if (!container) return;

        container.style.display = 'block';

        const s = results.summary;
        const meanCost = s.meanDiscountedCost ?? s.meanCost;
        document.getElementById('des-mean-cost').textContent =
            Number.isFinite(meanCost) ? this.app.formatCurrency(meanCost, 2) : '-';
        document.getElementById('des-mean-qaly').textContent = (s.meanDiscountedQALY || s.meanQALY)?.toFixed(4);
        document.getElementById('des-mean-ly').textContent = s.meanLY?.toFixed(2);

        // State statistics
        const stateBody = document.getElementById('des-state-stats-body');
        let stateHtml = '';
        for (const [name, stats] of Object.entries(results.stateStatistics || {})) {
            stateHtml += `
                <tr>
                    <td>${name}</td>
                    <td>${stats.entries}</td>
                    <td>${stats.meanTime?.toFixed(2) || '-'}</td>
                    <td>${stats.totalTime?.toFixed(2) || '-'}</td>
                </tr>
            `;
        }
        if (stateBody) stateBody.innerHTML = stateHtml;

        // Event statistics
        const eventBody = document.getElementById('des-event-stats-body');
        let eventHtml = '';
        for (const [name, stats] of Object.entries(results.eventStatistics || {})) {
            eventHtml += `
                <tr>
                    <td>${name}</td>
                    <td>${stats.count}</td>
                    <td>${stats.meanTime?.toFixed(2) || '-'}</td>
                </tr>
            `;
        }
        if (eventBody) eventBody.innerHTML = eventHtml;
    }

    // ============ MODEL CALIBRATION ============

    async runCalibration() {
        if (!this.app.project) {
            this.app.showToast('No model loaded', 'error');
            return;
        }

        if (!this.calibrationEngine) {
            this.app.showToast('Calibration engine not available', 'error');
            return;
        }

        // Get calibration settings
        const method = document.getElementById('calibration-method')?.value || 'nelder-mead';
        const maxIter = parseInt(document.getElementById('calibration-iterations')?.value || '1000');

        // Get calibration parameters and targets from UI
        const calibParams = this.getCalibrationParameters();
        const targets = this.getCalibrationTargets();

        if (calibParams.length === 0 || targets.length === 0) {
            this.app.showToast('Define calibration parameters and targets', 'warning');
            return;
        }

        this.app.showLoading(`Running calibration (${method})...`);
        document.getElementById('calibration-progress').style.display = 'block';

        try {
            this.calibrationEngine.onProgress = (iteration, maxIter, currentFit) => {
                const pct = Math.round((iteration / maxIter) * 100);
                const bar = document.getElementById('calibration-progress-bar');
                const text = document.getElementById('calibration-progress-text');
                if (bar) bar.style.width = `${pct}%`;
                if (text) text.textContent = `${pct}% (fit: ${currentFit?.toFixed(4) || '-'})`;
            };

            const results = await this.calibrationEngine.calibrate(
                this.app.project,
                calibParams,
                targets,
                { method, maxIterations: maxIter }
            );

            this.displayCalibrationResults(results);
            this.app.hideLoading();
            document.getElementById('calibration-progress').style.display = 'none';
            this.app.showToast('Calibration complete', 'success');

        } catch (e) {
            this.app.hideLoading();
            document.getElementById('calibration-progress').style.display = 'none';
            this.app.showToast(`Error: ${e.message}`, 'error');
        }
    }

    getCalibrationParameters() {
        // Parse calibration parameters from UI
        const params = [];
        const rows = document.querySelectorAll('.calibration-param-row');

        rows.forEach(row => {
            const name = row.querySelector('.calib-param-name')?.value;
            const lower = parseFloat(row.querySelector('.calib-param-lower')?.value);
            const upper = parseFloat(row.querySelector('.calib-param-upper')?.value);

            if (name && !isNaN(lower) && !isNaN(upper)) {
                params.push({ name, bounds: [lower, upper] });
            }
        });

        return params;
    }

    getCalibrationTargets() {
        // Parse calibration targets from UI
        const targets = [];
        const rows = document.querySelectorAll('.calibration-target-row');

        rows.forEach(row => {
            const name = row.querySelector('.calib-target-name')?.value;
            const observed = parseFloat(row.querySelector('.calib-target-observed')?.value);
            const type = row.querySelector('.calib-target-type')?.value || 'state_proportion';
            const time = parseFloat(row.querySelector('.calib-target-time')?.value);
            const weight = parseFloat(row.querySelector('.calib-target-weight')?.value) || 1;

            if (name && !isNaN(observed)) {
                targets.push({ name, observed, type, time, weight });
            }
        });

        return targets;
    }

    displayCalibrationResults(results) {
        const container = document.getElementById('calibration-results');
        if (!container) return;

        container.style.display = 'block';

        // Summary
        document.getElementById('calib-converged').textContent = results.converged ? 'Yes' : 'No';
        document.getElementById('calib-iterations').textContent = results.iterations;
        document.getElementById('calib-log-likelihood').textContent = results.logLikelihood?.toFixed(4) || '-';

        // Goodness of fit
        const gof = results.goodnessOfFit;
        if (gof) {
            document.getElementById('calib-r2').textContent = gof.r2?.toFixed(4) || '-';
            document.getElementById('calib-rmse').textContent = gof.rmse?.toFixed(4) || '-';
            document.getElementById('calib-aic').textContent = gof.aic?.toFixed(2) || '-';
            document.getElementById('calib-bic').textContent = gof.bic?.toFixed(2) || '-';
        }

        // Calibrated parameters
        const paramBody = document.getElementById('calib-param-results-body');
        let paramHtml = '';
        for (const [name, value] of Object.entries(results.calibratedParameters || {})) {
            const original = this.app.project.parameters[name]?.value || '-';
            paramHtml += `
                <tr>
                    <td>${name}</td>
                    <td>${original}</td>
                    <td><strong>${value.toFixed(6)}</strong></td>
                    <td>${results.uncertainty?.[name]?.se?.toFixed(6) || '-'}</td>
                </tr>
            `;
        }
        if (paramBody) paramBody.innerHTML = paramHtml;

        // Target comparison
        const targetBody = document.getElementById('calib-target-results-body');
        let targetHtml = '';
        for (const target of results.targetComparison || []) {
            const diff = target.predicted - target.observed;
            const pctDiff = (diff / target.observed * 100).toFixed(1);
            targetHtml += `
                <tr>
                    <td>${target.name}</td>
                    <td>${target.observed.toFixed(4)}</td>
                    <td>${target.predicted.toFixed(4)}</td>
                    <td class="${Math.abs(diff) < 0.01 ? 'good-fit' : 'poor-fit'}">${pctDiff}%</td>
                </tr>
            `;
        }
        if (targetBody) targetBody.innerHTML = targetHtml;
    }

    // ============ EVPPI CALCULATION ============

    async calculateEVPPI() {
        if (!this.app.psaResults?.scatter) {
            this.app.showToast('Run PSA first to calculate EVPPI', 'warning');
            return;
        }

        if (!this.evppiCalculator) {
            this.app.showToast('EVPPI calculator not available', 'error');
            return;
        }

        const primaryWtp = this.app.psaResults?.primary_wtp || this.app.getPrimaryWtp();
        const wtpInput = document.getElementById('evppi-wtp');
        const parsedWtp = wtpInput ? parseFloat(wtpInput.value) : NaN;
        const wtp = Number.isFinite(parsedWtp) ? parsedWtp : primaryWtp;

        this.app.showLoading('Calculating EVPPI...');

        try {
            if (wtpInput && !Number.isFinite(parsedWtp)) {
                wtpInput.value = String(Math.round(wtp));
            }
            // Get parameter samples from PSA
            const parameterSamples = this.app.psaResults.parameterSamples || {};

            // Calculate EVPPI for all parameters
            const results = this.evppiCalculator.calculateAll(
                this.app.psaResults,
                wtp,
                parameterSamples
            );

            this.displayEVPPIResults(results);
            this.app.hideLoading();
            this.app.showToast('EVPPI calculated', 'success');

        } catch (e) {
            this.app.hideLoading();
            this.app.showToast(`Error: ${e.message}`, 'error');
        }
    }

    displayEVPPIResults(results) {
        const container = document.getElementById('evppi-results');
        if (!container) return;

        container.style.display = 'block';

        // Total EVPI
        document.getElementById('evppi-total-evpi').textContent =
            Number.isFinite(results.evpi) ? this.app.formatCurrency(results.evpi, 2) : '-';

        // EVPPI table
        const tbody = document.getElementById('evppi-results-body');
        let html = '';

        for (const param of results.parameters || []) {
            const pctOfEvpi = ((param.evppi / results.evpi) * 100).toFixed(1);
            html += `
                <tr>
                    <td>${param.rank}</td>
                    <td>${param.parameter}</td>
                    <td>${this.app.formatCurrency(param.evppi, 2)}</td>
                    <td>${pctOfEvpi}%</td>
                    <td>${this.getResearchPriority(pctOfEvpi)}</td>
                </tr>
            `;
        }
        if (tbody) tbody.innerHTML = html;

        // Render EVPPI chart
        this.renderEVPPIChart(results);
    }

    getResearchPriority(pctOfEvpi) {
        const pct = parseFloat(pctOfEvpi);
        if (pct >= 20) return '<span class="priority-high">High</span>';
        if (pct >= 10) return '<span class="priority-medium">Medium</span>';
        return '<span class="priority-low">Low</span>';
    }

    renderEVPPIChart(results) {
        const ctx = document.getElementById('evppi-chart');
        if (!ctx) return;
        const settings = this.app.getGuidanceSettings();
        const currency = settings.currency;

        if (this.app.charts.evppi) {
            this.app.charts.evppi.destroy();
        }

        const topParams = (results.parameters || []).slice(0, 10);
        const labels = topParams.map(p => p.parameter);
        const data = topParams.map(p => p.evppi);

        this.app.charts.evppi = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `EVPPI (${currency})`,
                    data: data,
                    backgroundColor: '#2563eb'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: `EVPPI (${currency} per patient)` } }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Top 10 Parameters by EVPPI' }
                }
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for main app to initialize
    setTimeout(() => {
        const app = window.app || window.htaApp;
        if (app) {
            window.advancedUI = new AdvancedFeaturesUI(app);
            // Also attach to app for easy access
            app.advancedUI = window.advancedUI;
        }
    }, 100);
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedFeaturesUI };
}

if (typeof window !== 'undefined') {
    window.AdvancedFeaturesUI = AdvancedFeaturesUI;
}
