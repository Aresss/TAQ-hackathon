const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = 8080;
const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "wallet-checks.log");

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "pplx-PLACEHOLDER-KEY";
const PERPLEXITY_MODEL = "sonar";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".rtf": "application/rtf",
  ".txt": "text/plain; charset=utf-8"
};

fs.mkdirSync(LOG_DIR, { recursive: true });

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function safePathname(pathname) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(target).replace(/^(\.\.[/\\])+/, "");
  return path.join(ROOT, normalized);
}

function serveStatic(req, res, pathname) {
  const filePath = safePathname(pathname);
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
}

function appendLog(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      req.socket.destroy();
    }
  });

  req.on("end", () => {
    try {
      const parsed = JSON.parse(body || "{}");
      const line = `${JSON.stringify(parsed)}\n`;
      fs.appendFileSync(LOG_FILE, line, "utf8");
      send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
    } catch (_err) {
      send(res, 400, JSON.stringify({ ok: false, error: "Invalid JSON" }), MIME[".json"]);
    }
  });
}

function readLogs(_req, res) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      send(res, 200, "", MIME[".txt"]);
      return;
    }
    const content = fs.readFileSync(LOG_FILE, "utf8");
    send(res, 200, content, MIME[".txt"]);
  } catch (_err) {
    send(res, 500, "Failed to read logs");
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 100) {
        req.socket.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (_) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function callPerplexity(messages) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: messages
    });

    const options = {
      hostname: "api.perplexity.ai",
      port: 443,
      path: "/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode !== 200) {
            reject(
              new Error(parsed.error?.message || `Perplexity API returned ${res.statusCode}`)
            );
            return;
          }
          resolve({
            content: parsed.choices?.[0]?.message?.content || "",
            citations: parsed.citations || []
          });
        } catch (e) {
          reject(new Error("Failed to parse Perplexity response"));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Perplexity API request timed out"));
    });
    req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    if (req.method === "POST" && pathname === "/api/log-check") {
      appendLog(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/osint") {
      const data = await parseJsonBody(req);
      const result = await callPerplexity([
        {
          role: "system",
          content:
            "You are a crypto compliance OSINT analyst specializing in AML investigations. Search ONLY authoritative compliance and blockchain intelligence sources. Prioritize these specific sources:\n\n1. OFAC SDN List and sanctions databases (ofac.treasury.gov, sanctionssearch.ofac.treas.gov)\n2. Blockchain explorers with labeling: Etherscan (etherscan.io labels/tags), Blockchain.com, OXT\n3. Chainalysis, Elliptic, or TRM Labs public reports and alerts\n4. FinCEN advisories and enforcement actions (fincen.gov)\n5. DOJ press releases about crypto seizures or indictments (justice.gov)\n6. FATF reports on virtual assets\n7. Known scam/fraud databases: Chainabuse, CryptoScamDB, ScamSniffer\n8. Europol/Interpol crypto-related notices\n\nDo NOT cite generic news articles or Wikipedia. Only cite primary compliance sources. If the address has no hits in any authoritative database, state that clearly and explain what absence of data means for compliance purposes."
        },
        {
          role: "user",
          content: `Investigate this wallet address across compliance and blockchain intelligence databases:\n\nAddress: ${data.address}\nNetwork: ${data.network}\nDeterministic Risk Score: ${data.score}/100 (${data.tier})\nTriggered Risk Factors: ${(data.factors || []).map((f) => f.label).join(", ") || "None"}\n\nCheck specifically:\n1. Is this address on the OFAC SDN list or any sanctions list?\n2. Does Etherscan or any blockchain explorer have labels/tags for this address?\n3. Is it associated with any known hacks, exploits, or rug pulls?\n4. Has it appeared in any law enforcement actions (DOJ, FinCEN, Europol)?\n5. Is it flagged on Chainabuse, CryptoScamDB, or similar fraud databases?\n6. Any mixer or tumbler service associations (Tornado Cash, Sinbad, etc.)?\n\nReport findings per source. If no results found in a database, say so explicitly.`
        }
      ]);
      send(res, 200, JSON.stringify(result), MIME[".json"]);
      return;
    }

    if (req.method === "POST" && pathname === "/api/narrative") {
      const data = await parseJsonBody(req);
      const result = await callPerplexity([
        {
          role: "system",
          content:
            "You are a senior BSA/AML compliance officer drafting investigation narratives. Write formal, factual text suitable for a Suspicious Activity Report (SAR) filing. Use third-person professional tone. Structure the narrative with: Subject Identification, Activity Description, Risk Indicators, OSINT Findings, and Recommended Action. Do not speculate beyond the evidence provided."
        },
        {
          role: "user",
          content: `Draft a compliance narrative for the following wallet analysis:\n\nSubject Wallet: ${data.address}\nBlockchain Network: ${data.network}\nRisk Score: ${data.score}/100\nRisk Tier: ${data.tier}\nRecommended Action: ${data.action}\n\nTriggered Risk Factors:\n${(data.factors || []).map((f) => `- ${f.label} (+${f.points} points): ${f.details}`).join("\n")}\n\nOSINT Research Summary:\n${data.osintSummary || "No additional OSINT data available."}\n\nGenerate a SAR-ready compliance narrative combining the deterministic scoring results and OSINT findings.`
        }
      ]);
      send(res, 200, JSON.stringify(result), MIME[".json"]);
      return;
    }

    if (req.method === "POST" && pathname === "/api/chat") {
      const data = await parseJsonBody(req);
      const ctx = data.walletContext || {};
      const systemMessage = {
        role: "system",
        content: `You are an AI-powered crypto compliance investigation assistant. You help AML analysts investigate wallet activity by searching for real-time public information. Always cite your sources.\n\nCurrent investigation context:\nWallet: ${ctx.address || "Unknown"}\nNetwork: ${ctx.network || "Unknown"}\nRisk Score: ${ctx.score || "N/A"}/100 (${ctx.tier || "N/A"})\nTriggered Factors: ${(ctx.factors || []).map((f) => f.label).join(", ") || "None"}`
      };
      const messages = [systemMessage, ...(data.messages || [])];
      const result = await callPerplexity(messages);
      send(res, 200, JSON.stringify(result), MIME[".json"]);
      return;
    }

    if (req.method === "GET" && pathname === "/api/logs") {
      readLogs(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, pathname);
      return;
    }

    send(res, 405, "Method Not Allowed");
  } catch (err) {
    send(res, 502, JSON.stringify({ error: err.message }), MIME[".json"]);
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Wallet check logs: ${LOG_FILE}`);
});
