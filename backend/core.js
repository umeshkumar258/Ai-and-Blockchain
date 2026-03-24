require("dotenv").config();
const { ethers } = require("ethers");
const nodemailer = require("nodemailer");

const SHARDEUM_RPC_URL = "https://api-mezame.shardeum.org";
const provider = new ethers.JsonRpcProvider(SHARDEUM_RPC_URL);
const blockchainLogs = [];
const hotKeywords = ["buy", "price"];
const mediumKeywords = ["info", "details"];

function analyzeLead(message = "") {
  const content = String(message).toLowerCase();

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
    throw new Error("Gmail credentials are missing. Add GMAIL_USER and GMAIL_PASS to environment variables.");
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

  const privateKey = process.env.SHARDEUM_PRIVATE_KEY?.trim();

  if (privateKey && privateKey.length === 66) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const payload = ethers.toUtf8Bytes(JSON.stringify(leadRecord));

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

function sanitizeLeadInput(payload = {}) {
  return {
    name: String(payload.name || "").slice(0, 200),
    email: String(payload.email || "").slice(0, 200),
    message: String(payload.message || "").slice(0, 2000),
  };
}

function addBlockchainLog(entry) {
  blockchainLogs.unshift(entry);
  return entry;
}

module.exports = {
  addBlockchainLog,
  analyzeLead,
  blockchainLogs,
  logLeadToBlockchain,
  sanitizeLeadInput,
  sendLeadEmail,
};
