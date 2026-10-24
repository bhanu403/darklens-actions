# 🛡️ DarkLens GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-DarkLens%20Action-purple?logo=github)](https://github.com/marketplace/actions/darklens-compliance-scan)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DarkLens](https://img.shields.io/badge/Powered%20by-DarkLens.dev-8B5CF6)](https://darklens.dev)

Automate compliance and dark pattern testing in your CI/CD pipeline. Automatically audit pull requests, staging environments, and production deployments for deceptive design patterns, regulatory violations (FTC, GDPR, CCPA/CPRA, EU DSA), and sneaky recurring checkout traps before shipping code to customers.

---

## ⚡ Quickstart

Add DarkLens to any GitHub workflow (e.g., `.github/workflows/compliance.yml`):

```yaml
name: Deceptive Design & Compliance Audit

on:
  deployment_status:
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run DarkLens Compliance Scan
        uses: bhanu403/darklens-actions@v1
        with:
          url: 'https://staging.myapp.com'
          api-key: ${{ secrets.DARKLENS_API_KEY }}
          threshold: 75
```

---

## ⚙️ Inputs

| Input | Description | Required | Default |
| :--- | :--- | :---: | :---: |
| `url` | The URL of the deployment or staging server to audit (e.g., `https://staging.myapp.com` or Vercel preview URL). | **Yes** | — |
| `api-key` | Your DarkLens API key. Get your key free at [darklens.dev/dashboard](https://darklens.dev/dashboard). | **Yes** | — |
| `threshold` | Minimum acceptable compliance score (0–100). The action will fail the build if the audit score falls below this threshold. | No | `70` |

---

## 🎯 What Does DarkLens Detect?

DarkLens audits your live DOM across **26 deceptive design and compliance categories**:

- **FTC Click-to-Cancel Traps:** Roach motel cancellations, phone-only termination requirements.
- **GDPR & ePrivacy Consent:** Pre-consent tracking, asymmetric Accept/Reject cookie banners.
- **CCPA / CPRA:** Missing "Do Not Sell or Share My Personal Information" notices.
- **E-Commerce Sneaking:** Pre-checked addon checkboxes, drip pricing, hidden recurring fees.
- **Confirmshaming:** Manipulative guilt-inducing modal copy ("No thanks, I hate saving money").
- **False Urgency & Scarcity:** Manipulative countdown timers and fabricated stock claims.
- **WCAG 2.1 AA Accessibility:** Unlabeled inputs, broken screen reader contrast, missing labels.

---

## 🔑 Getting Your API Key

1. Create a free account at [darklens.dev](https://darklens.dev).
2. Go to your [Dashboard Settings](https://darklens.dev/dashboard) and generate an API key.
3. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions > New repository secret**.
4. Name the secret `DARKLENS_API_KEY` and paste your key.

---

## 📄 License

MIT License. Developed with pride by [DarkLens.dev](https://darklens.dev).
