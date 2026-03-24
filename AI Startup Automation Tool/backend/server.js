require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 5000;
const SHARDEUM_RPC_URL = "https://api-mezame.shardeum.org";
const provider = new ethers.JsonRpcProvider(SHARDEUM_RPC_URL);
const blockchainLogs = [];

app.use(cors());
// Limit request body size to prevent abuse
app.use(express.json({ limit: "1mb" }));

const hotKeywords = ["buy", "price"];
const mediumKeywords = ["info", "details"];

function analyzeLead(message = "") {
  const content = message.toLowerCase();

  if (hotKeywords.some((keyword) => content.includes(keyword))) {
    return {
      status: "HOT",
      explanation: "User shows buying intent",
      suggestedReply: "Thank you for your interest! Here are the details...",
    };
  }

  if (mediumKeywords.some((keyword) => content.includes(keyword))) {
    return {
      status: "MEDIUM",
      explanation: "User is asking for information",
      suggestedReply: "Thanks for reaching out! We will share more details soon.",
    };
  }

  return {
    status: "COLD",
    explanation: "Low intent message",
    suggestedReply: "Thank you for contacting us. We will get back if needed.",
  };
}

function createEmailTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

async function sendLeadEmail(email, subject, message) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("Gmail credentials are missing. Add GMAIL_USER and GMAIL_PASS to backend/.env.");
  }

  const transporter = createEmailTransporter();

  return transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: email,
    subject,
    text: message,
  });
}

async function logLeadToBlockchain(email, status, timestamp) {
  const network = await provider.getNetwork();
  const leadRecord = {
    email,
    status,
    timestamp,
    chainId: Number(network.chainId),
  };

  // Trim CRLF/whitespace from env var (Windows line-ending safety)
  const privateKey = process.env.SHARDEUM_PRIVATE_KEY?.trim();

  if (privateKey && privateKey.length === 66) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const payload = ethers.toUtf8Bytes(JSON.stringify(leadRecord));

    // ethers v6 requires BigInt for value field
    const transaction = await wallet.sendTransaction({
      to: await wallet.getAddress(),
      value: 0n,
      data: ethers.hexlify(payload),
    });

    return {
      txHash: transaction.hash,
      mode: "sent",
      network: network.name,
    };
  }

  const simulatedHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(leadRecord))
  );

  return {
    txHash: simulatedHash,
    mode: "simulated",
    network: network.name,
  };
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "AI Startup Automation Tool backend is running." });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/get-logs", (req, res) => {
  return res.json({ logs: blockchainLogs });
});

app.post("/analyze", (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name && !email && !message) {
      return res.status(400).json({ message: "Please provide lead data." });
    }

    // Sanitize inputs — truncate very long strings
    const safeName = String(name || "").slice(0, 200);
    const safeEmail = String(email || "").slice(0, 200);
    const safeMessage = String(message || "").slice(0, 2000);

    const analysis = analyzeLead(safeMessage);
    console.log(`[/analyze] ${safeEmail} => ${analysis.status}`);

    return res.json({
      name: safeName,
      email: safeEmail,
      message: safeMessage,
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
  const { email, suggestedReply } = req.body;

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
  const { email, status, timestamp } = req.body;

  if (!email || !status) {
    return res.status(400).json({ message: "Please provide email and status." });
  }

  try {
    const logTime = timestamp || new Date().toISOString();
    const result = await logLeadToBlockchain(email, status, logTime);

    const logEntry = {
      email,
      status,
      timestamp: logTime,
      txHash: result.txHash,
    };

    blockchainLogs.unshift(logEntry);

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
