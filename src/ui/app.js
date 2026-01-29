/**
 * HTA Artifact Standard - Main Application
 * Reviewer Mode UI Controller
 */

const OmanGuidance = (typeof globalThis !== 'undefined' && globalThis.OmanHTAGuidance)
    ? globalThis.OmanHTAGuidance
    : null;

var guidanceDefaults = OmanGuidance?.defaults || {
    discount_rate_costs: 0.03,
    discount_rate_qalys: 0.03,
    currency: 'OMR',
    perspective: 'healthcare_system',
    bia_horizon_years: 4,
    bia_discount_rate: 0,
    wtp_multipliers: [1, 2, 3],
    placeholder_gdp_per_capita_omr: 8100,
    gdp_per_capita_year: 2023,
    gdp_per_capita_source: 'GCC Statistical Centre',
    gdp_per_capita_confirmed: false
};

function normalizeSettings(settings) {
    if (OmanGuidance?.normalizeSettings) {
        return OmanGuidance.normalizeSettings(settings);
    }
    const s = settings || {};
    return {
        ...s,
        discount_rate_costs: s.discount_rate_costs ?? guidanceDefaults.discount_rate_costs,
        discount_rate_qalys: s.discount_rate_qalys ?? guidanceDefaults.discount_rate_qalys,
        currency: s.currency || guidanceDefaults.currency,
        perspective: s.perspective || guidanceDefaults.perspective,
        bia_horizon_years: s.bia_horizon_years ?? guidanceDefaults.bia_horizon_years,
        bia_discount_rate: s.bia_discount_rate ?? guidanceDefaults.bia_discount_rate,
        gdp_per_capita_omr: s.gdp_per_capita_omr,
        gdp_per_capita_year: s.gdp_per_capita_year ?? guidanceDefaults.gdp_per_capita_year,
        gdp_per_capita_source: s.gdp_per_capita_source || guidanceDefaults.gdp_per_capita_source,
        gdp_per_capita_confirmed: Boolean(s.gdp_per_capita_confirmed),
        wtp_thresholds: s.wtp_thresholds,
        wtp_multipliers: Array.isArray(s.wtp_multipliers) && s.wtp_multipliers.length
            ? s.wtp_multipliers
            : guidanceDefaults.wtp_multipliers
    };
}

function resolveWtpThresholds(settings) {
    if (OmanGuidance?.resolveWtpThresholds) {
        return OmanGuidance.resolveWtpThresholds(settings).thresholds;
    }
    const explicit = Array.isArray(settings?.wtp_thresholds) ? settings.wtp_thresholds : null;
    if (explicit && explicit.length) return explicit;
    const base = settings?.gdp_per_capita_omr || guidanceDefaults.placeholder_gdp_per_capita_omr;
    const multipliers = Array.isArray(settings?.wtp_multipliers) && settings.wtp_multipliers.length
        ? settings.wtp_multipliers
        : guidanceDefaults.wtp_multipliers;
    return multipliers.map((m) => base * m);
}

function resolvePrimaryWtp(settings) {
    const thresholds = resolveWtpThresholds(settings);
    return thresholds[0];
}

function currencyCode(settings) {
    return settings?.currency || guidanceDefaults.currency;
}

function formatCurrencyValue(value, settings, digits = 0) {
    if (!Number.isFinite(value)) return String(value ?? '-');
    if (OmanGuidance?.formatCurrency) {
        return OmanGuidance.formatCurrency(value, settings, { maximumFractionDigits: digits });
    }
    const code = currencyCode(settings);
    return `${code} ${value.toLocaleString('en-US', { maximumFractionDigits: digits })}`;
}

function formatWtpLabel(wtp, settings) {
    const code = currencyCode(settings);
    const n = Number(wtp);
    if (!Number.isFinite(n)) return `${code} -`;
    if (Math.abs(n) >= 1000) {
        return `${code} ${(n / 1000).toFixed(0)}k`;
    }
    return `${code} ${n.toLocaleString('en-US')}`;
}

class HTAApp {
    constructor() {
        this.project = null;
        this.results = null;
        this.psaResults = null;
        this.dsaResults = null;
        this.evpiResults = null;
        this.validationResults = null;
        this.proofResults = null;
        this.biaResults = null;
        this.currentSection = 'summary';
        this.charts = {};

        this.validator = new HTAValidator();
        this.proofEngine = typeof ProofCarrying !== 'undefined' ? ProofCarrying : null;

        // Engine registration
        this.engines = {
            'markov_cohort': new MarkovEngine(),
            'partitioned_survival': typeof PartitionedSurvivalEngine !== 'undefined' ? new PartitionedSurvivalEngine() : null,
            'microsimulation': typeof MicrosimulationEngine !== 'undefined' ? new MicrosimulationEngine() : null,
            'des': typeof DESEngine !== 'undefined' ? new DESEngine() : null
        };
        // Filter out unavailable engines
        this.engines = Object.fromEntries(Object.entries(this.engines).filter(([_, v]) => v !== null));


        this.psaEngine = new PSAEngine();
        this.dsaEngine = typeof DSAEngine !== 'undefined' ? new DSAEngine() : null;
        this.evpiCalculator = typeof EVPICalculator !== 'undefined' ? new EVPICalculator() : null;
        this.biaCalculator = typeof BudgetImpactCalculator !== 'undefined' ? new BudgetImpactCalculator() : null;
        this.auditLogger = typeof getAuditLogger !== 'undefined' ? getAuditLogger() : null;

        this.init();
    }

    init() {
        this.setupDropZone();
        this.setupNavigation();
        this.setupButtons();
        this.setupTabs();
        this.setupSubmissionMetadata();
    }

    getGuidanceSettings() {
        return normalizeSettings(this.project?.settings || {});
    }

    getPrimaryWtp() {
        return resolvePrimaryWtp(this.getGuidanceSettings());
    }

    getWtpThresholds() {
        return resolveWtpThresholds(this.getGuidanceSettings());
    }

    formatCurrency(value, digits = 0) {
        return formatCurrencyValue(value, this.getGuidanceSettings(), digits);
    }

    updateProofResults() {
        if (!this.proofEngine || !this.results) {
            this.proofResults = null;
            return;
        }
        this.proofResults = this.proofEngine.verifyDeterministicResults(
            this.results,
            this.project,
            this.getGuidanceSettings()
        );
    }

    applyGuidanceToUI() {
        if (!this.project) return;
        const settings = this.getGuidanceSettings();
        this.project.settings = { ...this.project.settings, ...settings };

        const primaryWtp = this.getPrimaryWtp();
        for (const id of ['evpi-wtp', 'evppi-wtp']) {
            const input = document.getElementById(id);
            if (input && (!input.value || Number(input.value) === 30000)) {
                input.value = String(Math.round(primaryWtp));
            }
        }

        const desDiscount = document.getElementById('des-discount');
        if (desDiscount && (!desDiscount.value || Number(desDiscount.value) === 0.035)) {
            desDiscount.value = String(settings.discount_rate_costs);
        }

        const biaYears = document.getElementById('bia-years');
        if (biaYears && (!biaYears.value || Number(biaYears.value) === 4)) {
            biaYears.value = String(settings.bia_horizon_years ?? 4);
        }
        const biaDiscount = document.getElementById('bia-discount');
        if (biaDiscount && (!biaDiscount.value || Number(biaDiscount.value) === 0)) {
            biaDiscount.value = String((settings.bia_discount_rate ?? 0) * 100);
        }
    }

    setupSubmissionMetadata() {
        const bind = (id, handler) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', handler);
        };

        bind('gdp-per-capita', () => {
            if (!this.project) return;
            const value = Number(document.getElementById('gdp-per-capita').value || 0);
            this.updateProjectSettings({ gdp_per_capita_omr: value });
        });

        bind('gdp-year', () => {
            if (!this.project) return;
            const value = Number(document.getElementById('gdp-year').value || 0);
            this.updateProjectSettings({ gdp_per_capita_year: value });
        });

        bind('gdp-source', () => {
            if (!this.project) return;
            const value = document.getElementById('gdp-source').value || '';
            this.updateProjectSettings({ gdp_per_capita_source: value });
        });

        bind('gdp-confirm', () => {
            if (!this.project) return;
            const value = document.getElementById('gdp-confirm').checked;
            this.updateProjectSettings({ gdp_per_capita_confirmed: value });
        });

        bind('bia-horizon', () => {
            if (!this.project) return;
            const value = Number(document.getElementById('bia-horizon').value || 0);
            this.updateProjectSettings({ bia_horizon_years: value });
            const biaYears = document.getElementById('bia-years');
            if (biaYears) biaYears.value = value;
        });

        bind('bia-discount-setting', () => {
            if (!this.project) return;
            const value = Number(document.getElementById('bia-discount-setting').value || 0) / 100;
            this.updateProjectSettings({ bia_discount_rate: value });
            const biaDiscount = document.getElementById('bia-discount');
            if (biaDiscount) biaDiscount.value = (value * 100).toFixed(1);
        });

