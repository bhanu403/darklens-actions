# 🛡️ DarkLens GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-DarkLens%20Action-purple?logo=github)](https://github.com/marketplace/actions/darklens-compliance-scan)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DarkLens](https://img.shields.io/badge/Powered%20by-DarkLens.dev-8B5CF6)](https://darklens.dev)

Automate compliance and dark pattern testing in your CI/CD pipeline. Audit pull requests, Vercel/Netlify previews, staging URLs, and production deployments for deceptive UI patterns and regulatory violations (**FTC Act Sec. 5, GDPR, CCPA/CPRA, EU DSA, ROSCA**) before shipping code to users.

- **Native Node 24 Runtime:** Zero external dependencies (`node24`), runs identically on Ubuntu, macOS, and Windows runners.
- **Developer-Friendly Failure Reports:** Every issue prints **what is wrong**, **why it fails legal rules**, **exact target element**, **fair-pattern alternatives**, **step-by-step fix instructions**, and **ready-to-copy HTML/CSS code snippets** in logs, annotations, and Job Summaries.
- **Optional Non-Blocking Advisory Mode (`fail-on: 'none'`):** Surface dark pattern warnings & fixes directly on PRs **without blocking merges**, or turn on strict score/critical gating whenever your team is ready.
- **Sticky PR Comments (`comment-pr: 'true'`):** Updates one clean report comment per Pull Request instead of spamming new comments on every push.

---

## ⚡ 60-Second Setup

