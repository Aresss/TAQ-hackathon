const RULES = [
  {
    key: "sanctions_adjacent",
    label: "Exposure to sanctions-adjacent addresses",
    weight: 35,
    evaluate: (p) => p.sanctions_adjacent > 0,
    details: (p) =>
      `This wallet is linked to ${p.sanctions_adjacent} sanctions-adjacent counterparty interaction(s), which is treated as a major AML red flag because funds can be indirectly connected to restricted flows. In this MVP model, any non-zero value is considered material enough to increase escalation priority. Reference: wallet ${p.address} on ${p.network}, field "sanctions_adjacent" = ${p.sanctions_adjacent} from ${p.sourceLabel}.`
  },
  {
    key: "mixer_interactions",
    label: "Mixer interactions detected",
    weight: 25,
    evaluate: (p) => p.mixer_interactions >= 2,
    details: (p) =>
      `The profile shows ${p.mixer_interactions} mixer interaction(s), exceeding the threshold of 2 in this deterministic ruleset. Mixer usage can reduce traceability and is often reviewed for layering behavior, so this significantly raises risk in the report. Reference: wallet ${p.address} on ${p.network}, field "mixer_interactions" = ${p.mixer_interactions} from ${p.sourceLabel}.`
  },
  {
    key: "high_velocity_burst",
    label: "High-velocity transaction burst",
    weight: 15,
    evaluate: (p) => p.high_velocity_burst === true,
    details: (p) =>
      `A high-velocity burst flag is active for this wallet, indicating unusually compressed transaction activity over a short window. In AML screening, this pattern can be consistent with rapid movement strategies intended to complicate follow-the-money analysis, so it contributes additional points. Reference: wallet ${p.address} on ${p.network}, field "high_velocity_burst" = ${p.high_velocity_burst} from ${p.sourceLabel}.`
  },
  {
    key: "wallet_age_days",
    label: "New wallet with short history",
    weight: 10,
    evaluate: (p) => p.wallet_age_days < 30,
    details: (p) =>
      `This wallet is only ${p.wallet_age_days} day(s) old, below the 30-day threshold used in the MVP. Young wallets with limited historical behavior are harder to contextualize, so the model applies a cautionary uplift until a stronger activity baseline exists. Reference: wallet ${p.address} on ${p.network}, field "wallet_age_days" = ${p.wallet_age_days} from ${p.sourceLabel}.`
  },
  {
    key: "flagged_entity_exposure",
    label: "Counterparty exposure to flagged entities",
    weight: 20,
    evaluate: (p) => p.flagged_entity_exposure >= 1,
    details: (p) =>
      `The wallet has ${p.flagged_entity_exposure} recorded exposure event(s) to flagged entities, which directly increases AML concern due to known risk linkage on counterparties. Because this signal points to explicit adverse exposure rather than weak heuristics, it is weighted heavily in the score. Reference: wallet ${p.address} on ${p.network}, field "flagged_entity_exposure" = ${p.flagged_entity_exposure} from ${p.sourceLabel}.`
  },
  {
    key: "cross_chain_hops",
    label: "Frequent cross-chain hopping",
    weight: 10,
    evaluate: (p) => p.cross_chain_hops >= 5,
    details: (p) =>
      `The profile indicates ${p.cross_chain_hops} cross-chain hop(s), above the threshold of 5 for this ruleset. Frequent bridge movement can fragment transaction trails across ecosystems, so the model records this as a moderate risk amplifier in conjunction with other factors. Reference: wallet ${p.address} on ${p.network}, field "cross_chain_hops" = ${p.cross_chain_hops} from ${p.sourceLabel}.`
  },
  {
    key: "risky_counterparty_ratio",
    label: "High risky counterparty ratio",
    weight: 15,
    evaluate: (p) => p.risky_counterparty_ratio >= 0.3,
    details: (p) =>
      `The risky counterparty ratio is ${p.risky_counterparty_ratio}, which breaches the 0.30 cutoff in this model. A larger share of risky counterparties can indicate sustained interaction with lower-trust addresses rather than isolated noise, so the score is increased accordingly. Reference: wallet ${p.address} on ${p.network}, field "risky_counterparty_ratio" = ${p.risky_counterparty_ratio} from ${p.sourceLabel}.`
  },
  {
    key: "structured_amounts",
    label: "Potential structuring in transfer amounts",
    weight: 12,
    evaluate: (p) => p.structured_amounts === true,
    details: (p) =>
      `Structured transfer behavior is flagged as true, suggesting repeated patterned amounts that may reflect intentional transaction splitting. This can be a classic AML warning signal when combined with other adverse indicators, so the model adds targeted points for review. Reference: wallet ${p.address} on ${p.network}, field "structured_amounts" = ${p.structured_amounts} from ${p.sourceLabel}.`
  },
  {
    key: "privacy_coin_exposure",
    label: "Privacy coin exposure observed",
    weight: 8,
    evaluate: (p) => p.privacy_coin_exposure > 0,
    details: (p) =>
      `The wallet has ${p.privacy_coin_exposure} privacy-coin exposure event(s), which contributes incremental uncertainty to provenance analysis. In this MVP, any non-zero exposure is treated as a secondary but relevant risk signal and contributes additional score weight. Reference: wallet ${p.address} on ${p.network}, field "privacy_coin_exposure" = ${p.privacy_coin_exposure} from ${p.sourceLabel}.`
  }
];

