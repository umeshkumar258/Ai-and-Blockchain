require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  addBlockchainLog,
  analyzeLead,
  blockchainLogs,
  logLeadToBlockchain,
  sanitizeLeadInput,
  sendLeadEmail,
} = require("./core");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "AI Startup Automation Tool backend is running." });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/get-logs", (req, res) => {
  return res.json({ logs: blockchainLogs });
});

app.post("/analyze", (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name && !email && !message) {
      return res.status(400).json({ message: "Please provide lead data." });
    }

    const sanitizedLead = sanitizeLeadInput(req.body);
    const analysis = analyzeLead(sanitizedLead.message);
    console.log(`[/analyze] ${sanitizedLead.email} => ${analysis.status}`);

    return res.json({
      ...sanitizedLead,
      status: analysis.status,
      explanation: analysis.explanation,
      suggestedReply: analysis.suggestedReply,
    });
  } catch (error) {
    console.error("Error in /analyze:", error.stack || error);
    return res.status(500).json({ message: "Failed to analyze lead." });
  }
});

app.post("/send-email", async (req, res) => {
  const { email, suggestedReply } = req.body || {};

  if (!email || !suggestedReply) {
    return res.status(400).json({ message: "Please provide email and suggestedReply." });
  }

  try {
    const info = await sendLeadEmail(
      email,
      "Response from AI Startup Automation Tool",
      suggestedReply
    );

    return res.json({
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Error in /send-email:", error.stack || error);
    return res.status(500).json({
      message: error.message || "Failed to send email.",
    });
  }
});

app.post("/log-to-blockchain", async (req, res) => {
  const { email, status, timestamp } = req.body || {};

  if (!email || !status) {
    return res.status(400).json({ message: "Please provide email and status." });
  }

  try {
    const logTime = timestamp || new Date().toISOString();
    const result = await logLeadToBlockchain(email, status, logTime);

    addBlockchainLog({
      email,
      status,
      timestamp: logTime,
      txHash: result.txHash,
    });

    return res.json({
      txHash: result.txHash,
      mode: result.mode,
      network: result.network,
    });
  } catch (error) {
    console.error("Error in /log-to-blockchain:", error.stack || error);
    return res.status(500).json({
      message: "Failed to log lead to blockchain.",
      error: error.message,
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
