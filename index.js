'use strict';

const crypto = require('crypto');
const fs = require('fs');

const ALLOWED_FAIL_ON = new Set(['score', 'critical', 'any', 'none']);
const DEFAULT_API_URL = 'https://darklens.dev/api/ci/scan';
const PR_COMMENT_MARKER = '<!-- darklens-compliance-report -->';
const REQUEST_TIMEOUT_MS = 65000;

function getInput(name, fallback = '') {
  const upper = String(name || '').trim().replace(/ /g, '_').toUpperCase();
  const withUnderscore = upper.replace(/-/g, '_');
  const hyphenVal = process.env[`INPUT_${upper}`];
  const underVal = process.env[`INPUT_${withUnderscore}`];
  const raw = hyphenVal !== undefined && hyphenVal !== '' ? hyphenVal : underVal;
  return raw !== undefined && raw !== '' ? String(raw).trim() : fallback;
}

function sanitizeSingleLine(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeMarkdownCell(value) {
  return sanitizeSingleLine(value)
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function validateTargetUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    throw new Error("Missing required input 'url'.");
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid url '${trimmed}'. Must be a valid http:// or https:// URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid url protocol '${parsed.protocol}'. Must start with http:// or https://.`);
  }
  return parsed.href;
}

function validateApiUrl(rawApiUrl) {
  const candidate = String(rawApiUrl || '').trim() || DEFAULT_API_URL;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid api-url '${candidate}'.`);
  }
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(isLocal && parsed.protocol === 'http:')) {
    throw new Error("Input 'api-url' must use https:// (or http://localhost for local testing).");
  }
  return parsed.href;
}

function validateThreshold(rawThreshold) {
  const trimmed = String(rawThreshold ?? '70').trim() || '70';
  if (!/^(0|[1-9][0-9]*)$/.test(trimmed)) {
    throw new Error(`Invalid threshold '${trimmed}'. Must be an integer between 0 and 100 without leading zeros.`);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`Invalid threshold '${trimmed}'. Must be between 0 and 100.`);
  }
  return n;
}

function validateFailOn(rawFailOn) {
  const normalized = (String(rawFailOn || '').trim() || 'score').toLowerCase();
  if (!ALLOWED_FAIL_ON.has(normalized)) {
    throw new Error(`Invalid fail-on '${normalized}'. Expected 'score', 'critical', 'any', or 'none'.`);
  }
  return normalized;
}

function maskSecret(secret) {
  if (!secret) return;
  for (const line of String(secret).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`::add-mask::${trimmed}`);
    }
  }
}

function writeKeyValueFile(filePath, pairs) {
  if (!filePath) return;
  const lines = [];
  for (const [key, value] of Object.entries(pairs)) {
    const str = String(value ?? '');
    if (/[\r\n]/.test(str)) {
      const delimiter = `EOF_${crypto.randomBytes(8).toString('hex')}`;
      lines.push(`${key}<<${delimiter}\n${str}\n${delimiter}\n`);
    } else {
      lines.push(`${key}=${str}\n`);
    }
  }
  fs.appendFileSync(filePath, lines.join(''), 'utf8');
}

function appendStepSummary(filePath, markdown) {
  if (!filePath || !markdown) return;
  fs.appendFileSync(filePath, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
}

function buildReportMarkdown(data, targetUrl, threshold, failOn) {
  const advisoryOnly = failOn === 'none';
  const passed = advisoryOnly ? true : data.pass === true;
  const score = Number.isFinite(Number(data.score)) ? Number(data.score) : 0;
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const counts = data.counts || {};
  const critCount = Number.isFinite(Number(counts.critical))
    ? Number(counts.critical)
    : findings.filter((f) => String(f.severity || '').toLowerCase() === 'critical').length;
  const highCount = Number.isFinite(Number(counts.high)) ? Number(counts.high) : 0;
  const medCount = Number.isFinite(Number(counts.medium)) ? Number(counts.medium) : 0;
  const lowCount = Number.isFinite(Number(counts.low)) ? Number(counts.low) : 0;

  const badge = advisoryOnly && findings.length > 0 ? 'PASSED (Advisory Only)' : (passed ? 'PASSED' : 'FAILED');
  const statusIcon = advisoryOnly && findings.length > 0 ? '⚠️' : (passed ? '✅' : '❌');
  const gateText = advisoryOnly
    ? '`fail-on: none` (Advisory / non-blocking)'
    : `Threshold \`>= ${threshold}\` (\`fail-on: ${failOn}\`)`;

  const lines = [
    PR_COMMENT_MARKER,
    `## ${statusIcon} DarkLens Compliance Report — **${badge}**`,
    '',
    '| Metric | Value |',
    '| :--- | :--- |',
    `| **Target URL** | ${escapeMarkdownCell(targetUrl)} |`,
    `| **Compliance Score** | **${score} / 100** |`,
    `| **Policy Gate** | ${gateText} |`,
    `| **Findings** | ${findings.length} (${critCount} Critical, ${highCount} High, ${medCount} Medium, ${lowCount} Low) |`,
    '',
  ];

  if (data.failReason && !passed) {
    lines.push(`> **Why This Check Failed:** ${escapeMarkdownCell(data.failReason)} — Fix the violations below (or set \`fail-on: none\` / \`fail-on: critical\` for non-blocking or critical-only checks).`, '');
  } else if (advisoryOnly && findings.length > 0) {
    lines.push('> **Advisory Mode (`fail-on: none`):** Violations were found below, but build blocking is disabled so your PR can still merge.', '');
  }

  if (data.summary) {
    lines.push(`**Summary:** ${escapeMarkdownCell(data.summary)}`, '');
  }

  const overallRisk = data.overallRisk || null;
  if (overallRisk) {
    if (Array.isArray(overallRisk.countriesAtRisk) && overallRisk.countriesAtRisk.length > 0) {
      lines.push(`**Jurisdictions at Risk:** ${overallRisk.countriesAtRisk.map(escapeMarkdownCell).join(', ')}`, '');
    }
    if (overallRisk.recommendation) {
      lines.push(`**AI Recommendation:** ${escapeMarkdownCell(overallRisk.recommendation)}`, '');
    }
  }

  if (findings.length > 0) {
    lines.push(
      '### Detected Issues (What Is Wrong & How to Fix)',
      '',
      '| Severity | What Is Wrong | Law / Rule | How to Fix |',
      '| :--- | :--- | :--- | :--- |'
    );
    for (const f of findings.slice(0, 25)) {
      const sev = escapeMarkdownCell((f.severity || 'issue').toUpperCase());
      const name = escapeMarkdownCell(f.name || 'Compliance Issue');
      const desc = f.description ? `<br/>${escapeMarkdownCell(f.description)}` : '';
      const reg = escapeMarkdownCell(f.regulation || 'FTC / GDPR / EU DSA');
      const fair = escapeMarkdownCell(f.fairAlternative || 'See remediation steps below');
      lines.push(`| **${sev}** | **${name}**${desc} | ${reg} | ${fair} |`);
    }
    if (findings.length > 25) {
      lines.push('', `*...and ${findings.length - 25} more finding(s) on your dashboard.*`);
    }

    const withDetails = findings.slice(0, 10).filter(
      (f) => f.description || f.element || f.fairAlternative || (Array.isArray(f.fixSteps) && f.fixSteps.length > 0) || f.fixCodeSnippet
    );
    if (withDetails.length > 0) {
      lines.push('', '<details>', `<summary>Step-by-Step Solutions & Ready Code Snippets (${withDetails.length})</summary>`, '');
      withDetails.forEach((f, idx) => {
        lines.push(`#### ${idx + 1}. [${escapeMarkdownCell((f.severity || 'issue').toUpperCase())}] ${escapeMarkdownCell(f.name || 'Issue')}`);
        if (f.description) {
          lines.push(`- **Problem:** ${escapeMarkdownCell(f.description)}`);
        }
        if (f.element) {
          lines.push(`- **Element Found:** \`${sanitizeSingleLine(f.element).replace(/`/g, "'")}\``);
        }
        if (f.fairAlternative) {
          lines.push(`- **Solution (Fair Alternative):** ${escapeMarkdownCell(f.fairAlternative)}`);
        }
        if (Array.isArray(f.fixSteps) && f.fixSteps.length > 0) {
          lines.push('- **Fix Steps:**');
          f.fixSteps.forEach((step) => lines.push(`  - ${sanitizeSingleLine(step)}`));
        }
        if (f.fixCodeSnippet) {
          lines.push('', '```html', String(f.fixCodeSnippet).trim(), '```');
        }
        lines.push('');
      });
      lines.push('</details>');
    }
  } else {
    lines.push('No dark patterns or compliance violations detected.');
  }

  lines.push('', '*Audited by [DarkLens](https://darklens.dev/dashboard)*');
  return lines.join('\n');
}

