# 🛡️ DarkLens GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-DarkLens%20Action-purple?logo=github)](https://github.com/marketplace/actions/darklens-compliance-scan)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DarkLens](https://img.shields.io/badge/Powered%20by-DarkLens.dev-8B5CF6)](https://darklens.dev)

Automate compliance and dark pattern testing in your CI/CD pipeline. Automatically audit pull requests, staging environments, and production deployments for deceptive design patterns, regulatory violations (**FTC Act Sec. 5, GDPR, CCPA/CPRA, EU DSA**), and sneaky checkout traps before shipping code to customers.

- **Native Node 24 Runtime:** Zero external dependencies (`node24`), cross-platform across Ubuntu, macOS, and Windows runners.
- **Rich GitHub Job Summary:** Automatically renders a compliance scorecard showing **what failed, why it matters legally, fair-pattern alternatives, step-by-step fix instructions, and ready-to-paste code snippets**.
- **Optional Non-Blocking Advisory Mode (`fail-on: 'none'`):** Report problems & fixes directly on PRs as non-blocking warnings (`exit 0`) so developers aren't blocked while adopting DarkLens (or set `fail-on: 'critical'` to block only severe violations).
- **Sticky PR Comments (Optional):** Set `comment-pr: 'true'` to automatically post and update a single non-spamming compliance report on Pull Requests.

---

## ⚡ Quickstart

Add DarkLens to any GitHub workflow (e.g., `.github/workflows/compliance.yml`):

```yaml
name: Deceptive Design & Compliance Audit

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write # Only needed if setting comment-pr: 'true'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Run DarkLens Compliance Scan
        uses: bhanu403/darklens-actions@v1
        with:
          url: 'https://staging.myapp.com'
          api-key: ${{ secrets.DARKLENS_API_KEY }}
          threshold: 75
          fail-on: 'score'
          comment-pr: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## ⚙️ Inputs

| Input | Description | Required | Default |
| :--- | :--- | :---: | :---: |
| `url` | The URL of the deployment or staging server to audit (e.g., Vercel preview URL). | **Yes** | — |
| `api-key` | Your DarkLens API key. Get your key at [darklens.dev/dashboard](https://darklens.dev/dashboard). | **Yes** | — |
| `threshold` | Minimum acceptable compliance score (0–100). Fails the build if score drops below threshold. | No | `70` |
| `fail-on` | Failure criterion: `score`, `critical`, `any`, or `none` (`none` = warn-only advisory report without failing PRs). | No | `score` |
| `comment-pr` | Post or update a sticky DarkLens compliance report on Pull Requests (`true`/`false`). | No | `false` |
| `github-token` | GitHub token (`${{ secrets.GITHUB_TOKEN }}`) used when `comment-pr` is `true`. | No | `''` |
| `api-url` | Optional DarkLens CI endpoint override. | No | `https://darklens.dev/api/ci/scan` |

## 📤 Outputs & Environment Variables

| Output | Env Var Exported | Description |
| :--- | :--- | :--- |
| `score` | `DARKLENS_SCORE` | Compliance score (`0–100`) returned by DarkLens |
| `issues-count` | `DARKLENS_ISSUES_COUNT` | Total number of detected dark pattern findings |
| `critical-count` | `DARKLENS_CRITICAL_COUNT` | Total number of critical findings |
| `pass` | `DARKLENS_PASS` | Whether the scan satisfied threshold and fail-on criteria (`true`/`false`) |
| `summary` | — | Concise audit summary string |

### 🎯 Which Threshold Should You Use?

| Threshold | Profile | Recommended For | Build Behavior |
| :---: | :--- | :--- | :--- |
| **`70 – 75`** | **Standard (Recommended)** | General SaaS, E-Commerce, Consumer Apps | Blocks serious deceptive patterns (sneaky subscriptions, fake countdowns, hidden fees) without failing minor copy tweaks. |
| **`85 – 95`** | **Strict Compliance** | Fintech, Banking, Healthcare, EU Regulated | Strict GDPR cookie equality, contrast, and cancellation clarity enforcement. |
| **`50 – 60`** | **Lenient / Redesign** | Legacy platforms undergoing multi-phase redesigns | Catches catastrophic legal traps while legacy flows are refactored. |

---

## 🎯 What Does DarkLens Detect?

DarkLens audits your live rendered DOM across **26+ regulations and deceptive patterns**:

- **FTC Click-to-Cancel Traps:** Roach motel cancellations, phone-only termination requirements.
- **GDPR & ePrivacy Consent:** Pre-consent tracking, asymmetric Accept/Reject cookie banners.
- **CCPA / CPRA:** Missing "Do Not Sell or Share My Personal Information" notices.
- **E-Commerce Sneaking:** Pre-checked add-on checkboxes, drip pricing, hidden recurring fees.
- **Confirmshaming:** Guilt-inducing decline copy ("No thanks, I hate saving money").
- **False Urgency & Scarcity:** Fake countdown timers and fabricated stock claims.
- **WCAG 2.1 AA Accessibility:** Contrast ratios and hidden opt-out elements.

---

## 🔑 Getting Your API Key

1. Sign in at [darklens.dev](https://darklens.dev).
2. Open your [Dashboard Settings](https://darklens.dev/dashboard) and generate an API key (CI/CD scans require an Agency/Enterprise plan or API Credits).
3. In your GitHub repository, go to **Settings > Secrets and variables > Actions > New repository secret**.
4. Name the secret `DARKLENS_API_KEY` and paste your key.

---

## 📄 License

MIT License. Developed with pride by [DarkLens.dev](https://darklens.dev).