### 1. Add your API Key to GitHub Secrets
1. Sign in at [darklens.dev/dashboard](https://darklens.dev/dashboard) and copy your DarkLens API key *(CI/CD scans require an Agency/Enterprise plan or API Credits)*.
2. In your GitHub repo, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Name it **`DARKLENS_API_KEY`** and paste your key.

### 2. Add `.github/workflows/darklens.yml`

#### Option A — Recommended Rollout: Non-Blocking PR Advisory (`fail-on: 'none'`)
Start here if your team wants full compliance visibility on every PR **without ever blocking developer merges**:

```yaml
name: DarkLens Compliance Scan

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write # Needed only when comment-pr is 'true'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Run DarkLens Advisory Scan
        uses: bhanu403/darklens-actions@v1
        with:
          url: 'https://staging.myapp.com'
          api-key: ${{ secrets.DARKLENS_API_KEY }}
          fail-on: 'none'      # Never fails PR builds — posts warnings & fixes only
          comment-pr: 'true'   # Updates one sticky compliance report comment on the PR
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

#### Option B — Release Gate: Block Risky PRs (`fail-on: 'score'` or `'critical'`)
Switch `fail-on` when you want DarkLens to automatically stop non-compliant UI before release:

```yaml
      - name: Enforce DarkLens Compliance Gate
        uses: bhanu403/darklens-actions@v1
        with:
          url: 'https://staging.myapp.com'
          api-key: ${{ secrets.DARKLENS_API_KEY }}
          threshold: 75        # Minimum score required (0-100)
          fail-on: 'score'     # Or 'critical' to block only critical legal violations
          comment-pr: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 🎛️ Choosing the Right Options

### Which `fail-on` Mode Should I Choose?

| `fail-on` Value | Blocks PR Merge? | Behavior & Best Use Case |
| :--- | :---: | :--- |
| **`none`** | **No** *(Always exits `0`)* | **Advisory / Rollout Mode.** Audits URL, posts full Problem + Solution report in Job Summary / PR comments, and emits `::warning::` annotations without annoying or blocking developers. |
| **`critical`** | **Only on Criticals** | **Pragmatic Guardrail.** Ignores minor warnings; only fails the build if severe violations (Pre-Checked Charges, Roach Motel Cancel, Confirmshaming) are detected. |
| **`score`** *(Default)* | **If `< threshold`** | **Balanced Release Gate.** Compares compliance score (`0–100`) against `threshold` (default `70`). Gives teams clear numeric quality bars. |
| **`any`** | **On any finding** | **Zero-Tolerance Mode.** Fails if even 1 Low/Medium/High/Critical issue is present. Best for regulated fintech, health, or EU checkout flows. |

### Which `threshold` Should I Use? (When `fail-on: 'score'`)

| Threshold | Profile | Recommended For | Build Behavior |
| :---: | :--- | :--- | :--- |
| **`70 – 75`** | **Standard (Recommended)** | SaaS, E-Commerce, Consumer Apps | Blocks serious deceptive traps (hidden renewals, fake timers, drip fees) without churning on minor copy tweaks. |
| **`85 – 95`** | **Strict Compliance** | Fintech, Banking, Healthcare, EU Regulated | Enforces strict GDPR cookie choice equality, WCAG contrast, and click-to-cancel clarity. |
| **`50 – 60`** | **Lenient / Refactoring** | Legacy sites being cleaned up incrementally | Catches catastrophic legal violations while legacy flows are refactored sprint-by-sprint. |

---

## ⚙️ All Inputs & Outputs

### Inputs

| Input | Description | Required | Default |
| :--- | :--- | :---: | :--- |
| `url` | Public or preview deployment URL to audit (e.g., Vercel/Netlify preview URL). | **Yes** | — |
| `api-key` | DarkLens API key (`secrets.DARKLENS_API_KEY`). Masked automatically in logs. | **Yes** | — |
| `threshold` | Minimum compliance score `0–100` used when `fail-on` is `'score'`. | No | `'70'` |
| `fail-on` | Failure rule: `'score'`, `'critical'`, `'any'`, or `'none'` (warn-only advisory). | No | `'score'` |
| `comment-pr` | Post or update a sticky DarkLens report comment on PRs (`'true'` / `'false'`). | No | `'false'` |
| `github-token` | `${{ secrets.GITHUB_TOKEN }}` — required only when `comment-pr` is `'true'`. | No | `''` |
| `api-url` | Custom DarkLens API endpoint override (HTTPS required, or `localhost` in dev). | No | `'https://darklens.dev/api/ci/scan'` |

### Outputs & Environment Variables

| Output | Env Var Exported | Meaning |
| :--- | :--- | :--- |
| `score` | `DARKLENS_SCORE` | Compliance score (`0–100`) |
| `issues-count` | `DARKLENS_ISSUES_COUNT` | Total number of findings detected |
| `critical-count` | `DARKLENS_CRITICAL_COUNT` | Number of Critical severity findings |
| `pass` | `DARKLENS_PASS` | `'true'` or `'false'` against your chosen `fail-on` policy |
| `summary` | — | Concise one-line audit summary |

---

## 📋 What Developers See on Every PR

1. **Why It Failed (or Warned):** Clear policy gate summary (e.g., `Score 52 is below threshold 75`) plus instructions on switching to `fail-on: none` or `critical`.
2. **What Is Wrong & Legal Risk:** Each violation's severity, rule description, offending UI element text, law citations (**FTC, GDPR, CCPA, EU DSA**), and **Jurisdictions at Risk**.
3. **Exact Solution & Code Fixes:** Collapsible **Step-by-Step Solutions & Ready Code Snippets** + inline PR annotations + direct link to [darklens.dev/dashboard](https://darklens.dev/dashboard).

---

## 🎯 Patterns DarkLens Audits

- **FTC Click-to-Cancel & Roach Motel:** Hard cancellation barriers, phone/email-only opt-outs.
- **GDPR & ePrivacy Consent:** Pre-consent trackers, dark-pattern cookie banners, pre-checked opt-ins.
- **CCPA / CPRA:** Missing opt-out / Do Not Sell or Share disclosures.
- **E-Commerce Sneaking & ROSCA:** Pre-selected add-ons, hidden auto-renewals, drip fees.
- **Confirmshaming & Misdirection:** Guilt-tripping decline buttons, low-contrast opt-outs.
- **Fake Urgency & Scarcity:** Countdown timers and unverified low-stock claims.
- **WCAG 2.1 AA:** Low-contrast legal fine print and tiny dismiss controls.

---

## 🛠️ Troubleshooting

- **`401 Missing API key` / `403 Invalid API key`:** Confirm `DARKLENS_API_KEY` is saved under Repository/Organization Actions secrets (note: Dependabot/fork PRs do not receive repo secrets).
- **`403 Insufficient Credits`:** CI/CD scans require an **Agency / Enterprise** plan or available **API Credits** at [darklens.dev/dashboard](https://darklens.dev/dashboard).
- **`Could not create PR comment (HTTP 403)`:** Add `permissions: pull-requests: write` to your workflow and ensure `github-token: ${{ secrets.GITHUB_TOKEN }}` is passed when `comment-pr: 'true'`.

---

## 📄 License

MIT © [DarkLens.dev](https://darklens.dev)