function emitAnnotationsAndConsoleReport(passed, findings, failReason) {
  if (!passed) {
    console.log(`::error::Dark pattern check failed! ${sanitizeSingleLine(failReason || 'Compliance criteria not met.')}`);
  }
  const level = passed ? 'warning' : 'error';
  findings.forEach((f, idx) => {
    const sev = sanitizeSingleLine(f.severity || 'issue').toUpperCase();
    const name = sanitizeSingleLine(f.name || 'Unknown issue');
    const reg = sanitizeSingleLine(f.regulation || '');
    const desc = sanitizeSingleLine(f.description || '');
    const elem = sanitizeSingleLine(f.element || '');
    const fix = sanitizeSingleLine(f.fairAlternative || '');

    // Readable console breakdown for developers inspecting workflow logs directly
    console.log(`\n  [${idx + 1}] [${sev}] ${name}${reg ? ` (${reg})` : ''}`);
    if (desc) console.log(`      Problem:  ${desc}`);
    if (elem) console.log(`      Element:  ${elem}`);
    if (fix) console.log(`      Solution: ${fix}`);
    if (Array.isArray(f.fixSteps) && f.fixSteps.length > 0) {
      console.log(`      Steps:    ${f.fixSteps.map((s) => sanitizeSingleLine(s)).join(' -> ')}`);
    }

    // Keep GitHub workflow annotations within GitHub's 10-per-step display cap
    if (idx < 10) {
      const parts = [`[${sev}] ${name}`];
      if (desc) parts.push(`— Problem: ${desc}`);
      if (fix) parts.push(`| Solution: ${fix}`);
      if (reg) parts.push(`(${reg})`);
      console.log(`::${level}::${parts.join(' ')}`);
    }
  });
  if (findings.length > 0) console.log('');
}