        bind('meta-coi', () => {
            if (!this.project) return;
            const value = document.getElementById('meta-coi').value || '';
            this.updateProjectMetadata({ conflicts_of_interest: value });
        });

        bind('meta-public-dossier', () => {
            if (!this.project) return;
            const value = document.getElementById('meta-public-dossier').value;
            const available = value === 'yes';
            this.updateProjectMetadata({ public_dossier_available: available });
        });

        bind('meta-public-dossier-url', () => {
            if (!this.project) return;
            const value = document.getElementById('meta-public-dossier-url').value || '';
            this.updateProjectMetadata({ public_dossier_url: value });
        });
    }

    updateProjectSettings(patch) {
        if (!this.project) return;
        this.project.settings = { ...this.project.settings, ...patch };
        if ('bia_horizon_years' in patch || 'bia_discount_rate' in patch) {
            this.biaResults = null;
            const resultsEl = document.getElementById('bia-results');
            if (resultsEl) resultsEl.style.display = 'none';
        }
        this.applyGuidanceToUI();
        this.populateSummary();
        this.validationResults = this.validator._validateProjectObject(this.project);
        this.populateValidation();
    }

    updateProjectMetadata(patch) {
        if (!this.project) return;
        this.project.metadata = { ...(this.project.metadata || {}), ...patch };
        this.populateSummary();
        this.validationResults = this.validator._validateProjectObject(this.project);
        this.populateValidation();
    }

    getSubmissionIssues() {
        const issues = [];
        const settings = this.getGuidanceSettings();
        const meta = this.project?.metadata || {};

        if (!Number.isFinite(settings.gdp_per_capita_omr) || settings.gdp_per_capita_omr <= 0) {
            issues.push({ severity: 'error', message: 'GDP per capita is missing or invalid.' });
        }
        if (!settings.gdp_per_capita_confirmed) {
            issues.push({ severity: 'error', message: 'GDP per capita has not been confirmed for submission.' });
        }
        if (!settings.gdp_per_capita_year) {
            issues.push({ severity: 'warning', message: 'GDP per capita year is missing.' });
        }
        if (!settings.gdp_per_capita_source) {
            issues.push({ severity: 'warning', message: 'GDP per capita source is missing.' });
        }

        const coi = (meta.conflicts_of_interest || meta.coi_statement || '').trim();
        if (!coi) {
            issues.push({ severity: 'error', message: 'Conflict of interest statement is required.' });
        }

        if (meta.public_dossier_available !== true) {
            issues.push({ severity: 'error', message: 'Public dossier availability must be confirmed as Yes.' });
        }

        if (meta.public_dossier_available === true && !(meta.public_dossier_url || '').trim()) {
            issues.push({ severity: 'error', message: 'Public dossier URL is required when availability is Yes.' });
        }

        if (!this.biaResults) {
            issues.push({ severity: 'error', message: 'Budget impact analysis has not been calculated.' });
        } else if (!Number.isFinite(this.biaResults.totalCost) || this.biaResults.totalCost === 0) {
            issues.push({ severity: 'warning', message: 'Budget impact total cost is zero or invalid. Verify inputs.' });
        }

        if (Number.isFinite(settings.bia_horizon_years) && settings.bia_horizon_years !== 4) {
            issues.push({ severity: 'warning', message: 'Budget impact horizon differs from 4 years.' });
        }
        if (Number.isFinite(settings.bia_discount_rate) && settings.bia_discount_rate !== 0) {
            issues.push({ severity: 'warning', message: 'Budget impact discount rate differs from 0%.' });
        }

        return issues;
    }

    populateSubmissionReadiness() {
        const statusEl = document.getElementById('submission-status');
        const issuesEl = document.getElementById('submission-issues');
        if (!statusEl || !issuesEl) return;

        if (!this.project) {
            statusEl.className = 'validation-status warn';
            statusEl.innerHTML = '<span>ℹ️</span> Load a model to assess readiness.';
            issuesEl.innerHTML = '';
            return;
        }

        const issues = this.getSubmissionIssues();
        const hasErrors = issues.some((i) => i.severity === 'error');
        const statusClass = hasErrors ? 'fail' : (issues.length ? 'warn' : 'pass');
        statusEl.className = `validation-status ${statusClass}`;
        statusEl.innerHTML = `<span>${hasErrors ? '❌' : (issues.length ? '⚠️' : '✅')}</span> ${hasErrors ? 'Not submission-ready' : (issues.length ? 'Ready with warnings' : 'Submission-ready')}`;

        if (!issues.length) {
            issuesEl.innerHTML = '<p style="color: var(--text-muted);">All submission requirements met.</p>';
            return;
        }

        issuesEl.innerHTML = issues.map((issue) => {
            const severity = issue.severity === 'error' ? 'error' : 'warning';
            return `
                <div class="validation-issue ${severity}">
                    <strong>${issue.severity.toUpperCase()}</strong> - ${issue.message}
                </div>
            `;
        }).join('');
    }

    updateBiaDefaultsFromResults() {
        if (!this.results) return;
        const input = document.getElementById('bia-inc-cost');
        if (!input) return;

        const comparison = this.results.incremental?.comparisons?.[0];
        if (!comparison) return;

        const incCost = comparison.incremental_costs;
        if (Number.isFinite(incCost) && (!input.value || Number(input.value) === 0)) {
            input.value = String(Math.round(incCost));
        }
    }

    calculateBudgetImpact() {
        if (!this.biaCalculator) {
            this.showToast('Budget impact calculator not available', 'warning');
            return;
        }

        try {
            const settings = this.getGuidanceSettings();
            const horizon = Number(document.getElementById('bia-years')?.value || settings.bia_horizon_years || 4);
            const discountRate = Number(document.getElementById('bia-discount')?.value || 0) / 100;

            const uptakeRates = [
                Number(document.getElementById('bia-uptake-1')?.value || 0) / 100,
                Number(document.getElementById('bia-uptake-2')?.value || 0) / 100,
                Number(document.getElementById('bia-uptake-3')?.value || 0) / 100,
                Number(document.getElementById('bia-uptake-4')?.value || 0) / 100
            ];

            this.biaResults = this.biaCalculator.calculate({
                population: Number(document.getElementById('bia-population')?.value || 0),
                population_growth_rate: Number(document.getElementById('bia-growth')?.value || 0) / 100,
                years: horizon,
                uptake_rates: uptakeRates,
                incremental_cost_per_patient: Number(document.getElementById('bia-inc-cost')?.value || 0),
                fixed_cost: Number(document.getElementById('bia-fixed-cost')?.value || 0),
                discount_rate: discountRate
            });

            this.displayBudgetImpactResults();
            this.showToast('Budget impact calculated', 'success');

            if (this.auditLogger) {
                this.auditLogger.info('bia', 'Budget impact calculated', {
                    years: this.biaResults.years,
                    totalCost: this.biaResults.totalCost
                });
            }
        } catch (err) {
            this.showToast(`Error: ${err.message}`, 'error');
        }
    }

    displayBudgetImpactResults() {
        const r = this.biaResults;
        if (!r) return;
        const tbody = document.getElementById('bia-results-body');
        const resultsEl = document.getElementById('bia-results');
        if (!tbody || !resultsEl) return;

        const settings = this.getGuidanceSettings();
        tbody.innerHTML = r.rows.map((row) => `
            <tr>
                <td>${row.year}</td>
                <td>${Math.round(row.population).toLocaleString('en-US')}</td>
                <td>${(row.uptake * 100).toFixed(1)}%</td>
                <td>${Math.round(row.treated).toLocaleString('en-US')}</td>
                <td>${this.formatCurrency(row.annualCost, 0)}</td>
                <td>${this.formatCurrency(row.cumulativeCost, 0)}</td>
            </tr>
        `).join('');

        document.getElementById('bia-total-impact').textContent = this.formatCurrency(r.totalCost, 0);
        document.getElementById('bia-year1-impact').textContent = r.rows[0]
            ? this.formatCurrency(r.rows[0].annualCost, 0)
            : '-';

        resultsEl.style.display = 'block';
        this.populateValidation();
    }

    // ============ DROP ZONE & FILE HANDLING ============

    setupDropZone() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.loadFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadFile(e.target.files[0]);
            }
        });
    }

    async loadFile(file) {
        this.showLoading('Loading file...');

        try {
            if (file.name.endsWith('.json')) {
                const text = await file.text();
                const project = JSON.parse(text);
                await this.loadProject(project);
            } else if (file.name.endsWith('.zip') || file.name.endsWith('.hta.zip')) {
                const arrayBuffer = await file.arrayBuffer();
                await this.loadZip(arrayBuffer);
            } else {
                throw new Error('Unsupported file type. Please use .json or .hta.zip');
            }
        } catch (e) {
            this.hideLoading();
            this.showToast(`Error: ${e.message}`, 'error');
        }
    }

    async loadZip(arrayBuffer) {
        this.showLoading('Validating package...');

        // Validate ZIP
        this.validationResults = await this.validator.validateZip(arrayBuffer);

        if (this.validationResults.project) {
            this.project = this.validationResults.project;
            this.proofResults = null;
            this.biaResults = null;
            this.hideLoading();
            this.showMainContent();
            this.populateUI();

            if (!this.validationResults.valid) {
                this.showToast(`Validation completed with ${this.validationResults.errors.length} errors`, 'warning');
            } else if (this.validationResults.warnings.length > 0) {
                this.showToast(`Loaded successfully with ${this.validationResults.warnings.length} warnings`, 'warning');
            } else {
                this.showToast('Model loaded and validated successfully', 'success');
            }
        } else {
            this.hideLoading();
            this.showToast('Failed to load project from ZIP', 'error');
        }
    }

    async loadProject(project) {
        this.showLoading('Validating model...');

        this.project = project;
        this.proofResults = null;
        this.biaResults = null;
        const normalizedSettings = normalizeSettings(project?.settings || {});
        this.project.settings = { ...project.settings, ...normalizedSettings };
        this.applyGuidanceToUI();
        this.validationResults = this.validator._validateProjectObject(this.project);

        this.hideLoading();
        this.showMainContent();
        this.populateUI();

        if (!this.validationResults.valid) {
            this.showToast(`Validation completed with ${this.validationResults.errors.length} errors`, 'warning');
        } else {
            this.showToast('Model loaded successfully', 'success');
        }
    }

    loadDemoModel() {
        const demoProject = this.createDemoProject();
        this.loadProject(demoProject);
    }

    createDemoProject() {
        return {
            version: "0.1",
            metadata: {
                id: "demo_markov_oncology",
                name: "Oncology Drug A vs Standard Care",
                description: "Demonstration Markov cohort model for oncology",
                author: "HTA Standard Demo",
                conflicts_of_interest: "",
                public_dossier_available: false,
                public_dossier_url: "",
                created: new Date().toISOString(),
                version: "1.0.0"
            },
            settings: {
                time_horizon: 40,
                cycle_length: 1,
                discount_rate_costs: guidanceDefaults.discount_rate_costs,
                discount_rate_qalys: guidanceDefaults.discount_rate_qalys,
                half_cycle_correction: "trapezoidal",
                currency: guidanceDefaults.currency,
                perspective: guidanceDefaults.perspective,
                bia_horizon_years: guidanceDefaults.bia_horizon_years,
                bia_discount_rate: guidanceDefaults.bia_discount_rate,
                starting_age: 55,
                gdp_per_capita_omr: guidanceDefaults.placeholder_gdp_per_capita_omr,
                gdp_per_capita_year: guidanceDefaults.gdp_per_capita_year,
                gdp_per_capita_source: guidanceDefaults.gdp_per_capita_source,
                gdp_per_capita_confirmed: guidanceDefaults.gdp_per_capita_confirmed,
                wtp_multipliers: guidanceDefaults.wtp_multipliers
            },
            model: {
                type: "markov_cohort"
            },
            parameters: {
                p_progression_drugA: {
                    value: 0.15,
                    label: "Progression probability (Drug A)",
                    distribution: { type: "beta", alpha: 15, beta: 85 }
                },
                p_progression_soc: {
                    value: 0.25,
                    label: "Progression probability (SoC)",
                    distribution: { type: "beta", alpha: 25, beta: 75 }
                },
                p_death_stable: {
                    value: 0.02,
                    label: "Death probability (Stable)",
                    distribution: { type: "beta", alpha: 2, beta: 98 }
                },
                p_death_progressed: {
                    value: 0.15,
                    label: "Death probability (Progressed)",
                    distribution: { type: "beta", alpha: 15, beta: 85 }
                },
                c_drugA: {
                    value: 5000,
                    label: "Annual cost Drug A",
                    unit: guidanceDefaults.currency,
                    distribution: { type: "gamma", mean: 5000, se: 500 }
                },
                c_soc: {
                    value: 1000,
                    label: "Annual cost SoC",
                    unit: guidanceDefaults.currency,
                    distribution: { type: "gamma", mean: 1000, se: 100 }
                },
                c_progressed: {
                    value: 8000,
                    label: "Annual cost progressed disease",
                    unit: guidanceDefaults.currency,
                    distribution: { type: "gamma", mean: 8000, se: 800 }
                },
                u_stable: {
                    value: 0.85,
                    label: "Utility stable disease",
                    distribution: { type: "beta", alpha: 85, beta: 15 }
                },
                u_progressed: {
                    value: 0.60,
                    label: "Utility progressed disease",
                    distribution: { type: "beta", alpha: 60, beta: 40 }
                }
            },
            states: {
                stable: {
                    label: "Stable Disease",
                    description: "Patient has stable disease under treatment",
                    type: "transient",
                    initial_probability: 1.0,
                    cost: "c_drugA",
                    utility: "u_stable"
                },
                progressed: {
                    label: "Progressed Disease",
                    description: "Patient has progressive disease",
                    type: "transient",
                    initial_probability: 0,
                    cost: "c_progressed",
                    utility: "u_progressed"
                },
                dead: {
                    label: "Dead",
                    description: "Absorbing state",
                    type: "absorbing",
                    initial_probability: 0,
                    cost: 0,
                    utility: 0
                }
            },
            transitions: {
                stable_to_stable: {
                    from: "stable",
                    to: "stable",
                    probability: "1 - p_progression_drugA - p_death_stable"
                },
                stable_to_progressed: {
                    from: "stable",
                    to: "progressed",
                    probability: "p_progression_drugA"
                },
                stable_to_dead: {
                    from: "stable",
                    to: "dead",
                    probability: "p_death_stable"
                },
                progressed_to_progressed: {
                    from: "progressed",
                    to: "progressed",
                    probability: "1 - p_death_progressed"
                },
                progressed_to_dead: {
                    from: "progressed",
                    to: "dead",
                    probability: "p_death_progressed"
                },
                dead_to_dead: {
                    from: "dead",
                    to: "dead",
                    probability: 1.0
                }
            },
            strategies: {
                drug_a: {
                    label: "Drug A",
                    description: "New intervention",
                    is_comparator: false,
                    parameter_overrides: {
                        p_progression_drugA: "p_progression_drugA"
                    }
                },
                soc: {
                    label: "Standard of Care",
                    description: "Comparator",
                    is_comparator: true,
                    parameter_overrides: {
                        c_drugA: "c_soc",
                        p_progression_drugA: "p_progression_soc"
                    }
                }
            },
            evidence: {
                ev_001: {
                    source: "KEYNOTE-001",
                    citation: "Trial data",
                    notes: "Phase III trial"
                }
            }
        };
    }

    // ============ NAVIGATION ============

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.navigateToSection(section);
            });
        });
    }

    navigateToSection(section) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Update content
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.style.display = 'none';
        });
        const sectionEl = document.getElementById(`section-${section}`);
        if (sectionEl) {
            sectionEl.style.display = 'block';
        }

        this.currentSection = section;
    }

    // ============ BUTTONS ============

    setupButtons() {
        document.getElementById('btn-demo').addEventListener('click', () => this.loadDemoModel());
        document.getElementById('btn-open').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        // Dark mode toggle
        const darkModeBtn = document.getElementById('btn-dark-mode');
        if (darkModeBtn) {
            darkModeBtn.addEventListener('click', () => this.toggleDarkMode());
            // Check for saved preference
            if (localStorage.getItem('darkMode') === 'true') {
                document.body.classList.add('dark-mode');
                document.getElementById('dark-mode-icon').textContent = '☀️';
            }
        }

        document.getElementById('btn-run').addEventListener('click', () => this.runBaseCase());
        document.getElementById('btn-revalidate').addEventListener('click', () => this.revalidate());
        document.getElementById('btn-run-psa').addEventListener('click', () => this.runPSA());

        document.getElementById('btn-run-deterministic').addEventListener('click', () => this.runBaseCase());
        document.getElementById('btn-run-psa-full').addEventListener('click', () => this.runPSA());

        // DSA button
        const dsaBtn = document.getElementById('btn-run-dsa');
        if (dsaBtn) {
            dsaBtn.addEventListener('click', () => this.runDSA());
        }

        // EVPI button
        const evpiBtn = document.getElementById('btn-calc-evpi');
        if (evpiBtn) {
            evpiBtn.addEventListener('click', () => this.calculateEVPI());
        }

        // Budget impact button
        const biaBtn = document.getElementById('btn-run-bia');
        if (biaBtn) {
            biaBtn.addEventListener('click', () => this.calculateBudgetImpact());
        }

        // Export buttons
        document.getElementById('btn-export-json').addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCSV());
        document.getElementById('btn-export-validation').addEventListener('click', () => this.exportValidation());
        document.getElementById('btn-export-hta').addEventListener('click', () => this.exportHTAZip());

        // Audit export button
        const auditBtn = document.getElementById('btn-export-audit');
        if (auditBtn) {
            auditBtn.addEventListener('click', () => this.exportAuditLog());
        }

        // NICE report button
        const niceBtn = document.getElementById('btn-export-nice-report');
        if (niceBtn) {
            niceBtn.addEventListener('click', () => this.exportNICEReport());
        }
    }

    setupTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });
    }

    // ============ UI POPULATION ============

    showMainContent() {
        document.getElementById('drop-zone').style.display = 'none';
        document.getElementById('main-content').classList.add('active');
    }

    populateUI() {
        this.populateSummary();
        this.populateValidation();
        this.populateParameters();
        this.populateStates();
        this.populateTransitions();
        this.updateBadges();
    }

    populateSummary() {
        const p = this.project;
        const meta = p.metadata || {};
        const settings = p.settings || {};

        document.getElementById('model-type').textContent = p.model?.type || 'Unknown';
        document.getElementById('param-count').textContent = Object.keys(p.parameters || {}).length;
        document.getElementById('state-count').textContent = Object.keys(p.states || {}).length;
        document.getElementById('time-horizon').textContent = `${settings.time_horizon || '-'} years`;

        document.getElementById('model-name').textContent = meta.name || 'Unnamed';
        document.getElementById('model-version').textContent = meta.version || '-';
        document.getElementById('model-author').textContent = meta.author || '-';
        document.getElementById('model-created').textContent = meta.created ?
            new Date(meta.created).toLocaleDateString() : '-';

        const gdpInput = document.getElementById('gdp-per-capita');
        if (gdpInput) gdpInput.value = settings.gdp_per_capita_omr ?? guidanceDefaults.placeholder_gdp_per_capita_omr;

        const gdpYear = document.getElementById('gdp-year');
        if (gdpYear) gdpYear.value = settings.gdp_per_capita_year ?? guidanceDefaults.gdp_per_capita_year;

        const gdpSource = document.getElementById('gdp-source');
        if (gdpSource) gdpSource.value = settings.gdp_per_capita_source ?? guidanceDefaults.gdp_per_capita_source;

        const gdpConfirm = document.getElementById('gdp-confirm');
        if (gdpConfirm) gdpConfirm.checked = Boolean(settings.gdp_per_capita_confirmed);

        const biaHorizon = document.getElementById('bia-horizon');
        if (biaHorizon) biaHorizon.value = settings.bia_horizon_years ?? guidanceDefaults.bia_horizon_years;

        const biaDiscountSetting = document.getElementById('bia-discount-setting');
        if (biaDiscountSetting) biaDiscountSetting.value = (settings.bia_discount_rate ?? guidanceDefaults.bia_discount_rate) * 100;

        const coiInput = document.getElementById('meta-coi');
        if (coiInput) coiInput.value = meta.conflicts_of_interest || meta.coi_statement || '';

        const dossierSelect = document.getElementById('meta-public-dossier');
        if (dossierSelect) {
            if (meta.public_dossier_available === true) {
                dossierSelect.value = 'yes';
            } else if (meta.public_dossier_available === false) {
                dossierSelect.value = 'no';
            } else {
                dossierSelect.value = 'unspecified';
            }
        }

        const dossierUrl = document.getElementById('meta-public-dossier-url');
        if (dossierUrl) dossierUrl.value = meta.public_dossier_url || '';

        const biaYears = document.getElementById('bia-years');
        if (biaYears) biaYears.value = settings.bia_horizon_years ?? guidanceDefaults.bia_horizon_years;

        const biaDiscount = document.getElementById('bia-discount');
        if (biaDiscount) biaDiscount.value = ((settings.bia_discount_rate ?? guidanceDefaults.bia_discount_rate) * 100).toFixed(1);

        this.renderStateDiagram();
    }

    renderStateDiagram() {
        const container = document.getElementById('state-diagram');
        const states = this.project.states || {};

        let html = '<div style="display: flex; justify-content: center; align-items: center; gap: 60px; flex-wrap: wrap;">';

        for (const [stateId, state] of Object.entries(states)) {
            const isAbsorbing = state.type === 'absorbing';
            html += `
                <div class="state-node">
                    <div class="state-circle ${isAbsorbing ? 'absorbing' : ''}">
                        ${state.label?.substring(0, 8) || stateId}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">${stateId}</div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    populateValidation() {
        const v = this.validationResults;
        if (!v) return;

        const statusEl = document.getElementById('validation-status');
        if (v.valid) {
            statusEl.className = 'validation-status pass';
            statusEl.innerHTML = `<span>✅</span> Validation PASSED ${v.warnings.length > 0 ? `(${v.warnings.length} warnings)` : ''}`;
        } else {
            statusEl.className = 'validation-status fail';
            statusEl.innerHTML = `<span>❌</span> Validation FAILED (${v.errors.length} errors)`;
        }

        // Populate issues
        const issuesEl = document.getElementById('validation-issues');
        let html = '';

        for (const err of v.errors) {
            html += this.renderIssue(err, 'error');
        }
        for (const warn of v.warnings) {
            html += this.renderIssue(warn, 'warning');
        }
        for (const info of (v.infos || []).slice(0, 10)) {
            html += this.renderIssue(info, 'info');
        }

        issuesEl.innerHTML = html || '<p style="color: var(--text-muted);">No issues found.</p>';

        // Update badge
        document.getElementById('validation-badge').textContent =
            v.errors.length > 0 ? v.errors.length : (v.warnings.length > 0 ? v.warnings.length : '✓');
        document.getElementById('validation-badge').className =
            `nav-badge ${v.errors.length > 0 ? 'error' : (v.warnings.length > 0 ? 'warning' : 'success')}`;

        this.populateProofVerification();
        this.populateSubmissionReadiness();
    }

    populateProofVerification() {
        const statusEl = document.getElementById('proof-status');
        const issuesEl = document.getElementById('proof-issues');
        if (!statusEl || !issuesEl) return;

        if (!this.proofResults) {
            statusEl.className = 'validation-status warn';
            statusEl.innerHTML = '<span>ℹ️</span> No proof checks yet (run a model).';
            issuesEl.innerHTML = '';
            return;
        }

        const { summary, issues, verified } = this.proofResults;
        const statusClass = verified ? 'pass' : (summary.failed > 0 ? 'fail' : 'warn');
        statusEl.className = `validation-status ${statusClass}`;
        statusEl.innerHTML = `<span>${verified ? '✅' : '⚠️'}</span> Proof checks: ${summary.passed} passed, ${summary.failed} failed, ${summary.warnings} warnings`;

        if (!issues.length) {
            issuesEl.innerHTML = '<p style="color: var(--text-muted);">No proof issues detected.</p>';
            return;
        }

        issuesEl.innerHTML = issues.map((issue) => {
            const severity = issue.severity === 'error' ? 'error' : 'warning';
            return `
                <div class="validation-issue ${severity}">
                    <strong>${issue.severity.toUpperCase()}</strong> - ${issue.message}
                </div>
            `;
        }).join('');
    }

    renderIssue(issue, severity) {
        return `
            <div class="validation-issue ${severity}">
                <div class="issue-header">
                    <span class="issue-code">${issue.code}</span>
                    <span class="issue-path">${issue.path}</span>
                </div>
                <div>${issue.message}</div>
                ${issue.recommendation ? `<div style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">→ ${issue.recommendation}</div>` : ''}
            </div>
        `;
    }

    populateParameters() {
        const params = this.project.parameters || {};
        const tbody = document.getElementById('params-table-body');

        let html = '';
        for (const [id, param] of Object.entries(params)) {
            const dist = param.distribution;
            html += `
                <tr>
                    <td class="mono">${id}</td>
                    <td>${param.label || '-'}</td>
                    <td class="mono">${typeof param.value === 'number' ? param.value.toFixed(4) : param.value}</td>
                    <td>${dist ? `${dist.type}` : 'Fixed'}</td>
                    <td>${param.evidence_id || '-'}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html || '<tr><td colspan="5">No parameters defined</td></tr>';
        document.getElementById('params-badge').textContent = Object.keys(params).length;
    }

    populateStates() {
        const states = this.project.states || {};
        const tbody = document.getElementById('states-table-body');

        let html = '';
        for (const [id, state] of Object.entries(states)) {
            html += `
                <tr>
                    <td class="mono">${id}</td>
                    <td>${state.label || '-'}</td>
                    <td>${state.type || 'transient'}</td>
                    <td class="mono">${state.cost ?? '-'}</td>
                    <td class="mono">${state.utility ?? '-'}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html || '<tr><td colspan="5">No states defined</td></tr>';
        document.getElementById('states-badge').textContent = Object.keys(states).length;
    }

    populateTransitions() {
        const transitions = this.project.transitions || {};
        const tbody = document.getElementById('transitions-table-body');

        let html = '';
        for (const [id, trans] of Object.entries(transitions)) {
            const isExpr = typeof trans.probability === 'string';
            html += `
                <tr>
                    <td class="mono">${trans.from}</td>
                    <td class="mono">${trans.to}</td>
                    <td class="mono">${isExpr ? '-' : trans.probability?.toFixed(4)}</td>
                    <td class="mono" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${isExpr ? trans.probability : '-'}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html || '<tr><td colspan="4">No transitions defined</td></tr>';
        document.getElementById('transitions-badge').textContent = Object.keys(transitions).length;
    }

    updateBadges() {
        // Already done in individual populate methods
    }

    // ============ MODEL EXECUTION ============

    async runBaseCase() {
        if (!this.project) {
            this.showToast('No model loaded', 'error');
            return;
        }

        const modelType = this.project.model?.type;
        if (!modelType) {
            this.showToast('Model type not specified in project', 'error');
            return;
        }

        const engine = this.engines[modelType];
        if (!engine) {
            this.showToast(`Unsupported model type: ${modelType}`, 'error');
            return;
        }


        this.showLoading('Running model...');
        this.log(`Starting deterministic simulation for ${modelType}...`);

        try {
            this.results = engine.runAllStrategies(this.project);

            const firstStrategyResult = this.results.strategies[Object.keys(this.results.strategies)[0]];
            this.log(`Simulation complete in ${firstStrategyResult?.computation_time_ms || 0}ms`);
            
            this.displayResults();
            this.hideLoading();
            this.showToast('Simulation complete', 'success');

        } catch (e) {
            this.hideLoading();
            this.log(`Error: ${e.message}`);
            this.showToast(`Error: ${e.message}`, 'error');
        }
    }

    displayResults() {
        const r = this.results;
        if (!r) return;

        this.updateProofResults();
        this.updateBiaDefaultsFromResults();

        // Get first non-comparator strategy and comparator
        const strategies = this.project.strategies || {};
        let intId = null, compId = null;

        for (const [id, strat] of Object.entries(strategies)) {
            if (strat.is_comparator) compId = id;
            else if (!intId) intId = id;
        }

        if (!intId) intId = Object.keys(r.strategies)[0];
        if (!compId) compId = Object.keys(r.strategies)[1] || intId;

        const intResults = r.strategies[intId];
        const compResults = r.strategies[compId];
        const settings = this.getGuidanceSettings();

        // Display base case results
        document.getElementById('result-costs-int').textContent = this.formatCurrency(intResults?.total_costs || 0, 0);
        document.getElementById('result-costs-comp').textContent = this.formatCurrency(compResults?.total_costs || 0, 0);
        document.getElementById('result-qalys-int').textContent = (intResults?.total_qalys || 0).toFixed(3);
        document.getElementById('result-qalys-comp').textContent = (compResults?.total_qalys || 0).toFixed(3);

        // ICER
        if (r.incremental && r.incremental.comparisons.length > 0) {
            const comp = r.incremental.comparisons[0];
            if (typeof comp.icer === 'number') {
                document.getElementById('result-icer').textContent = this.formatCurrency(comp.icer, 0);
            } else {
                document.getElementById('result-icer').textContent = comp.dominance || comp.icer;
            }
        }

        // Render trace chart
        this.renderTraceChart(intResults);

        this.populateValidation();

        // Navigate to results
        this.navigateToSection('deterministic');
    }

    renderTraceChart(results) {
        if (!results?.trace) return;

        const ctx = document.getElementById('trace-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.trace) {
            this.charts.trace.destroy();
        }

        const trace = results.trace;
        const datasets = [];
        const colors = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed'];

        let i = 0;
        for (const [stateId, values] of Object.entries(trace.states)) {
            datasets.push({
                label: stateId,
                data: values,
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                fill: true,
                tension: 0.4
            });
            i++;
        }

        this.charts.trace = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trace.cycles,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        title: { display: true, text: 'Proportion in State' }
                    },
                    x: {
                        title: { display: true, text: 'Cycle' }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    async runPSA() {
        if (!this.project) {
            this.showToast('No model loaded', 'error');
            return;
        }

        const iterations = parseInt(document.getElementById('psa-iterations')?.value || '1000');
        const seed = parseInt(document.getElementById('engine-seed')?.value || '12345');

        this.showLoading('Running PSA...');
        document.getElementById('psa-progress').style.display = 'block';

        try {
            const engine = new PSAEngine({ iterations, seed });

            engine.onProgress(async (current, total, results) => {
                const pct = Math.round((current / total) * 100);
                document.getElementById('psa-progress-bar').style.width = `${pct}%`;
                document.getElementById('psa-progress-text').textContent = `${pct}%`;

                // Yield to update UI
                await new Promise(resolve => setTimeout(resolve, 0));
            });

            // Get strategy overrides
            const strategies = this.project.strategies || {};
            let intOverrides = {}, compOverrides = {};

            for (const [id, strat] of Object.entries(strategies)) {
                if (strat.is_comparator) {
                    compOverrides = strat.parameter_overrides || {};
                } else {
                    intOverrides = strat.parameter_overrides || {};
                }
            }

            this.psaResults = await engine.run(this.project, intOverrides, compOverrides);

            this.displayPSAResults();
            this.hideLoading();
            document.getElementById('psa-progress').style.display = 'none';
            this.showToast('PSA complete', 'success');

        } catch (e) {
            this.hideLoading();
            document.getElementById('psa-progress').style.display = 'none';
            this.showToast(`Error: ${e.message}`, 'error');
        }
    }

    displayPSAResults() {
        const r = this.psaResults;
        if (!r) return;

        const s = r.summary || {};
        const settings = this.getGuidanceSettings();
        const primaryWtp = r.primary_wtp || this.getPrimaryWtp();
        const primaryProb = s.prob_ce?.[primaryWtp] ?? s.prob_ce_primary ?? s.prob_ce_30k;

        const probLabel = document.getElementById('psa-prob-ce')?.previousElementSibling;
        if (probLabel && probLabel.classList.contains('summary-card-label')) {
            probLabel.textContent = `Prob CE @ ${formatWtpLabel(primaryWtp, settings)}`;
        }

        document.getElementById('psa-mean-icer').textContent =
            Number.isFinite(s.mean_icer) ? this.formatCurrency(s.mean_icer, 0) : '-';
        document.getElementById('psa-ci-lower').textContent =
            Number.isFinite(s.ci_lower_icer) ? this.formatCurrency(s.ci_lower_icer, 0) : '-';
        document.getElementById('psa-ci-upper').textContent =
            Number.isFinite(s.ci_upper_icer) ? this.formatCurrency(s.ci_upper_icer, 0) : '-';
        document.getElementById('psa-prob-ce').textContent =
            Number.isFinite(primaryProb) ? `${(primaryProb * 100).toFixed(1)}%` : '-';

        this.renderCEPlane();
        this.renderCEAC();
        this.displayConvergenceDiagnostics();
        this.updateAuditSummary();
        this.navigateToSection('psa');
    }

    renderCEPlane() {
        const r = this.psaResults;
        if (!r?.scatter) return;
        const settings = this.getGuidanceSettings();
        const primaryWtp = r.primary_wtp || this.getPrimaryWtp();
        const currency = currencyCode(settings);

        const ctx = document.getElementById('ce-plane-chart');
        if (!ctx) return;

        if (this.charts.cePlane) {
            this.charts.cePlane.destroy();
        }

        // Prepare scatter data
        const data = [];
        for (let i = 0; i < r.scatter.incremental_qalys.length; i++) {
            data.push({
                x: r.scatter.incremental_qalys[i],
                y: r.scatter.incremental_costs[i]
            });
        }

        // WTP line at primary threshold
        const maxQ = Math.max(...r.scatter.incremental_qalys.map(Math.abs)) * 1.2;
        const wtpLine = [
            { x: -maxQ, y: -maxQ * primaryWtp },
            { x: maxQ, y: maxQ * primaryWtp }
        ];

        this.charts.cePlane = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'PSA Iterations',
                        data: data,
                        backgroundColor: '#2563eb40',
                        borderColor: '#2563eb',
                        pointRadius: 2
                    },
                    {
                        label: `WTP ${formatWtpLabel(primaryWtp, settings)}`,
                        data: wtpLine,
                        type: 'line',
                        borderColor: '#dc2626',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Incremental QALYs' }
                    },
                    y: {
                        title: { display: true, text: `Incremental Costs (${currency})` }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    renderCEAC() {
        const r = this.psaResults;
        if (!r?.ceac) return;
        const settings = this.getGuidanceSettings();
        const currency = currencyCode(settings);

        const ctx = document.getElementById('ceac-chart');
        if (!ctx) return;

        if (this.charts.ceac) {
            this.charts.ceac.destroy();
        }

        this.charts.ceac = new Chart(ctx, {
            type: 'line',
            data: {
                labels: r.ceac.map(p => formatWtpLabel(p.wtp, settings)),
                datasets: [{
                    label: 'Probability Cost-Effective',
                    data: r.ceac.map(p => p.probability),
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb20',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        title: { display: true, text: 'Probability CE' }
                    },
                    x: {
                        title: { display: true, text: `Willingness-to-Pay Threshold (${currency}/QALY)` }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    displayConvergenceDiagnostics() {
        const r = this.psaResults;
        if (!r?.convergence) return;

        const panel = document.getElementById('convergence-panel');
        if (!panel) return;

        panel.style.display = 'block';

        const conv = r.convergence;
        document.getElementById('conv-status').textContent = conv.converged ? 'Converged' : 'Not Converged';
        document.getElementById('conv-status').style.color = conv.converged ? 'var(--success)' : 'var(--error)';

        document.getElementById('conv-cost-se').textContent = Number.isFinite(conv.costSE) ? this.formatCurrency(conv.costSE, 2) : '-';
        document.getElementById('conv-qaly-se').textContent = conv.qalySE ? conv.qalySE.toFixed(6) : '-';

        const warningEl = document.getElementById('conv-warning');
        if (!conv.converged) {
            warningEl.style.display = 'block';
            warningEl.textContent = `Warning: PSA may not have converged. Consider running more iterations. Cost CV: ${(conv.costCV * 100).toFixed(2)}%, QALY CV: ${(conv.qalyCV * 100).toFixed(2)}%`;
        } else {
            warningEl.style.display = 'none';
        }
    }

    // ============ DSA (DETERMINISTIC SENSITIVITY ANALYSIS) ============

    async runDSA() {
        if (!this.project) {
            this.showToast('No model loaded', 'error');
            return;
        }

        if (!this.dsaEngine) {
            this.showToast('DSA engine not available', 'error');
            return;
        }

        const range = parseFloat(document.getElementById('dsa-range')?.value || '20') / 100;
        const metric = document.getElementById('dsa-metric')?.value || 'icer';
        const maxParams = document.getElementById('dsa-max-params')?.value || '15';

        this.showLoading('Running DSA...');
        document.getElementById('dsa-progress').style.display = 'block';
        document.getElementById('dsa-placeholder').style.display = 'none';

        try {
            // Get strategy overrides
            const strategies = this.project.strategies || {};
            let intOverrides = {}, compOverrides = {};

            for (const [id, strat] of Object.entries(strategies)) {
                if (strat.is_comparator) {
                    compOverrides = strat.parameter_overrides || {};
                } else {
                    intOverrides = strat.parameter_overrides || {};
                }
            }

            this.dsaEngine.onProgress((current, total) => {
                const pct = Math.round((current / total) * 100);
                document.getElementById('dsa-progress-bar').style.width = `${pct}%`;
                document.getElementById('dsa-progress-text').textContent = `${pct}%`;
            });

            this.dsaResults = await this.dsaEngine.run(
                this.project,
                intOverrides,
                compOverrides,
                { range, metric }
            );

            this.displayDSAResults(maxParams);
            this.hideLoading();
            document.getElementById('dsa-progress').style.display = 'none';
            this.showToast('DSA complete', 'success');

            // Log to audit
            if (this.auditLogger) {
                this.auditLogger.logDSAResults(this.dsaResults);
            }

        } catch (e) {
            this.hideLoading();
            document.getElementById('dsa-progress').style.display = 'none';
            this.showToast(`Error: ${e.message}`, 'error');
        }
    }

    displayDSAResults(maxParams) {
        const r = this.dsaResults;
        if (!r?.parameters) return;

        document.getElementById('tornado-container').style.display = 'block';
        document.getElementById('dsa-placeholder').style.display = 'none';

        // Sort by swing and limit
        let params = [...r.parameters].sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));
        if (maxParams !== 'all') {
            params = params.slice(0, parseInt(maxParams));
        }

        // Populate table
        const tbody = document.getElementById('dsa-results-body');
        let html = '';
        params.forEach((p, i) => {
            html += `
                <tr>
                    <td>${i + 1}</td>
                    <td class="mono">${p.parameter}</td>
                    <td class="mono">${p.baseValue.toFixed(4)}</td>
                    <td class="mono">${p.lowResult?.toFixed(2) || '-'}</td>
                    <td class="mono">${p.highResult?.toFixed(2) || '-'}</td>
                    <td class="mono" style="font-weight: 600;">${Math.abs(p.swing).toFixed(2)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Render tornado chart
        this.renderTornadoChart(params, r.baseline);
    }

    renderTornadoChart(params, baseline) {
        const ctx = document.getElementById('tornado-chart');
        if (!ctx) return;

        if (this.charts.tornado) {
            this.charts.tornado.destroy();
        }

        // Prepare data - params should be in reverse order for tornado (most influential at top)
        const reversed = [...params].reverse();
        const labels = reversed.map(p => p.parameter);
        const lowDeltas = reversed.map(p => (p.lowResult || baseline) - baseline);
        const highDeltas = reversed.map(p => (p.highResult || baseline) - baseline);

        this.charts.tornado = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Low Value',
                        data: lowDeltas,
                        backgroundColor: '#dc2626',
                        barPercentage: 0.8
                    },
                    {
                        label: 'High Value',
                        data: highDeltas,
                        backgroundColor: '#16a34a',
                        barPercentage: 0.8
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: `Change in ${this.dsaResults.metric.toUpperCase()} from Baseline` }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    title: {
                        display: true,
                        text: `Baseline ${this.dsaResults.metric.toUpperCase()}: ${baseline?.toFixed(2) || '-'}`
                    }
                }
            }
        });
    }

    // ============ EVPI CALCULATION ============

    calculateEVPI() {
        if (!this.psaResults?.scatter) {
            this.showToast('Run PSA first to calculate EVPI', 'warning');
            return;
        }

        if (!this.evpiCalculator) {
            this.showToast('EVPI calculator not available', 'error');
            return;
        }

        const primaryWtp = this.psaResults?.primary_wtp || this.getPrimaryWtp();
        const wtpInput = document.getElementById('evpi-wtp');
        const parsedWtp = wtpInput ? parseFloat(wtpInput.value) : NaN;
        const wtp = Number.isFinite(parsedWtp) ? parsedWtp : primaryWtp;
        const population = parseInt(document.getElementById('evpi-population')?.value || '50000');
        const years = parseInt(document.getElementById('evpi-years')?.value || '10');

        try {
            if (wtpInput && !Number.isFinite(parsedWtp)) {
                wtpInput.value = String(Math.round(wtp));
            }
            this.evpiResults = this.evpiCalculator.calculate(
                this.psaResults,
                wtp,
                population,
                years
            );

            this.displayEVPIResults();
            this.showToast('EVPI calculated', 'success');

            // Log to audit
            if (this.auditLogger) {
                this.auditLogger.logEVPI(this.evpiResults);
            }

        } catch (e) {
            this.showToast(`Error: ${e.message}`, 'error');
        }
    }

    displayEVPIResults() {
        const r = this.evpiResults;
        if (!r) return;

        document.getElementById('evpi-results').style.display = 'block';

        document.getElementById('evpi-per-patient').textContent =
            Number.isFinite(r.evpiPerPatient) ? this.formatCurrency(r.evpiPerPatient, 2) : '-';
        document.getElementById('evpi-population-value').textContent = r.populationEVPI ?
            `${this.formatCurrency(r.populationEVPI / 1e6, 2)}M` : '-';
        document.getElementById('evpi-prob-wrong').textContent = r.probWrongDecision ?
            `${(r.probWrongDecision * 100).toFixed(1)}%` : '-';
        document.getElementById('evpi-optimal').textContent = r.optimalStrategy || '-';
    }

    // ============ VALIDATION ============

    async revalidate() {
        if (!this.project) return;
        this.validationResults = this.validator._validateProjectObject(this.project);
        this.populateValidation();
        this.showToast('Validation complete', 'success');
    }

    // ============ EXPORT ============

    exportJSON() {
        const data = {
            project: this.project,
            results: this.results,
            psa: this.psaResults,
            validation: this.validationResults,
            proof: this.proofResults,
            bia: this.biaResults
        };

        this.downloadFile(JSON.stringify(data, null, 2), 'hta-results.json', 'application/json');
    }

    exportCSV() {
        if (!this.results) {
            this.showToast('No results to export', 'warning');
            return;
        }

        let csv = 'Strategy,Total Costs,Total QALYs,Life Years\n';
        for (const [id, r] of Object.entries(this.results.strategies)) {
            csv += `${r.label || id},${r.total_costs.toFixed(2)},${r.total_qalys.toFixed(4)},${r.life_years.toFixed(4)}\n`;
        }

        this.downloadFile(csv, 'hta-results.csv', 'text/csv');
    }

    exportValidation() {
        if (!this.validationResults) return;
        const report = this.validator.generateReport(this.validationResults);
        this.downloadFile(report, 'validation-report.txt', 'text/plain');
    }

    exportAuditLog() {
        if (!this.auditLogger) {
            this.showToast('Audit logger not available', 'warning');
            return;
        }

        const auditData = this.auditLogger.export();
        this.downloadFile(
            JSON.stringify(auditData, null, 2),
            `audit_${auditData.metadata.sessionId}.json`,
            'application/json'
        );
        this.showToast('Audit log exported', 'success');
    }

    exportNICEReport() {
        if (!this.project) {
            this.showToast('No model loaded', 'warning');
            return;
        }

        const submissionIssues = this.getSubmissionIssues().filter(i => i.severity === 'error');
        if (submissionIssues.length > 0) {
            this.showToast('Submission readiness issues found. Resolve them before exporting.', 'warning');
            this.navigateToSection('validation');
            return;
        }

        // Generate Oman HTA submission report
        const report = this.generateNICEReport();
        this.downloadFile(report, 'oman-hta-report.txt', 'text/plain');
        this.showToast('Oman HTA report generated', 'success');
    }

    generateNICEReport() {
        const p = this.project;
        const v = this.validationResults;
        const r = this.results;
        const psa = this.psaResults;
        const evpi = this.evpiResults;
        const settings = this.getGuidanceSettings();
        const currency = currencyCode(settings);
        const wtpThresholds = this.getWtpThresholds();
        const primaryWtp = this.getPrimaryWtp();
        const primaryWtpLabel = formatWtpLabel(primaryWtp, settings);
        const wtpList = wtpThresholds.map((w) => formatWtpLabel(w, settings)).join(', ');
        const probCEPrimary = psa?.summary
            ? (psa.summary.prob_ce?.[primaryWtp] ?? psa.summary.prob_ce_primary ?? psa.summary.prob_ce_30k)
            : null;

        const fmt = (value, digits = 2) => Number.isFinite(value) ? this.formatCurrency(value, digits) : '-';
        const pct = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-';
        const discountCostsPct = ((settings.discount_rate_costs ?? 0) * 100).toFixed(1);
        const discountQalysPct = ((settings.discount_rate_qalys ?? 0) * 100).toFixed(1);
        const gdpPerCapita = Number.isFinite(settings.gdp_per_capita_omr)
            ? `${currency} ${settings.gdp_per_capita_omr.toLocaleString('en-US')}`
            : 'Not set';
        const gdpYear = settings.gdp_per_capita_year || guidanceDefaults.gdp_per_capita_year;
        const gdpSource = settings.gdp_per_capita_source || guidanceDefaults.gdp_per_capita_source;
        const gdpConfirmed = settings.gdp_per_capita_confirmed ? 'Yes' : 'No';
        const biaHorizon = Number.isFinite(settings.bia_horizon_years) ? settings.bia_horizon_years : 4;
        const biaDiscountPct = ((settings.bia_discount_rate ?? 0) * 100).toFixed(1);
        const coiStatement = p.metadata?.conflicts_of_interest || p.metadata?.coi_statement || 'Not provided';
        const publicDossier = p.metadata?.public_dossier_available ? 'Yes' : 'Not specified';
        const publicDossierUrl = p.metadata?.public_dossier_url || 'Not provided';
        const submissionIssues = this.getSubmissionIssues();
        const submissionErrors = submissionIssues.filter(i => i.severity === 'error');

        let report = `
================================================================================
                    OMAN HTA SUBMISSION REPORT
                    HTA Artifact Standard v0.1
================================================================================

Generated: ${new Date().toISOString()}
Model ID: ${p.metadata?.id || 'Unknown'}
Model Name: ${p.metadata?.name || 'Unnamed'}
Version: ${p.metadata?.version || '-'}
Author: ${p.metadata?.author || '-'}

================================================================================
1. MODEL SPECIFICATION
================================================================================

Model Type: ${p.model?.type || 'Unknown'}
Time Horizon: ${settings.time_horizon || '-'} years
Cycle Length: ${settings.cycle_length || '-'} years
Starting Age: ${settings.starting_age || '-'} years
Discount Rate (Costs): ${discountCostsPct}%
Discount Rate (QALYs): ${discountQalysPct}%
Half-Cycle Correction: ${settings.half_cycle_correction || 'None'}
Perspective: Oman payer/provider (health care base case)
Currency: ${currency}
GDP per Capita (OMR): ${gdpPerCapita}
GDP Year/Source: ${gdpYear || '-'} / ${gdpSource || '-'}
GDP Confirmed: ${gdpConfirmed}
CET Thresholds: ${wtpList}
Primary WTP Threshold: ${primaryWtpLabel}
Budget Impact Horizon: ${biaHorizon} years
Budget Impact Discount Rate: ${biaDiscountPct}%
Conflict of Interest Statement: ${coiStatement}
Public Dossier Availability: ${publicDossier}
Public Dossier URL: ${publicDossierUrl}

Health States: ${Object.keys(p.states || {}).length}
${Object.entries(p.states || {}).map(([id, s]) => `  - ${id}: ${s.label} (${s.type})`).join('\n')}

Parameters: ${Object.keys(p.parameters || {}).length}
${Object.entries(p.parameters || {}).slice(0, 10).map(([id, param]) =>
    `  - ${id}: ${param.value} ${param.distribution ? `(${param.distribution.type})` : '(fixed)'}`
).join('\n')}
${Object.keys(p.parameters || {}).length > 10 ? `  ... and ${Object.keys(p.parameters || {}).length - 10} more` : ''}

================================================================================
2. VALIDATION SUMMARY
================================================================================

Validation Status: ${v?.valid ? 'PASSED' : 'FAILED'}
Errors: ${v?.errors?.length || 0}
Warnings: ${v?.warnings?.length || 0}
Informational: ${v?.infos?.length || 0}

${v?.errors?.length > 0 ? 'Critical Issues:\n' + v.errors.map(e => `  [${e.code}] ${e.message}`).join('\n') : ''}
${v?.warnings?.length > 0 ? '\nWarnings:\n' + v.warnings.map(w => `  [${w.code}] ${w.message}`).join('\n') : ''}

================================================================================
3. BASE CASE RESULTS
================================================================================
`;

        if (r?.strategies) {
            const strategies = Object.entries(r.strategies);
            report += `
Strategy Outcomes:
${strategies.map(([id, s]) => `
  ${s.label || id}:
    Total Costs: ${fmt(s.total_costs, 2)}
    Total QALYs: ${Number.isFinite(s.total_qalys) ? s.total_qalys.toFixed(4) : '-'}
    Life Years: ${Number.isFinite(s.life_years) ? s.life_years.toFixed(4) : '-'}
`).join('')}
`;
            if (r.incremental?.comparisons?.length > 0) {
                const comp = r.incremental.comparisons[0];
                report += `
Incremental Analysis:
  Incremental Costs: ${fmt(comp.incremental_costs, 2)}
  Incremental QALYs: ${Number.isFinite(comp.incremental_qalys) ? comp.incremental_qalys.toFixed(4) : '-'}
  ICER: ${typeof comp.icer === 'number' ? fmt(comp.icer, 2) : (comp.icer || '-')}
  NMB @ ${primaryWtpLabel}: ${fmt(comp.nmb_primary ?? comp.nmb_30k, 2)}
`;
            }
        } else {
            report += '\n  [No base case results available - run model first]\n';
        }

        report += `
================================================================================
4. BUDGET IMPACT ANALYSIS
================================================================================
`;

        if (this.biaResults) {
            const bia = this.biaResults;
            report += `
Budget Impact Inputs:
  Horizon: ${bia.years} years
  Population: ${bia.population.toLocaleString('en-US')}
  Population Growth Rate: ${(bia.growthRate * 100).toFixed(1)}%
  Incremental Cost per Patient: ${fmt(bia.incrementalCost, 2)}
  Fixed Implementation Cost: ${fmt(bia.fixedCost, 2)}
  Discount Rate: ${(bia.discountRate * 100).toFixed(1)}%

Budget Impact Results:
  Total Budget Impact: ${fmt(bia.totalCost, 2)}
`;
            if (bia.rows?.length) {
                report += `
Yearly Breakdown:
${bia.rows.map((row) => `  Year ${row.year}: ${fmt(row.annualCost, 2)} (Cumulative: ${fmt(row.cumulativeCost, 2)})`).join('\n')}
`;
            }
        } else {
            report += '\n  [No budget impact analysis available - run BIA first]\n';
        }

        report += `
================================================================================
5. PROBABILISTIC SENSITIVITY ANALYSIS
================================================================================
`;

        if (psa?.summary) {
            const s = psa.summary;
            report += `
PSA Configuration:
  Iterations: ${psa.iterations || '-'}
  Random Seed: ${psa.seed || '-'}
  Convergence Status: ${psa.convergence?.converged ? 'Converged' : 'Not Converged'}
  WTP Thresholds: ${wtpList}
  Primary WTP: ${primaryWtpLabel}

PSA Results:
  Mean Incremental Costs: ${fmt(s.mean_incremental_costs, 2)}
  Mean Incremental QALYs: ${Number.isFinite(s.mean_incremental_qalys) ? s.mean_incremental_qalys.toFixed(4) : '-'}
  Mean ICER: ${fmt(s.mean_icer, 2)}

95% Credible Intervals:
  ICER Lower: ${fmt(s.ci_lower_icer, 2)}
  ICER Upper: ${fmt(s.ci_upper_icer, 2)}

Cost-Effectiveness Probabilities:
  P(CE) at ${primaryWtpLabel}: ${pct(probCEPrimary)}
`;
            if (psa.convergence) {
                report += `
Convergence Diagnostics:
  Cost Standard Error: ${fmt(psa.convergence.costSE, 2)}
  QALY Standard Error: ${Number.isFinite(psa.convergence.qalySE) ? psa.convergence.qalySE.toFixed(6) : '-'}
  Cost CV: ${pct(psa.convergence.costCV)}
  QALY CV: ${pct(psa.convergence.qalyCV)}
`;
            }
        } else {
            report += '\n  [No PSA results available - run PSA first]\n';
        }

        report += `
================================================================================
6. VALUE OF INFORMATION ANALYSIS
================================================================================
`;

        if (evpi) {
            report += `
EVPI Analysis:
  Willingness-to-Pay: ${fmt(evpi.wtp, 0)}/QALY
  EVPI per Patient: ${fmt(evpi.evpiPerPatient, 2)}
  Population Size: ${evpi.population?.toLocaleString() || '-'}
  Time Horizon: ${evpi.timeHorizon || evpi.years || '-'} years
  Population EVPI: ${fmt(evpi.populationEVPI, 2)}
  Probability of Wrong Decision: ${pct(evpi.probWrongDecision)}
  Optimal Strategy (current info): ${evpi.optimalStrategy || '-'}
`;
        } else {
            report += '\n  [No EVPI analysis available - run EVPI calculation first]\n';
        }

        report += `
================================================================================
7. OMAN HTA GUIDANCE ALIGNMENT
================================================================================

Discount Rate Costs: ${settings.discount_rate_costs === 0.03 ? 'COMPLIANT (3.0%)' : `NON-COMPLIANT (${discountCostsPct}%)`}
Discount Rate QALYs: ${settings.discount_rate_qalys === 0.03 ? 'COMPLIANT (3.0%)' : `NON-COMPLIANT (${discountQalysPct}%)`}
Primary WTP Threshold: ${primaryWtpLabel}
GDP per Capita (OMR): ${gdpPerCapita}
CET Thresholds: ${wtpList}
Half-Cycle Correction: ${settings.half_cycle_correction ? 'APPLIED' : 'NOT APPLIED'}
PSA Iterations: ${psa?.iterations >= 10000 ? `COMPLIANT (${psa.iterations})` : `${psa?.iterations || 'N/A'} (10,000 recommended)`}
Time Horizon: ${settings.time_horizon >= 20 ? 'ADEQUATE' : 'May be insufficient for lifetime analysis'}
Budget Impact Horizon: ${biaHorizon === 4 ? 'COMPLIANT (4 years)' : `NON-COMPLIANT (${biaHorizon} years)`}
Budget Impact Discounting: ${(settings.bia_discount_rate ?? 0) === 0 ? 'COMPLIANT (0%)' : `NON-COMPLIANT (${biaDiscountPct}%)`}
Conflict of Interest Statement: ${coiStatement}
Public Dossier Availability: ${publicDossier}
Submission Readiness: ${submissionErrors.length === 0 ? 'READY' : 'NOT READY'}
Submission Issues: ${submissionIssues.length ? submissionIssues.map(i => i.message).join('; ') : 'None'}

================================================================================
8. AUDIT TRAIL
================================================================================
`;

        if (this.auditLogger) {
            const summary = this.auditLogger.getSummary();
            report += `
Session ID: ${summary.sessionId}
Start Time: ${summary.startTime}
Total Log Entries: ${summary.totalEntries}
Errors Logged: ${summary.errorCount}
Warnings Logged: ${summary.warningCount}
Probability Clamping Events: ${summary.clampingEvents}
Parameter Overrides: ${summary.parameterChanges}
`;
        } else {
            report += '\n  [Audit logging not available]\n';
        }

        report += `
================================================================================
                            END OF REPORT
================================================================================
`;

        return report;
    }

    updateAuditSummary() {
        if (!this.auditLogger) return;

        const summary = this.auditLogger.getSummary();

        const sessionEl = document.getElementById('audit-session-id');
        if (sessionEl) sessionEl.textContent = summary.sessionId;

        const eventsEl = document.getElementById('audit-total-events');
        if (eventsEl) eventsEl.textContent = summary.totalEntries;

        const warningsEl = document.getElementById('audit-warnings');
        if (warningsEl) warningsEl.textContent = summary.warningCount;

        const clampingEl = document.getElementById('audit-clamping');
        if (clampingEl) clampingEl.textContent = summary.clampingEvents;
    }

    async exportHTAZip() {
        if (!this.project) return;

        const zip = new JSZip();

        // Add project.json
        zip.file('project.json', JSON.stringify(this.project, null, 2));

        // Add results if available
        if (this.results) {
            zip.file('results.json', JSON.stringify({
                version: '0.1',
                run_id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                deterministic: this.results,
                psa: this.psaResults,
                proof: this.proofResults,
                bia: this.biaResults
            }, null, 2));
        }

        // Generate manifest
        const manifest = {
            version: '0.1',
            created: new Date().toISOString(),
            files: []
        };

        // Calculate checksums
        for (const filename of Object.keys(zip.files)) {
            const content = await zip.file(filename).async('arraybuffer');
            const hash = await this.validator.computeSHA256(content);
            manifest.files.push({
                path: filename,
                sha256: hash,
                size: content.byteLength
            });
        }

        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // Generate ZIP
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.project.metadata?.id || 'model'}.hta.zip`;
        a.click();

        URL.revokeObjectURL(url);
        this.showToast('Package exported', 'success');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }

    // ============ UI HELPERS ============

    showLoading(text = 'Loading...') {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

    log(message) {
        const logEl = document.getElementById('engine-log');
        if (!logEl) return;

        const time = new Date().toLocaleTimeString();
        logEl.innerHTML += `<div><span style="color: #64748b;">[${time}]</span> ${message}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }

    toggleDarkMode() {
        const body = document.body;
        const icon = document.getElementById('dark-mode-icon');
        const isDark = body.classList.toggle('dark-mode');

        // Update icon
        if (icon) {
            icon.textContent = isDark ? '☀️' : '🌙';
        }

        // Save preference
        localStorage.setItem('darkMode', isDark.toString());

        // Update charts for dark mode
        this.updateChartsForTheme(isDark);
    }

    updateChartsForTheme(isDark) {
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        // Update all Chart.js instances
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = textColor;
            Chart.defaults.borderColor = gridColor;

            // Update existing charts
            Object.values(Chart.instances || {}).forEach(chart => {
                if (chart.options.scales) {
                    Object.values(chart.options.scales).forEach(scale => {
                        if (scale.ticks) scale.ticks.color = textColor;
                        if (scale.grid) scale.grid.color = gridColor;
                    });
                }
                chart.update('none');
            });
        }
    }
}

// Provide early stubs for selenium scripts
if (typeof window !== 'undefined') {
    window.showSection = (section) => {
        if (window.app && typeof window.app.navigateToSection === 'function') {
            window.app.navigateToSection(section);
        } else {
            window.__pendingSection = section;
        }
    };
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new HTAApp();
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('active');

    // Expose global functions for external access and testing
    window.showSection = (section) => window.app.navigateToSection(section);
    window.runDeterministicAnalysis = () => window.app.runBaseCase();
    window.runPSA = () => window.app.runPSA();
    window.exportResults = () => window.app.exportResults && window.app.exportResults();
    window.loadDemoData = () => window.app.loadDemoModel();
    window.runMetaAnalysis = () => window.app.runMetaAnalysis && window.app.runMetaAnalysis();
    window.runNMA = () => window.app.runNMA && window.app.runNMA();
    window.runSurvivalAnalysis = () => window.app.runSurvivalAnalysis && window.app.runSurvivalAnalysis();
    window.runEVPPI = () => window.app.runEVPPI && window.app.runEVPPI();

    if (window.__pendingSection) {
        window.app.navigateToSection(window.__pendingSection);
        window.__pendingSection = null;
    }
});
