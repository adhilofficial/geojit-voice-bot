import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Upload,
  Users,
  XCircle,
} from "lucide-react";

import MockCallModal from "./components/MockCallModal";

import {
  checkBackendHealth,
  createLead,
  downloadInterestedCsv,
  endMockCall,
  getLeads,
  startMockCall,
  submitMockDigit,
  uploadLeadCsv,
} from "./api";

import "./App.css";

const initialForm = {
  name: "",
  phone: "",
  batchName: "Geojit Campaign",
};

const statusLabels = {
  pending: "Pending",
  calling: "Calling",
  answered: "Answered",
  completed: "Completed",
  no_answer: "No Answer",
  busy: "Busy",
  failed: "Failed",
  opted_out: "Opted Out",
};

const serviceLabels = {
  mutual_fund: "Mutual Fund",
  sip: "SIP",
  trading_account: "Trading Account",
  callback: "Callback Request",
  not_interested: "Not Interested",
};

function formatPhone(phone = "") {
  const value = String(phone);

  if (value.startsWith("91") && value.length === 12) {
    return `+91 ${value.slice(2, 7)} ${value.slice(7)}`;
  }

  return value;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isCallCompleted(call) {
  if (!call) {
    return false;
  }

  return (
    call.callStep === "completed" ||
    ["completed", "opted_out", "failed"].includes(
      call.callStatus
    )
  );
}

function App() {
  const messageTimerRef = useRef(null);

  const [leads, setLeads] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [csvFile, setCsvFile] = useState(null);

  const [csvBatchName, setCsvBatchName] = useState(
    "Geojit CSV Campaign"
  );

  const [backendConnected, setBackendConnected] =
    useState(false);

  const [checkingBackend, setCheckingBackend] =
    useState(true);

  const [activeCall, setActiveCall] = useState(null);
  const [callLoading, setCallLoading] = useState(false);

  const [campaignActive, setCampaignActive] =
    useState(false);

  const [campaignQueue, setCampaignQueue] = useState([]);
  const [campaignIndex, setCampaignIndex] = useState(-1);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [addingLead, setAddingLead] = useState(false);
  const [uploadingCsv, setUploadingCsv] =
    useState(false);

  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);

  const showMessage = useCallback((type, text) => {
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
    }

    setMessage({
      type,
      text,
    });

    messageTimerRef.current = window.setTimeout(() => {
      setMessage(null);
      messageTimerRef.current = null;
    }, 5000);
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      setCheckingBackend(true);

      const response = await checkBackendHealth();

      setBackendConnected(response?.success === true);
    } catch {
      setBackendConnected(false);
    } finally {
      setCheckingBackend(false);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);

      const response = await getLeads({
        status: statusFilter,
        search,
        limit: 100,
      });

      setLeads(response.leads || []);
      setBackendConnected(true);
    } catch (error) {
      setBackendConnected(false);

      showMessage(
        "error",
        error.message || "Unable to load customers"
      );
    } finally {
      setLoading(false);
    }
  }, [search, showMessage, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadLeads();
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadLeads]);

  useEffect(() => {
    checkConnection();

    const interval = window.setInterval(() => {
      checkConnection();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [checkConnection]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const statistics = useMemo(() => {
    const total = leads.length;

    const pending = leads.filter(
      (lead) => lead.callStatus === "pending"
    ).length;

    const completed = leads.filter(
      (lead) => lead.callStatus === "completed"
    ).length;

    const interested = leads.filter((lead) => {
      return (
        lead.callbackRequested === true ||
        [
          "mutual_fund",
          "sip",
          "trading_account",
          "callback",
        ].includes(lead.selectedService)
      );
    }).length;

    const failed = leads.filter((lead) => {
      return ["failed", "no_answer", "busy"].includes(
        lead.callStatus
      );
    }).length;

    return {
      total,
      pending,
      completed,
      interested,
      failed,
    };
  }, [leads]);

  const campaignTotal = campaignQueue.length;

  const campaignPosition =
    campaignIndex >= 0 ? campaignIndex + 1 : 0;

  const hasNextCampaignCustomer =
    campaignActive &&
    campaignIndex >= 0 &&
    campaignIndex + 1 < campaignQueue.length;

  function createActiveCall(responseCall, lead) {
    return {
      ...responseCall,

      leadId:
        responseCall?.leadId ||
        responseCall?._id ||
        lead._id,

      customerName:
        responseCall?.customerName ||
        lead.name ||
        "Unknown Customer",

      phone: responseCall?.phone || lead.phone,
    };
  }

  async function openCallForLead(lead) {
    const response = await startMockCall(lead._id);

    const newActiveCall = createActiveCall(
      response.call,
      lead
    );

    setActiveCall(newActiveCall);

    return newActiveCall;
  }

  function resetCampaignState() {
    setCampaignActive(false);
    setCampaignQueue([]);
    setCampaignIndex(-1);
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleAddLead(event) {
    event.preventDefault();

    if (!backendConnected) {
      showMessage(
        "error",
        "Backend is disconnected. Please wait and try again."
      );

      return;
    }

    if (!form.phone.trim()) {
      showMessage("error", "Phone number is required");
      return;
    }

    try {
      setAddingLead(true);

      const response = await createLead({
        name: form.name.trim(),

        phone: form.phone.trim(),

        batchName:
          form.batchName.trim() || "Geojit Campaign",
      });

      showMessage(
        "success",
        response.message ||
          "Customer added successfully"
      );

      setForm(initialForm);

      await loadLeads();
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to add customer"
      );
    } finally {
      setAddingLead(false);
    }
  }

  async function handleCsvUpload(event) {
    event.preventDefault();

    if (!backendConnected) {
      showMessage(
        "error",
        "Backend is disconnected. Please wait and try again."
      );

      return;
    }

    if (!csvFile) {
      showMessage("error", "Choose a CSV file first");
      return;
    }

    try {
      setUploadingCsv(true);

      const response = await uploadLeadCsv(
        csvFile,
        csvBatchName.trim() || "Geojit CSV Campaign"
      );

      const summary = response.summary || {};

      showMessage(
        "success",
        `CSV completed: ${
          summary.inserted || 0
        } inserted, ${
          summary.alreadyExisting || 0
        } existing, ${summary.invalid || 0} invalid`
      );

      setCsvFile(null);

      const fileInput =
        document.getElementById("lead-csv-file");

      if (fileInput) {
        fileInput.value = "";
      }

      await loadLeads();
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to upload CSV"
      );
    } finally {
      setUploadingCsv(false);
    }
  }

  async function handleExportInterested() {
    if (!backendConnected) {
      showMessage(
        "error",
        "Backend is disconnected. Export is unavailable."
      );

      return;
    }

    try {
      setExporting(true);

      await downloadInterestedCsv();

      showMessage(
        "success",
        "Interested customers exported successfully"
      );
    } catch (error) {
      showMessage(
        "error",
        error.message ||
          "Unable to export interested customers"
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleStartMockCall(lead) {
    if (!backendConnected) {
      showMessage(
        "error",
        "Backend is disconnected. Calls cannot be started."
      );

      return;
    }

    if (campaignActive) {
      showMessage(
        "error",
        "Stop the current campaign before starting an individual call"
      );

      return;
    }

    if (!lead?._id) {
      showMessage("error", "Customer ID is missing");
      return;
    }

    try {
      setCallLoading(true);

      await openCallForLead(lead);

      showMessage(
        "success",
        `Mock call started for ${
          lead.name || "customer"
        }`
      );

      await loadLeads();
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to start mock call"
      );
    } finally {
      setCallLoading(false);
    }
  }

  async function handleStartCampaign() {
    if (!backendConnected) {
      showMessage(
        "error",
        "Backend is disconnected. Campaign cannot start."
      );

      return;
    }

    if (campaignActive) {
      return;
    }

    try {
      setCallLoading(true);

      const response = await getLeads({
        status: "pending",
        limit: 100,
      });

      const pendingCustomers = (
        response.leads || []
      ).filter((lead) => {
        return (
          !lead.optedOut &&
          lead.callStatus === "pending"
        );
      });

      if (pendingCustomers.length === 0) {
        showMessage(
          "error",
          "No pending customers are available"
        );

        return;
      }

      setCampaignQueue(pendingCustomers);
      setCampaignIndex(0);
      setCampaignActive(true);

      await openCallForLead(pendingCustomers[0]);

      showMessage(
        "success",
        `Campaign started with ${pendingCustomers.length} customers`
      );

      await loadLeads();
    } catch (error) {
      resetCampaignState();

      showMessage(
        "error",
        error.message || "Unable to start campaign"
      );
    } finally {
      setCallLoading(false);
    }
  }

  async function handleMockDigit(digit) {
    if (!activeCall?.leadId) {
      showMessage("error", "No active call found");
      return;
    }

    try {
      setCallLoading(true);

      const response = await submitMockDigit(
        activeCall.leadId,
        digit
      );

      setActiveCall((current) => ({
        ...current,
        ...response.call,

        leadId:
          response.call?.leadId || current?.leadId,

        customerName: current?.customerName,
        phone: current?.phone,
      }));

      if (response.call?.callStep === "completed") {
        showMessage(
          "success",
          "Customer response recorded successfully"
        );

        await loadLeads();
      }
    } catch (error) {
      showMessage(
        "error",
        error.message ||
          "Unable to record keypad response"
      );
    } finally {
      setCallLoading(false);
    }
  }

  async function handleNextCampaignCustomer() {
    if (!campaignActive) {
      return;
    }

    const nextIndex = campaignIndex + 1;

    if (nextIndex >= campaignQueue.length) {
      setActiveCall(null);
      resetCampaignState();

      showMessage(
        "success",
        "Campaign completed successfully"
      );

      await loadLeads();

      return;
    }

    const nextLead = campaignQueue[nextIndex];

    try {
      setCallLoading(true);
      setActiveCall(null);
      setCampaignIndex(nextIndex);

      await openCallForLead(nextLead);

      showMessage(
        "success",
        `Calling ${nextLead.name || "next customer"}`
      );

      await loadLeads();
    } catch (error) {
      showMessage(
        "error",
        error.message ||
          "Unable to start the next call"
      );
    } finally {
      setCallLoading(false);
    }
  }

  async function handleFinishCampaign() {
    setActiveCall(null);
    resetCampaignState();

    showMessage(
      "success",
      "Campaign completed successfully"
    );

    await loadLeads();
  }

  async function handleEndMockCall() {
    if (!activeCall?.leadId) {
      setActiveCall(null);
      return;
    }

    try {
      setCallLoading(true);

      if (!isCallCompleted(activeCall)) {
        await endMockCall(activeCall.leadId);
      }

      if (campaignActive) {
        const nextIndex = campaignIndex + 1;

        if (nextIndex < campaignQueue.length) {
          const nextLead = campaignQueue[nextIndex];

          setCampaignIndex(nextIndex);
          setActiveCall(null);

          await openCallForLead(nextLead);

          showMessage(
            "success",
            `Current call ended. Calling ${
              nextLead.name || "next customer"
            }`
          );
        } else {
          setActiveCall(null);
          resetCampaignState();

          showMessage(
            "success",
            "Campaign completed"
          );
        }

        await loadLeads();

        return;
      }

      setActiveCall(null);

      showMessage("success", "Mock call ended");

      await loadLeads();
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to end mock call"
      );
    } finally {
      setCallLoading(false);
    }
  }

  async function handleStopCampaign() {
    try {
      setCallLoading(true);

      if (
        backendConnected &&
        activeCall?.leadId &&
        !isCallCompleted(activeCall)
      ) {
        await endMockCall(activeCall.leadId);
      }

      showMessage("success", "Campaign stopped");
    } catch (error) {
      showMessage(
        "error",
        error.message ||
          "Campaign stopped locally, but the active call could not be updated"
      );
    } finally {
      setActiveCall(null);
      resetCampaignState();
      setCallLoading(false);

      if (backendConnected) {
        await loadLeads();
      }
    }
  }

  async function handleCloseCallModal() {
    setActiveCall(null);

    if (backendConnected) {
      await loadLeads();
    }
  }

  async function handleRefresh() {
    await checkConnection();

    try {
      await loadLeads();
    } catch {
      // loadLeads handles its own error state.
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <PhoneCall size={22} />
          </div>

          <div>
            <strong>Geojit</strong>
            <span>Voice Bot</span>
          </div>
        </div>

        <nav className="navigation">
          <button
            className="nav-item nav-item-active"
            type="button"
          >
            <Activity size={19} />
            Dashboard
          </button>

          <button
            className="nav-item"
            type="button"
            disabled
          >
            <Phone size={19} />
            Call Campaigns
          </button>

          <button
            className="nav-item"
            type="button"
            disabled
          >
            <Users size={19} />
            Customers
          </button>
        </nav>

        <div
          className={`sidebar-note ${
            backendConnected
              ? "backend-online"
              : "backend-offline"
          }`}
        >
          <span
            className={`status-dot ${
              backendConnected
                ? "status-dot-online"
                : "status-dot-offline"
            }`}
          />

          {checkingBackend
            ? "Checking backend..."
            : backendConnected
              ? "Backend connected"
              : "Backend disconnected"}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Outbound IVR System
            </p>

            <h1>Customer Call Dashboard</h1>

            <p className="subtitle">
              Upload customer numbers and review call
              responses.
            </p>
          </div>

          <div className="topbar-actions">
            <button
              className="export-button"
              type="button"
              onClick={handleExportInterested}
              disabled={
                exporting || !backendConnected
              }
            >
              <Download size={17} />

              {exporting
                ? "Exporting..."
                : "Export Interested"}
            </button>

            {campaignActive ? (
              <button
                className="stop-campaign-button"
                type="button"
                onClick={handleStopCampaign}
                disabled={callLoading}
              >
                <Square size={16} />
                Stop Campaign
              </button>
            ) : (
              <button
                className="start-campaign-button"
                type="button"
                onClick={handleStartCampaign}
                disabled={
                  callLoading ||
                  loading ||
                  !backendConnected
                }
              >
                <Play size={17} />
                Start Campaign
              </button>
            )}

            <button
              className="secondary-button"
              type="button"
              onClick={handleRefresh}
              disabled={loading || callLoading}
            >
              <RefreshCw
                size={17}
                className={
                  loading || checkingBackend
                    ? "spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </header>

        {message && (
          <div
            className={`alert ${
              message.type === "success"
                ? "alert-success"
                : "alert-error"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 size={19} />
            ) : (
              <XCircle size={19} />
            )}

            <span>{message.text}</span>
          </div>
        )}

        {campaignActive && (
          <section className="campaign-progress-card">
            <div className="campaign-progress-info">
              <div className="campaign-progress-icon">
                <PhoneOutgoing size={20} />
              </div>

              <div>
                <strong>Campaign in progress</strong>

                <span>
                  Customer {campaignPosition} of{" "}
                  {campaignTotal}
                </span>
              </div>
            </div>

            <div className="campaign-progress-bar">
              <span
                style={{
                  width: `${
                    campaignTotal > 0
                      ? (campaignPosition /
                          campaignTotal) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>

            <button
              className="campaign-stop-link"
              type="button"
              onClick={handleStopCampaign}
              disabled={callLoading}
            >
              Stop
            </button>
          </section>
        )}

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon">
              <Users size={21} />
            </div>

            <div>
              <span>Total Customers</span>
              <strong>{statistics.total}</strong>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <Phone size={21} />
            </div>

            <div>
              <span>Pending Calls</span>
              <strong>{statistics.pending}</strong>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <span>Completed</span>
              <strong>{statistics.completed}</strong>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <PhoneCall size={21} />
            </div>

            <div>
              <span>Interested</span>
              <strong>{statistics.interested}</strong>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <XCircle size={21} />
            </div>

            <div>
              <span>Failed / No Answer</span>
              <strong>{statistics.failed}</strong>
            </div>
          </article>
        </section>

        <section className="form-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Add Customer</h2>
                <p>Add one phone number manually.</p>
              </div>

              <Plus size={21} />
            </div>

            <form onSubmit={handleAddLead}>
              <div className="field">
                <label htmlFor="name">
                  Customer name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleInputChange}
                  placeholder="Example: Arun Kumar"
                  disabled={
                    addingLead || campaignActive
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="phone">
                  Phone number
                </label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleInputChange}
                  placeholder="9876543210"
                  disabled={
                    addingLead || campaignActive
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="batchName">
                  Campaign name
                </label>

                <input
                  id="batchName"
                  name="batchName"
                  type="text"
                  value={form.batchName}
                  onChange={handleInputChange}
                  placeholder="Geojit SIP Campaign"
                  disabled={
                    addingLead || campaignActive
                  }
                />
              </div>

              <button
                className="primary-button"
                type="submit"
                disabled={
                  addingLead ||
                  campaignActive ||
                  !backendConnected
                }
              >
                <Plus size={17} />

                {addingLead
                  ? "Adding..."
                  : "Add Customer"}
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Upload CSV</h2>
                <p>
                  Upload multiple customer numbers.
                </p>
              </div>

              <FileSpreadsheet size={21} />
            </div>

            <form onSubmit={handleCsvUpload}>
              <div className="field">
                <label htmlFor="csvBatchName">
                  Campaign name
                </label>

                <input
                  id="csvBatchName"
                  type="text"
                  value={csvBatchName}
                  onChange={(event) =>
                    setCsvBatchName(event.target.value)
                  }
                  placeholder="Geojit CSV Campaign"
                  disabled={
                    uploadingCsv || campaignActive
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="lead-csv-file">
                  CSV file
                </label>

                <input
                  id="lead-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) =>
                    setCsvFile(
                      event.target.files?.[0] || null
                    )
                  }
                  disabled={
                    uploadingCsv || campaignActive
                  }
                  required
                />
              </div>

              <div className="csv-example">
                Required column:
                <code>phone</code>

                <br />

                Optional columns:
                <code>name</code>
                <code>batchName</code>
              </div>

              <button
                className="primary-button"
                type="submit"
                disabled={
                  uploadingCsv ||
                  campaignActive ||
                  !backendConnected
                }
              >
                <Upload size={17} />

                {uploadingCsv
                  ? "Uploading..."
                  : "Upload Customers"}
              </button>
            </form>
          </article>
        </section>

        <section className="panel leads-panel">
          <div className="table-toolbar">
            <div>
              <h2>Customer Numbers</h2>

              <p>
                Customers uploaded for outbound calls.
              </p>
            </div>

            <div className="filters">
              <div className="search-box">
                <Search size={17} />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search name or phone"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="">
                  All statuses
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="calling">
                  Calling
                </option>

                <option value="answered">
                  Answered
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="no_answer">
                  No Answer
                </option>

                <option value="busy">Busy</option>

                <option value="failed">Failed</option>

                <option value="opted_out">
                  Opted Out
                </option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Selected Service</th>
                  <th>Callback</th>
                  <th>Added</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="empty-state"
                    >
                      Loading customers...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="empty-state"
                    >
                      No customers found. Add your first
                      phone number above.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const activeStatus =
                      lead.callStatus === "calling" ||
                      lead.callStatus === "answered";

                    const optedOut =
                      lead.optedOut === true ||
                      lead.callStatus === "opted_out";

                    return (
                      <tr key={lead._id}>
                        <td>
                          <div className="customer-cell">
                            <div className="customer-avatar">
                              {(lead.name || "C")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <span>
                              {lead.name ||
                                "Unknown Customer"}
                            </span>
                          </div>
                        </td>

                        <td className="phone-cell">
                          {formatPhone(lead.phone)}
                        </td>

                        <td>
                          {lead.batchName ||
                            "Manual Entry"}
                        </td>

                        <td>
                          <span
                            className={`status-badge status-${
                              lead.callStatus ||
                              "pending"
                            }`}
                          >
                            {statusLabels[
                              lead.callStatus
                            ] ||
                              lead.callStatus ||
                              "Pending"}
                          </span>
                        </td>

                        <td>
                          {serviceLabels[
                            lead.selectedService
                          ] || "—"}
                        </td>

                        <td>
                          {lead.callbackRequested
                            ? "Yes"
                            : "No"}
                        </td>

                        <td>
                          {formatDate(lead.createdAt)}
                        </td>

                        <td>
                          <button
                            className="table-call-button"
                            type="button"
                            onClick={() =>
                              handleStartMockCall(lead)
                            }
                            disabled={
                              !backendConnected ||
                              callLoading ||
                              campaignActive ||
                              optedOut ||
                              activeStatus
                            }
                          >
                            <PhoneOutgoing size={15} />

                            {optedOut
                              ? "Opted Out"
                              : activeStatus
                                ? "In Call"
                                : "Start Call"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <MockCallModal
        activeCall={activeCall}
        loading={callLoading}
        campaignActive={campaignActive}
        campaignPosition={campaignPosition}
        campaignTotal={campaignTotal}
        hasNextCustomer={hasNextCampaignCustomer}
        onDigit={handleMockDigit}
        onEnd={handleEndMockCall}
        onClose={handleCloseCallModal}
        onNextCustomer={handleNextCampaignCustomer}
        onFinishCampaign={handleFinishCampaign}
        onStopCampaign={handleStopCampaign}
      />
    </div>
  );
}

export default App;