async function postOrUpdatePrComment({ token, markdown }) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repoFull = process.env.GITHUB_REPOSITORY;
  const apiBase = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
  if (!token || !eventPath || !repoFull || !fs.existsSync(eventPath)) {
    return;
  }

  let event;
  try {
    event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch {
    return;
  }

  const prNumber = event?.pull_request?.number || event?.issue?.number;
  if (!prNumber) {
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'DarkLens-GitHub-Action/1.1.0',
    'Content-Type': 'application/json',
  };

  try {
    const listUrl = `${apiBase}/repos/${repoFull}/issues/${prNumber}/comments?per_page=100`;
    const listRes = await fetch(listUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (!listRes.ok) {
      console.log(`::warning::Could not list PR comments (HTTP ${listRes.status}); skipping PR comment.`);
      return;
    }
    const comments = await listRes.json();
    const existing = Array.isArray(comments)
      ? comments.find((c) => typeof c.body === 'string' && c.body.includes(PR_COMMENT_MARKER))
      : null;

    if (existing && existing.id) {
      const updateUrl = `${apiBase}/repos/${repoFull}/issues/comments/${existing.id}`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ body: markdown }),
        signal: AbortSignal.timeout(15000),
      });
      if (!updateRes.ok) {
        console.log(`::warning::Could not update PR comment (HTTP ${updateRes.status}).`);
      }
      return;
    }

    const createUrl = `${apiBase}/repos/${repoFull}/issues/${prNumber}/comments`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: markdown }),
      signal: AbortSignal.timeout(15000),
    });
    if (!createRes.ok) {
      console.log(`::warning::Could not create PR comment (HTTP ${createRes.status}). Ensure pull-requests: write permission or read-only fork handling.`);
    }
  } catch (err) {
    console.log(`::warning::Failed to post PR comment: ${sanitizeSingleLine(err.message)}`);
  }
}

