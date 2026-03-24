import { useState } from "react";
import Papa from "papaparse";
import { Pie } from "react-chartjs-2";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const API_BASE_URL = "http://localhost:5000";

// Process items in batches to avoid overwhelming the backend
async function batchedAnalyze(leads, batchSize = 5) {
  const results = [];
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (lead, batchIndex) => {
        const response = await fetch(`${API_BASE_URL}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to analyze lead.");
        }
        return {
          id: i + batchIndex + 1,
          name: data.name || lead.name || "",
          email: data.email || lead.email || "",
          message: data.message || lead.message || "",
          status: data.status || "COLD",
          explanation: data.explanation || "",
          suggestedReply: data.suggestedReply || "",
          blockchainTx: "",
        };
      })
    );
    results.push(...batchResults);
  }
  return results;
}

const emptyStats = {
  total: 0,
  hot: 0,
  medium: 0,
  cold: 0,
};

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-4" />
    </svg>
  );
}

function IconFlame() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3c2 3 5 4.5 5 9a5 5 0 1 1-10 0c0-2.5 1.2-4.4 3-6" />
      <path d="M12 13c1.2 1 2 2 2 3.2A2.3 2.3 0 0 1 11.7 18 2.7 2.7 0 0 1 9 15.3c0-1.1.5-2 1.5-3" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconLoader() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 animate-spin" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function getStatusBadgeClasses(status) {
  if (status === "HOT") return "bg-red-100 text-red-700 ring-red-200";
  if (status === "MEDIUM") return "bg-yellow-100 text-yellow-700 ring-yellow-200";
  return "bg-blue-100 text-blue-700 ring-blue-200";
}

function getRowHighlight(status) {
  if (status === "HOT") return "bg-red-50/70";
  if (status === "MEDIUM") return "bg-yellow-50/70";
  return "bg-blue-50/70";
}

function shortenHash(hash = "") {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatTimeSaved(totalLeads) {
  const savedSeconds = totalLeads * 9;

  if (savedSeconds < 60) {
    return `${savedSeconds} sec`;
  }

  return `${(savedSeconds / 60).toFixed(1)} min`;
}

function formatLogTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function App() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedReplyId, setCopiedReplyId] = useState(null);
  const [copiedTxId, setCopiedTxId] = useState(null);
  const [loggingId, setLoggingId] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [blockchainLogs, setBlockchainLogs] = useState([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [hasUploadedCsv, setHasUploadedCsv] = useState(false);

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage("");
    }, 2500);
  };

  const updateStats = (classifiedLeads) => {
    const nextStats = classifiedLeads.reduce(
      (result, lead) => {
        result.total += 1;

        if (lead.status === "HOT") result.hot += 1;
        if (lead.status === "MEDIUM") result.medium += 1;
        if (lead.status === "COLD") result.cold += 1;

        return result;
      },
      { ...emptyStats }
    );

    setStats(nextStats);
  };

  const copyText = async (text, id, type) => {
    setError("");

    try {
      await navigator.clipboard.writeText(text);

      if (type === "reply") {
        setCopiedReplyId(id);
        setTimeout(() => setCopiedReplyId(null), 2000);
      }

      if (type === "tx") {
        setCopiedTxId(id);
        setTimeout(() => setCopiedTxId(null), 2000);
      }

      showSuccess("Copied to clipboard.");
    } catch (copyError) {
      console.error("Copy error:", copyError);
      setError("Could not copy the text.");
    }
  };

  const fetchBlockchainLogs = async () => {
    setError("");
    setSuccessMessage("");
    setLogsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/get-logs`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch blockchain logs.");
      }

      setBlockchainLogs(data.logs || []);
      setShowLogsModal(true);
    } catch (apiError) {
      console.error("Fetch blockchain logs error:", apiError);
      setError(apiError.message);
    } finally {
      setLogsLoading(false);
    }
  };

  const sendEmail = async (lead) => {
    setError("");
    setSuccessMessage("");
    setSendingEmailId(lead.id);

    try {
      const response = await fetch(`${API_BASE_URL}/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: lead.email,
          suggestedReply: lead.suggestedReply,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send email.");
      }

      showSuccess("Email sent successfully");
    } catch (apiError) {
      console.error("Send email error:", apiError);
      setError(apiError.message);
    } finally {
      setSendingEmailId(null);
    }
  };

  const logToBlockchain = async (lead) => {
    setError("");
    setSuccessMessage("");
    setLoggingId(lead.id);

    try {
      const response = await fetch(`${API_BASE_URL}/log-to-blockchain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: lead.email,
          status: lead.status,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to log lead to blockchain.");
      }

      setLeads((currentLeads) =>
        currentLeads.map((currentLead) =>
          currentLead.id === lead.id
            ? {
                ...currentLead,
                blockchainTx: data.txHash,
              }
            : currentLead
        )
      );

      showSuccess("Lead logged to blockchain successfully.");
    } catch (apiError) {
      console.error("Log to blockchain error:", apiError);
      setError(apiError.message);
    } finally {
      setLoggingId(null);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    // Reset input value so the same file can be re-uploaded
    event.target.value = "";

    if (!file) return;

    setHasUploadedCsv(true);
    setError("");
    setSuccessMessage("");
    setCopiedReplyId(null);
    setCopiedTxId(null);
    setLeads([]);
    setLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const cleanedLeads = results.data
          .map((lead) => ({
            name: lead.name?.trim() || "",
            email: lead.email?.trim() || "",
            message: lead.message?.trim() || "",
          }))
          .filter((lead) => lead.name || lead.email || lead.message);

        if (cleanedLeads.length === 0) {
          setLeads([]);
          setStats(emptyStats);
          setError("CSV file is empty or missing the required columns (name, email, message).");
          setLoading(false);
          return;
        }

        try {
          // Use batched requests (5 at a time) instead of flooding the backend
          const classifiedLeads = await batchedAnalyze(cleanedLeads);
          setLeads(classifiedLeads);
          updateStats(classifiedLeads);
          showSuccess(`Analyzed ${classifiedLeads.length} lead(s) successfully.`);
        } catch (apiError) {
          console.error("Analyze leads error:", apiError);
          setError(apiError.message || "An error occurred while analyzing leads.");
        } finally {
          setLoading(false);
        }
      },
      error: (parseError) => {
        console.error("CSV parse error:", parseError);
        setError("Could not read this CSV file. Make sure it is a valid CSV.");
        setLoading(false);
      },
    });
  };

  const statsCards = [
    {
      title: "Total Leads",
      value: stats.total,
      subtitle: "All uploaded leads",
      icon: <IconChart />,
      cardClass: "bg-slate-900 text-white ring-slate-800",
      iconClass: "bg-white/10 text-cyan-200",
    },
    {
      title: "HOT Leads",
      value: stats.hot,
      subtitle: "Strong buying intent",
      icon: <IconFlame />,
      cardClass: "bg-red-50 text-red-800 ring-red-100",
      iconClass: "bg-red-100 text-red-600",
    },
    {
      title: "MEDIUM Leads",
      value: stats.medium,
      subtitle: "Interested and exploring",
      icon: <IconChart />,
      cardClass: "bg-yellow-50 text-yellow-800 ring-yellow-100",
      iconClass: "bg-yellow-100 text-yellow-600",
    },
    {
      title: "COLD Leads",
      value: stats.cold,
      subtitle: "Needs future follow-up",
      icon: <IconChart />,
      cardClass: "bg-blue-50 text-blue-800 ring-blue-100",
      iconClass: "bg-blue-100 text-blue-600",
    },
    {
      title: "Time Saved",
      value: formatTimeSaved(stats.total),
      subtitle: "Manual 10s vs AI 1s per lead",
      icon: <IconClock />,
      cardClass: "bg-emerald-50 text-emerald-800 ring-emerald-100 md:col-span-2 xl:col-span-1",
      iconClass: "bg-emerald-100 text-emerald-600",
    },
  ];

  const chartData = {
    labels: ["HOT", "MEDIUM", "COLD"],
    datasets: [
      {
        data: [stats.hot, stats.medium, stats.cold],
        backgroundColor: ["#f87171", "#facc15", "#60a5fa"],
        borderColor: ["#ffffff", "#ffffff", "#ffffff"],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-800 p-6 text-white shadow-xl sm:p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200 sm:text-sm">
            AI Lead Workflow Dashboard
          </p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold sm:text-4xl">
                AI Startup Automation + Blockchain Logger
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-200 sm:text-base">
                Upload a CSV file with <span className="font-semibold">name, email, message</span> columns
                to classify leads, generate follow-up replies, log lead activity to blockchain, and send email replies.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchBlockchainLogs}
              disabled={logsLoading || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {logsLoading && <IconLoader />}
              {logsLoading ? "Loading Logs..." : "View Blockchain Logs"}
            </button>
          </div>
        </div>

        {(loading || error || successMessage) && (
          <div className="mb-6 space-y-3">
            {loading && (
              <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800">
                <IconLoader />
                <span>Analyzing leads. Please wait...</span>
              </div>
            )}
            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:mb-8 sm:p-6">
          <label className="mb-3 block text-base font-semibold text-slate-800 sm:text-lg">
            Upload Leads CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={loading}
            className="block w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-3 text-sm text-slate-500">
            Example columns: <span className="font-medium">name,email,message</span>
          </p>
        </div>

        {!hasUploadedCsv && !loading && (
          <div className="mb-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm sm:mb-8">
            No data yet. Upload a CSV file to analyze leads and see results here.
          </div>
        )}

        <div className="mb-6 grid gap-6 xl:grid-cols-[2fr_1fr] sm:mb-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {statsCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-2xl p-5 shadow-sm ring-1 ${card.cardClass}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{card.title}</p>
                    <h2 className="mt-3 text-3xl font-bold">{card.value}</h2>
                    <p className="mt-2 text-sm opacity-80">{card.subtitle}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${card.iconClass}`}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Lead Distribution</h3>
              <p className="mt-1 text-sm text-slate-500">
                Simple chart showing HOT, MEDIUM, and COLD lead counts.
              </p>
            </div>
            <div className="h-64 sm:h-72">
              <Pie data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200">
          {/* Table Header Bar */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-4 sm:px-6">
            <h3 className="text-lg font-semibold text-white">📋 Leads Table</h3>
            <p className="mt-1 text-sm text-slate-300">
              Copy, send, and track each reply from one place.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="bg-blue-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-blue-700 sm:px-6 border-b-2 border-blue-200">👤 Name</th>
                  <th className="bg-blue-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-blue-700 sm:px-6 border-b-2 border-blue-200">📧 Email</th>
                  <th className="bg-purple-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-purple-700 sm:px-6 border-b-2 border-purple-200">💬 Message</th>
                  <th className="bg-orange-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-orange-700 sm:px-6 border-b-2 border-orange-200">🎯 Status</th>
                  <th className="bg-teal-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-teal-700 sm:px-6 border-b-2 border-teal-200">🔍 Explanation</th>
                  <th className="bg-emerald-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-emerald-700 sm:px-6 border-b-2 border-emerald-200">✉️ Suggested Reply</th>
                  <th className="bg-cyan-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-cyan-700 sm:px-6 border-b-2 border-cyan-200">⛓️ Blockchain TX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {leads.length > 0 ? (
                  leads.map((lead) => (
                    <tr key={lead.id} className={`align-top transition-colors hover:brightness-95 ${getRowHighlight(lead.status)}`}>
                      {/* Name with avatar */}
                      <td className="px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                            {lead.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <span className="text-sm font-semibold text-slate-800">{lead.name}</span>
                        </div>
                      </td>
                      {/* Clickable email */}
                      <td className="px-4 py-4 text-sm sm:px-6">
                        <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline underline-offset-2">{lead.email}</a>
                      </td>
                      {/* Message pill */}
                      <td className="px-4 py-4 text-sm sm:px-6">
                        <div className="max-w-[200px] rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-xs leading-5 text-purple-800">
                          {lead.message}
                        </div>
                      </td>
                      {/* Status badge with emoji */}
                      <td className="px-4 py-4 sm:px-6">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${getStatusBadgeClasses(lead.status)}`}>
                          {lead.status === "HOT" && "🔥"}
                          {lead.status === "MEDIUM" && "⚡"}
                          {lead.status === "COLD" && "❄️"}
                          {lead.status}
                        </span>
                      </td>
                      {/* Explanation pill */}
                      <td className="px-4 py-4 text-sm sm:px-6">
                        <div className="max-w-[180px] rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-800">
                          {lead.explanation}
                        </div>
                      </td>
                      {/* Suggested Reply */}
                      <td className="px-4 py-4 text-sm text-slate-700 sm:px-6">
                        <div className="max-w-sm space-y-3">
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                            {lead.suggestedReply}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => copyText(lead.suggestedReply, lead.id, "reply")}
                              disabled={loading || loggingId === lead.id || sendingEmailId === lead.id}
                              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {copiedReplyId === lead.id ? "✅ Copied" : "📋 Copy Reply"}
                            </button>
                            <button
                              type="button"
                              onClick={() => sendEmail(lead)}
                              disabled={loading || loggingId === lead.id || sendingEmailId === lead.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                            >
                              {sendingEmailId === lead.id && <IconLoader />}
                              {sendingEmailId === lead.id ? "Sending..." : "📨 Send Email"}
                            </button>
                          </div>
                        </div>
                      </td>
                      {/* Blockchain TX */}
                      <td className="px-4 py-4 text-sm text-slate-700 sm:px-6">
                        <div className="max-w-xs space-y-3">
                          {lead.blockchainTx ? (
                            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                              <p className="font-mono text-xs font-semibold text-cyan-800">{shortenHash(lead.blockchainTx)}</p>
                              <button
                                type="button"
                                onClick={() => copyText(lead.blockchainTx, lead.id, "tx")}
                                disabled={loading || loggingId === lead.id || sendingEmailId === lead.id}
                                className="mt-2 rounded-md border border-cyan-300 bg-white px-2 py-1 text-[11px] font-semibold text-cyan-700 transition hover:-translate-y-0.5 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {copiedTxId === lead.id ? "✅ Copied" : "Copy TX"}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs italic text-slate-400">Not logged yet</p>
                          )}
                          <button
                            type="button"
                            onClick={() => logToBlockchain(lead)}
                            disabled={loading || loggingId === lead.id || sendingEmailId === lead.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-cyan-300"
                          >
                            {loggingId === lead.id && <IconLoader />}
                            {loggingId === lead.id ? "Logging..." : "⛓️ Log to Blockchain"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-14 text-center">
                      <div className="text-4xl mb-3">📂</div>
                      <p className="text-sm font-medium text-slate-500">
                        {hasUploadedCsv ? "No leads found in this CSV file." : "Upload a CSV file to see analyzed leads here."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>


      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Blockchain Logs</h3>
                <p className="mt-1 text-sm text-slate-500">Logged lead activity stored in memory for this running session.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="overflow-x-auto p-4 sm:p-6">
              <table className="min-w-[650px] divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Transaction Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {blockchainLogs.length > 0 ? (
                    blockchainLogs.map((log, index) => (
                      <tr key={`${log.txHash}-${index}`}>
                        <td className="px-4 py-4 text-sm text-slate-700">{log.email}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClasses(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatLogTime(log.timestamp)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className="break-all">{shortenHash(log.txHash)}</span>
                            <button
                              type="button"
                              onClick={() => copyText(log.txHash, `modal-${index}`, "tx")}
                              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                            >
                              {copiedTxId === `modal-${index}` ? "Copied" : "Copy TX"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500">No blockchain logs yet. Log a lead first, then open this view again.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