const SCENARIOS = {
  clean: {
    address: "0x11aa22bb33cc44dd55ee66ff77889900aabbccdd",
    network: "Ethereum",
    sourceLabel: "demo scenario: clean wallet",
    sanctions_adjacent: 0,
    mixer_interactions: 0,
    high_velocity_burst: false,
    wallet_age_days: 420,
    flagged_entity_exposure: 0,
    cross_chain_hops: 1,
    risky_counterparty_ratio: 0.04,
    structured_amounts: false,
    privacy_coin_exposure: 0
  },
  medium: {
    address: "0xbbbb22bb33cc44dd55ee66ff77889900aabb88ef",
    network: "Ethereum",
    sourceLabel: "demo scenario: mixer exposure",
    sanctions_adjacent: 0,
    mixer_interactions: 3,
    high_velocity_burst: true,
    wallet_age_days: 120,
    flagged_entity_exposure: 0,
    cross_chain_hops: 4,
    risky_counterparty_ratio: 0.22,
    structured_amounts: false,
    privacy_coin_exposure: 0
  },
  high: {
    address: "0xdead22bb33cc44dd55ee66ff77889900aabc9999",
    network: "Ethereum",
    sourceLabel: "demo scenario: sanctions adjacent",
    sanctions_adjacent: 2,
    mixer_interactions: 6,
    high_velocity_burst: true,
    wallet_age_days: 9,
    flagged_entity_exposure: 2,
    cross_chain_hops: 8,
    risky_counterparty_ratio: 0.56,
    structured_amounts: true,
    privacy_coin_exposure: 4
  }
};