async function run() {
  const apiKey = getInput('api-key');
  maskSecret(apiKey);
  if (!apiKey) {
    console.log('::error::Missing required input api-key. Set secrets.DARKLENS_API_KEY from https://darklens.dev/dashboard');
    process.exitCode = 1;
    return;
  }

  let targetUrl;
  let apiUrl;
  let threshold;
  let failOn;
  try {
    targetUrl = validateTargetUrl(getInput('url'));
    apiUrl = validateApiUrl(getInput('api-url', DEFAULT_API_URL));
    threshold = validateThreshold(getInput('threshold', '70'));
    failOn = validateFailOn(getInput('fail-on', 'score'));
  } catch (err) {
    console.log(`::error::${sanitizeSingleLine(err.message)}`);
    process.exitCode = 1;
    return;
  }

  const commentPr = getInput('comment-pr', 'false').toLowerCase() === 'true';
  const githubToken = getInput('github-token') || String(process.env.GITHUB_TOKEN || '').trim();
  if (githubToken) maskSecret(githubToken);

  console.log(`Starting DarkLens Compliance Scan on ${targetUrl} (threshold=${threshold}, fail-on=${failOn})...`);

  let res;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DarkLens-GitHub-Action/1.1.0',
      },
      body: JSON.stringify({
        url: targetUrl,
        threshold,
        failOn,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err && (err.name === 'TimeoutError' || err.name === 'AbortError')
      ? `DarkLens API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
      : `Failed to connect to DarkLens API: ${sanitizeSingleLine(err && err.message ? err.message : String(err))}`;
    console.log(`::error::${msg}`);
    process.exitCode = 1;
    return;
  }

  const rawText = await res.text();
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    console.log(`::error::DarkLens API returned non-JSON response (HTTP ${res.status} ${res.statusText}).`);
    process.exitCode = 1;
    return;
  }

  if (res.status !== 200 && res.status !== 422) {
    const errTitle = sanitizeSingleLine(data.error || `HTTP ${res.status}`);
    const errMsg = sanitizeSingleLine(data.message || res.statusText || 'Request failed');
    console.log(`::error::DarkLens API Error (${res.status}): ${errTitle} - ${errMsg}`);
    appendStepSummary(
      process.env.GITHUB_STEP_SUMMARY,
      `## ❌ DarkLens Compliance Scan Error\n\n- **HTTP Status:** ${res.status}\n- **Error:** ${escapeMarkdownCell(errTitle)}\n- **Details:** ${escapeMarkdownCell(errMsg)}\n`
    );
    process.exitCode = 1;
    return;
  }

  const findings = Array.isArray(data.findings) ? data.findings : [];
  const passed = failOn === 'none' ? true : data.pass === true;
  const score = Number.isFinite(Number(data.score)) ? Math.round(Number(data.score)) : 0;
  const issuesCount = findings.length;
  const criticalCount = Number.isFinite(Number(data?.counts?.critical))
    ? Number(data.counts.critical)
    : findings.filter((f) => String(f.severity || '').toLowerCase() === 'critical').length;
  const summaryText = sanitizeSingleLine(data.summary || (passed ? 'No deceptive patterns detected.' : 'Compliance violations detected.'));

  writeKeyValueFile(process.env.GITHUB_OUTPUT, {
    score,
    'issues-count': issuesCount,
    'critical-count': criticalCount,
    pass: passed ? 'true' : 'false',
    summary: summaryText,
  });

  writeKeyValueFile(process.env.GITHUB_ENV, {
    DARKLENS_SCORE: score,
    DARKLENS_ISSUES_COUNT: issuesCount,
    DARKLENS_CRITICAL_COUNT: criticalCount,
    DARKLENS_PASS: passed ? 'true' : 'false',
  });

  const markdown = buildReportMarkdown(data, targetUrl, threshold, failOn);
  appendStepSummary(process.env.GITHUB_STEP_SUMMARY, markdown);

  if (commentPr) {
    if (!githubToken) {
      console.log('::warning::Skipping PR comment: pass "github-token: ${{ secrets.GITHUB_TOKEN }}" when comment-pr is true.');
    } else {
      await postOrUpdatePrComment({ token: githubToken, markdown });
    }
  }

  console.log('======================================');
  console.log(`DarkLens Score: ${score} / 100 (${passed ? (failOn === 'none' && issuesCount > 0 ? 'ADVISORY PASS' : 'PASS') : 'FAIL'})`);
  console.log(`Threshold:      ${threshold} (Criterion: ${failOn})`);
  console.log(`Findings:       ${issuesCount} (${criticalCount} Critical)`);
  console.log('======================================');

  emitAnnotationsAndConsoleReport(passed, findings, data.failReason);

  if (!passed) {
    process.exitCode = 1;
    return;
  }

  console.log(failOn === 'none' && issuesCount > 0
    ? 'DarkLens advisory scan complete (non-blocking fail-on: none). See warnings & PR summary above.'
    : 'Dark pattern check passed! Compliance gate satisfied.');
}

if (require.main === module) {
  run().catch((err) => {
    console.log(`::error::Unexpected DarkLens Action failure: ${sanitizeSingleLine(err && err.message ? err.message : String(err))}`);
    process.exitCode = 1;
  });
}

module.exports = {
  run,
  validateTargetUrl,
  validateApiUrl,
  validateThreshold,
  validateFailOn,
  buildReportMarkdown,
  escapeMarkdownCell,
};
