# HTA Artifact Standard v0.1

A comprehensive, open standard for Health Technology Assessment (HTA) economic models.

## Overview

The HTA Artifact Standard provides:

- **Standardized format** for health economic models (`.hta.zip` packages)
- **Deterministic execution** - bit-identical results across platforms
- **Transparent validation** - automated model checking and verification
- **Portable artifacts** - share models without proprietary software

## Quick Start

### Using the Web Application

1. Open `index.html` in a modern browser
2. Drag and drop a `.hta.zip` file or `project.json`
3. Or click "Load Demo" to try the demonstration model

### Features

- **Validation**: Schema and semantic validation of models
- **Simulation**: Run deterministic Markov cohort models
- **PSA**: Probabilistic sensitivity analysis with visualizations
- **Export**: Generate `.hta.zip` packages with results

## Project Structure

```
hta-oman/
├── index.html              # Main web application (single-page)
├── service-worker.js       # PWA / offline support
├── manifest.json           # PWA manifest
├── src/
│   ├── validator/          # Schema + semantic validation
│   ├── engine/             # Markov, PSA, NMA, survival, meta-analysis, …
│   ├── parser/             # Expression-language parser
│   ├── utils/              # Kahan summation, PCG32, life tables, audit, …
│   └── ui/                 # App + visualization controllers
├── schemas/                # JSON Schema definitions
├── reference-models/       # Golden test fixtures
│   ├── markov_simple/
│   ├── markov_age_dependent/
│   └── psa_demo/
├── tests/
│   ├── engine/             # Jest unit tests (run via `npm test`)
│   ├── editorialRevisions.test.js
│   └── selenium/           # End-to-end browser tests (pytest)
├── docs/
│   ├── protocol.md
│   ├── reports/            # Editorial reviews, benchmarks, change logs
│   └── oman-hta-guidance.html
└── e156-submission/        # E156 publication bundle
```

## Development

```bash
# JavaScript
npm install
npm test              # Jest unit tests
npm run lint          # ESLint
npm run format        # Prettier
npm run serve         # Local static server

# Python (selenium UI tests — require a browser driver on PATH)
pytest tests/selenium
```

## Model Types

### Supported

- **Markov Cohort**: State-transition models with discrete time cycles
- **Expressions**: Time/age-dependent parameters

### Planned

- Partitioned Survival Analysis
- Decision Trees
- Budget Impact Models
- Microsimulation

## Key Features

### Determinism

All computations use:
- **Kahan summation** for numerical stability
- **PCG32 RNG** for reproducible random sequences
- **IEEE 754 f64** for consistent floating-point

### Validation

Automatic checking of:
- Schema compliance
- Reference integrity
- Probability bounds [0, 1]
- Mass conservation (row sums = 1)
- Circular dependency detection
- Expression parsing

### Half-Cycle Correction

Supports:
- None
- Start
- End
- Trapezoidal (default)

## File Format

### project.json

```json
{
  "version": "0.1",
  "metadata": {
    "id": "my_model",
    "name": "My HTA Model"
  },
  "settings": {
    "time_horizon": 40,
    "cycle_length": 1,
    "discount_rate_costs": 0.035,
    "discount_rate_qalys": 0.035
  },
  "model": {
    "type": "markov_cohort"
  },
  "parameters": { ... },
  "states": { ... },
  "transitions": { ... },
  "strategies": { ... }
}
```

### .hta.zip Package

```
model.hta.zip
├── manifest.json     # File checksums
├── project.json      # Model definition
├── results.json      # Simulation results (optional)
└── evidence/         # Supporting documents (optional)
```

## Expression Language

Safe, non-Turing complete expressions:

```
# Arithmetic
1 + 2 * 3
x ^ 2

# Functions
exp(rate)
rate_to_prob(0.1)
if(age > 65, 0.1, 0.05)

# References
p_death * hr_treatment
```

### Built-in Functions

| Function | Description |
|----------|-------------|
| `exp(x)` | Exponential |
| `ln(x)` | Natural log |
| `sqrt(x)` | Square root |
| `min(a, b)` | Minimum |
| `max(a, b)` | Maximum |
| `rate_to_prob(r)` | Rate to probability |
| `prob_to_rate(p)` | Probability to rate |
| `if(cond, a, b)` | Conditional |
| `clamp(x, min, max)` | Clamp value |

### Built-in Variables

| Variable | Description |
|----------|-------------|
| `cycle` | Current cycle number |
| `time` | Time in years |
| `age` | Patient age |

## API Usage

```javascript
// Validation
const validator = new HTAValidator();
const results = await validator.validateZip(zipData);

// Simulation
const engine = new MarkovEngine();
const results = engine.run(project);

// PSA
const psa = new PSAEngine({ iterations: 10000, seed: 12345 });
const psaResults = await psa.run(project);
```

## Browser Support

- Chrome 80+
- Firefox 78+
- Safari 14+
- Edge 80+

Requires:
- ES2020
- Web Crypto API
- Async/Await

## License

Open standard - implementations may use any license.

## Contributing

This is a reference implementation of the HTA Artifact Standard.

See also:
- RFC-001: Package Format
- RFC-002: Project Schema
- RFC-003: Results Schema
- RFC-004: Expression Language
- RFC-005: Determinism Contract
- RFC-006: Validation Requirements