const nodes = {
  networkSelect: document.getElementById("networkSelect"),
  walletAddress: document.getElementById("walletAddress"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  csvInput: document.getElementById("csvInput"),
  riskScore: document.getElementById("riskScore"),
  riskTier: document.getElementById("riskTier"),
  riskAction: document.getElementById("riskAction"),
  factorList: document.getElementById("factorList")
};

async function logWalletCheck(profile, report) {
  const payload = {
    timestamp: new Date().toISOString(),
    address: profile.address,
    network: profile.network,
    sourceLabel: profile.sourceLabel,
    score: report.score,
    tier: report.tier,
    action: report.action,
    triggeredFactors: report.factors.map((factor) => ({
      label: factor.label,
      points: factor.points
    }))
  };

  try {
    await fetch("/api/log-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (_err) {
    // Logging should not block the UI scoring flow.
  }
}

function toTier(score) {
  if (score >= 70) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

function toAction(tier) {
  if (tier === "High") return "Escalate";
  if (tier === "Medium") return "Manual Review";
  return "Allow";
}

function calculateRisk(profile) {
  const matched = RULES.filter((rule) => rule.evaluate(profile));
  const rawScore = matched.reduce((acc, rule) => acc + rule.weight, 0);
  const score = Math.min(100, rawScore);
  const tier = toTier(score);
  const action = toAction(tier);

  return {
    score,
    tier,
    action,
    factors: matched.map((rule) => ({
      label: rule.label,
      points: rule.weight,
      details: rule.details(profile)
    }))
  };
}

function renderReport(report) {
  nodes.riskScore.textContent = String(report.score);
  nodes.riskTier.textContent = report.tier;
  nodes.riskAction.textContent = report.action;

  nodes.riskTier.classList.remove("tier-low", "tier-medium", "tier-high");
  nodes.riskTier.classList.add(`tier-${report.tier.toLowerCase()}`);

  nodes.factorList.innerHTML = "";
  if (report.factors.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No significant risk indicators were triggered.";
    nodes.factorList.appendChild(li);
    return;
  }

  report.factors
    .sort((a, b) => b.points - a.points)
    .forEach((factor) => {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `${factor.label} (+${factor.points})`;
      const paragraph = document.createElement("p");
      paragraph.textContent = factor.details;
      li.appendChild(title);
      li.appendChild(paragraph);
      nodes.factorList.appendChild(li);
    });
}

function parseCSVText(csvText, fileName) {
  const [headerLine, firstDataLine] = csvText.trim().split(/\r?\n/);
  if (!headerLine || !firstDataLine) {
    throw new Error("CSV needs header and one data row.");
  }

  const headers = headerLine.split(",").map((h) => h.trim());
  const values = firstDataLine.split(",").map((v) => v.trim());

  const row = {};
  headers.forEach((h, idx) => {
    row[h] = values[idx];
  });

  return {
    address: row.wallet_address || nodes.walletAddress.value || "uploaded-wallet",
    network: row.network || nodes.networkSelect.value,
    sourceLabel: `CSV file "${fileName}" row 2`,
    sanctions_adjacent: Number(row.sanctions_adjacent || 0),
    mixer_interactions: Number(row.mixer_interactions || 0),
    high_velocity_burst: String(row.high_velocity_burst).toLowerCase() === "true",
    wallet_age_days: Number(row.wallet_age_days || 999),
    flagged_entity_exposure: Number(row.flagged_entity_exposure || 0),
    cross_chain_hops: Number(row.cross_chain_hops || 0),
    risky_counterparty_ratio: Number(row.risky_counterparty_ratio || 0),
    structured_amounts: String(row.structured_amounts).toLowerCase() === "true",
    privacy_coin_exposure: Number(row.privacy_coin_exposure || 0)
  };
}

function runBasicAnalysis() {
  const profile = {
    ...SCENARIOS.clean,
    address: nodes.walletAddress.value || SCENARIOS.clean.address,
    network: nodes.networkSelect.value,
    sourceLabel: "manual wallet input (default clean baseline metrics)"
  };
  const report = calculateRisk(profile);
  renderReport(report);
  logWalletCheck(profile, report);
}

document.querySelectorAll(".scenario-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.getAttribute("data-scenario");
    const profile = SCENARIOS[key];
    nodes.walletAddress.value = profile.address;
    nodes.networkSelect.value = profile.network;
    const report = calculateRisk(profile);
    renderReport(report);
    logWalletCheck(profile, report);
  });
});

nodes.analyzeBtn.addEventListener("click", runBasicAnalysis);

nodes.csvInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const profile = parseCSVText(text, file.name);
    const report = calculateRisk(profile);
    renderReport(report);
    logWalletCheck(profile, report);
  } catch (err) {
    alert(`CSV parse error: ${err.message}`);
  }
});
