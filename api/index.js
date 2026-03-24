const {
  addBlockchainLog,
  analyzeLead,
  blockchainLogs,
  logLeadToBlockchain,
  sanitizeLeadInput,
  sendLeadEmail,
} = require("../backend/core");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function normalizePath(pathValue) {
  if (Array.isArray(pathValue)) {
    return pathValue.join("/");
  }

  return String(pathValue || "").replace(/^\/+|\/+$/g, "");
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  return new Promise((resolve, reject) => {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
    });

    req.on("end", () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const path = normalizePath(req.query.path);

  try {
    if (req.method === "GET" && (path === "" || path === "index")) {
      sendJson(res, 200, { status: "ok", message: "AI Startup Automation Tool API is running." });
      return;
    }

    if (req.method === "GET" && path === "health") {
      sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
      return;
    }

    if (req.method === "GET" && path === "get-logs") {
      sendJson(res, 200, { logs: blockchainLogs });
      return;
    }

    if (req.method === "POST" && path === "analyze") {
      const body = await readJsonBody(req);
      const { name, email, message } = body;

      if (!name && !email && !message) {
        sendJson(res, 400, { message: "Please provide lead data." });
        return;
      }

      const sanitizedLead = sanitizeLeadInput(body);
      const analysis = analyzeLead(sanitizedLead.message);

      sendJson(res, 200, {
        ...sanitizedLead,
        status: analysis.status,
        explanation: analysis.explanation,
        suggestedReply: analysis.suggestedReply,
      });
      return;
    }

    if (req.method === "POST" && path === "send-email") {
      const body = await readJsonBody(req);
      const { email, suggestedReply } = body;

      if (!email || !suggestedReply) {
        sendJson(res, 400, { message: "Please provide email and suggestedReply." });
        return;
      }

      const info = await sendLeadEmail(
        email,
        "Response from AI Startup Automation Tool",
        suggestedReply
      );

      sendJson(res, 200, {
        message: "Email sent successfully",
        messageId: info.messageId,
      });
      return;
    }

    if (req.method === "POST" && path === "log-to-blockchain") {
      const body = await readJsonBody(req);
      const { email, status, timestamp } = body;

      if (!email || !status) {
        sendJson(res, 400, { message: "Please provide email and status." });
        return;
      }

      const logTime = timestamp || new Date().toISOString();
      const result = await logLeadToBlockchain(email, status, logTime);

      addBlockchainLog({
        email,
        status,
        timestamp: logTime,
        txHash: result.txHash,
      });

      sendJson(res, 200, {
        txHash: result.txHash,
        mode: result.mode,
        network: result.network,
      });
      return;
    }

    sendJson(res, 404, { message: "Route not found." });
  } catch (error) {
    sendJson(res, 500, {
      message: error.message || "Unexpected server error.",
    });
  }
};
