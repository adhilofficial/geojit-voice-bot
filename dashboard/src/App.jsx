import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  checkBackendHealth,
  createLead,
  deleteLead,
  downloadCallbackRequestsCsv,
  downloadCampaignResultsCsv,
  downloadInterestedCsv,
  getCallbackRequests,
  getLeads,
  startLiveCall,
  syncLiveCall,
  updateCallbackFollowUpStatus,
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

const callbackStatusLabels = {
  pending: "Pending",
  contacted: "Contacted",
  completed: "Completed",
};

const ACTIVE_CALL_STATUSES = new Set(["calling", "answered"]);
const TERMINAL_CALL_STATUSES = new Set([
  "completed",
  "failed",
  "no_answer",
  "busy",
  "opted_out",
]);

const configuredCampaignLimit = Number(
  import.meta.env.VITE_CAMPAIGN_MAX_CUSTOMERS
);

const CAMPAIGN_MAX_CUSTOMERS =
  Number.isFinite(configuredCampaignLimit) &&
  configuredCampaignLimit > 0
    ? Math.floor(configuredCampaignLimit)
    : 3;

const CAMPAIGN_POLL_INTERVAL_MS = 5000;
const CAMPAIGN_DELAY_SECONDS = 20;
const CAMPAIGN_MAX_WAIT_MS = 6 * 60 * 1000;
const CAMPAIGN_RESULTS_STORAGE_KEY =
  "geojit:last-campaign-result-ids";

function loadStoredCampaignResultIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(
      CAMPAIGN_RESULTS_STORAGE_KEY
    );
    const parsedValue = storedValue
      ? JSON.parse(storedValue)
      : [];

    return Array.isArray(parsedValue)
      ? parsedValue
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

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

function StatCard({ icon, label, value, tone = "green" }) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-top">
        <div className="stat-icon">{icon}</div>
        <span className="stat-trend-dot" />
      </div>

      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function CustomerTable({
  title,
  subtitle,
  leads,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onStartCall,
  onDeleteLead,
  callLoading,
  deletingLeadId,
  campaignActive,
  backendConnected,
  compact = false,
  onViewAll,
}) {
  const displayedLeads = compact ? leads.slice(0, 6) : leads;

  return (
    <section className="data-card customer-table-card">
      <div className="customer-table-toolbar">
        <div>
          <p className="section-kicker">Customer database</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <div className="customer-table-actions">
          <div className="search-control">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search name or phone"
              aria-label="Search customers"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusChange(event.target.value)
            }
            aria-label="Filter customers by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="calling">Calling</option>
            <option value="answered">Answered</option>
            <option value="completed">Completed</option>
            <option value="no_answer">No Answer</option>
            <option value="busy">Busy</option>
            <option value="failed">Failed</option>
            <option value="opted_out">Opted Out</option>
          </select>

          {compact && onViewAll && (
            <button
              className="text-button"
              type="button"
              onClick={onViewAll}
            >
              View all customers
            </button>
          )}
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
                <td colSpan="8" className="empty-state">
                  <div className="empty-state-icon">
                    <RefreshCw size={22} className="spin" />
                  </div>
                  Loading customers...
                </td>
              </tr>
            ) : displayedLeads.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  <div className="empty-state-icon">
                    <Users size={22} />
                  </div>
                  No customers match the selected filters.
                </td>
              </tr>
            ) : (
              displayedLeads.map((lead) => {
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

                        <div>
                          <strong>
                            {lead.name || "Unknown Customer"}
                          </strong>
                          <span>
                            {lead.source === "csv"
                              ? "CSV upload"
                              : "Manual entry"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="phone-cell">
                      {formatPhone(lead.phone)}
                    </td>

                    <td>{lead.batchName || "Manual Entry"}</td>

                    <td>
                      <span
                        className={`status-badge status-${
                          lead.callStatus || "pending"
                        }`}
                      >
                        {statusLabels[lead.callStatus] ||
                          lead.callStatus ||
                          "Pending"}
                      </span>
                    </td>

                    <td>
                      {serviceLabels[lead.selectedService] || "—"}
                    </td>

                    <td>
                      <span
                        className={
                          lead.callbackRequested
                            ? "callback-yes"
                            : "callback-no"
                        }
                      >
                        {lead.callbackRequested ? "Yes" : "No"}
                      </span>
                    </td>

                    <td>{formatDate(lead.createdAt)}</td>

                    <td>
                      <div className="table-action-group">
                        <button
                          className="table-call-button"
                          type="button"
                          onClick={() => onStartCall(lead)}
                          disabled={
                            !backendConnected ||
                            callLoading ||
                            campaignActive ||
                            optedOut ||
                            activeStatus ||
                            deletingLeadId === lead._id
                          }
                        >
                          <PhoneOutgoing size={15} />

                          {optedOut
                            ? "Opted Out"
                            : activeStatus
                              ? "In Call"
                              : "Start Call"}
                        </button>

                        <button
                          className="table-delete-button"
                          type="button"
                          onClick={() => onDeleteLead(lead)}
                          disabled={
                            !backendConnected ||
                            callLoading ||
                            campaignActive ||
                            activeStatus ||
                            deletingLeadId === lead._id
                          }
                          aria-label={`Delete ${
                            lead.name || "customer"
                          }`}
                          title={
                            activeStatus
                              ? "Wait for the active call to finish"
                              : "Delete customer"
                          }
                        >
                          {deletingLeadId === lead._id ? (
                            <RefreshCw size={15} className="spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CallbackQueue({
  callbacks,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onUpdateStatus,
  updatingCallbackId,
  backendConnected,
}) {
  return (
    <section className="data-card callback-queue-card">
      <div className="customer-table-toolbar">
        <div>
          <p className="section-kicker">Follow-up workspace</p>
          <h2>Callback Requests</h2>
          <p>
            Contact customers who requested a call from a Geojit
            representative.
          </p>
        </div>

        <div className="customer-table-actions">
          <div className="search-control">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                onSearchChange(event.target.value)
              }
              placeholder="Search name, phone or campaign"
              aria-label="Search callback requests"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusChange(event.target.value)
            }
            aria-label="Filter callback requests by follow-up status"
          >
            <option value="">All follow-ups</option>
            <option value="pending">Pending</option>
            <option value="contacted">Contacted</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper callback-table-wrapper">
        <table className="callback-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Campaign</th>
              <th>Requested At</th>
              <th>Service</th>
              <th>Follow-up Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  <div className="empty-state-icon">
                    <RefreshCw size={22} className="spin" />
                  </div>
                  Loading callback requests...
                </td>
              </tr>
            ) : callbacks.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  <div className="empty-state-icon">
                    <PhoneCall size={22} />
                  </div>
                  No callback requests match the selected filters.
                </td>
              </tr>
            ) : (
              callbacks.map((lead) => {
                const followUpStatus =
                  lead.callbackFollowUpStatus || "pending";
                const updating = updatingCallbackId === lead._id;

                return (
                  <tr key={lead._id}>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">
                          {(lead.name || "C")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {lead.name || "Unknown Customer"}
                          </strong>
                          <span>
                            {lead.source === "csv"
                              ? "CSV upload"
                              : "Manual entry"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="phone-cell">
                      {formatPhone(lead.phone)}
                    </td>
                    <td>{lead.batchName || "Manual Entry"}</td>
                    <td>
                      {formatDate(
                        lead.callbackRequestedAt ||
                          lead.lastCalledAt ||
                          lead.updatedAt
                      )}
                    </td>
                    <td>
                      {serviceLabels[lead.selectedService] ||
                        "Callback Request"}
                    </td>
                    <td>
                      <span
                        className={`followup-badge followup-${followUpStatus}`}
                      >
                        {callbackStatusLabels[followUpStatus] ||
                          followUpStatus}
                      </span>
                    </td>
                    <td>
                      <div className="callback-action-group">
                        {followUpStatus === "pending" && (
                          <button
                            className="callback-action-button contacted"
                            type="button"
                            onClick={() =>
                              onUpdateStatus(lead, "contacted")
                            }
                            disabled={
                              !backendConnected || updating
                            }
                          >
                            {updating ? (
                              <RefreshCw
                                size={15}
                                className="spin"
                              />
                            ) : (
                              <UserCheck size={15} />
                            )}
                            Mark Contacted
                          </button>
                        )}

                        {followUpStatus !== "completed" && (
                          <button
                            className="callback-action-button completed"
                            type="button"
                            onClick={() =>
                              onUpdateStatus(lead, "completed")
                            }
                            disabled={
                              !backendConnected || updating
                            }
                          >
                            {updating ? (
                              <RefreshCw
                                size={15}
                                className="spin"
                              />
                            ) : (
                              <CheckCircle2 size={15} />
                            )}
                            Mark Completed
                          </button>
                        )}

                        {followUpStatus === "completed" && (
                          <span className="callback-completed-label">
                            <CheckCircle2 size={15} />
                            Follow-up complete
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App({ admin, onLogout }) {
  const messageTimerRef = useRef(null);
  const campaignRunIdRef = useRef(0);

  const [activeView, setActiveView] = useState("dashboard");
  const [entryPanel, setEntryPanel] = useState(null);

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

  const [callLoading, setCallLoading] = useState(false);

  const [campaignActive, setCampaignActive] =
    useState(false);
  const [campaignQueue, setCampaignQueue] = useState([]);
  const [campaignIndex, setCampaignIndex] = useState(-1);
  const [campaignPhase, setCampaignPhase] = useState("idle");
  const [campaignSecondsRemaining, setCampaignSecondsRemaining] =
    useState(0);
  const [campaignResultIds, setCampaignResultIds] = useState(
    loadStoredCampaignResultIds
  );
  const [exportingCampaign, setExportingCampaign] =
    useState(false);

  const [callbacks, setCallbacks] = useState([]);
  const [callbackSummary, setCallbackSummary] = useState({
    total: 0,
    pending: 0,
    contacted: 0,
    completed: 0,
  });
  const [callbackLoading, setCallbackLoading] = useState(true);
  const [callbackSearch, setCallbackSearch] = useState("");
  const [callbackStatusFilter, setCallbackStatusFilter] =
    useState("");
  const [updatingCallbackId, setUpdatingCallbackId] =
    useState(null);
  const [exportingCallbacks, setExportingCallbacks] =
    useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [addingLead, setAddingLead] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [message, setMessage] = useState(null);

  const showMessage = useCallback((type, text) => {
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
    }

    setMessage({ type, text });

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

  const loadLeads = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const response = await getLeads({ limit: 100 });

        setLeads(response.leads || []);
        setBackendConnected(true);
      } catch (error) {
        setBackendConnected(false);

        if (!silent) {
          showMessage(
            "error",
            error.message || "Unable to load customers"
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [showMessage]
  );

  const loadCallbacks = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setCallbackLoading(true);
        }

        const response = await getCallbackRequests({ limit: 500 });

        setCallbacks(response.callbacks || []);
        setCallbackSummary(
          response.summary || {
            total: 0,
            pending: 0,
            contacted: 0,
            completed: 0,
          }
        );
        setBackendConnected(true);
      } catch (error) {
        setBackendConnected(false);

        if (!silent) {
          showMessage(
            "error",
            error.message || "Unable to load callback requests"
          );
        }
      } finally {
        if (!silent) {
          setCallbackLoading(false);
        }
      }
    },
    [showMessage]
  );

  useEffect(() => {
    void Promise.all([loadLeads(), loadCallbacks()]);
  }, [loadCallbacks, loadLeads]);

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
      campaignRunIdRef.current += 1;

      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CAMPAIGN_RESULTS_STORAGE_KEY,
        JSON.stringify(campaignResultIds)
      );
    } catch {
      // The dashboard still works when browser storage is unavailable.
    }
  }, [campaignResultIds]);

  useEffect(() => {
    const activeLiveLeads = !campaignActive
      ? leads.filter(
          (lead) =>
            ["calling", "answered"].includes(
              lead.callStatus
            ) && lead.providerCallId
        )
      : [];

    if (activeLiveLeads.length === 0) {
      return undefined;
    }

    let refreshRunning = false;

    const refreshLiveCalls = async () => {
      if (refreshRunning) {
        return;
      }

      refreshRunning = true;

      try {
        await Promise.allSettled(
          activeLiveLeads.map((lead) =>
            syncLiveCall(lead._id)
          )
        );

        await Promise.all([
          loadLeads({ silent: true }),
          loadCallbacks({ silent: true }),
        ]);
      } finally {
        refreshRunning = false;
      }
    };

    void refreshLiveCalls();

    const interval = window.setInterval(
      refreshLiveCalls,
      10000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [campaignActive, leads, loadCallbacks, loadLeads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus =
        !statusFilter || lead.callStatus === statusFilter;

      const matchesSearch =
        !query ||
        String(lead.name || "")
          .toLowerCase()
          .includes(query) ||
        String(lead.phone || "")
          .toLowerCase()
          .includes(query) ||
        String(lead.batchName || "")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [leads, search, statusFilter]);

  const filteredCallbacks = useMemo(() => {
    const query = callbackSearch.trim().toLowerCase();

    return callbacks.filter((lead) => {
      const followUpStatus =
        lead.callbackFollowUpStatus || "pending";
      const matchesStatus =
        !callbackStatusFilter ||
        followUpStatus === callbackStatusFilter;
      const matchesSearch =
        !query ||
        String(lead.name || "")
          .toLowerCase()
          .includes(query) ||
        String(lead.phone || "")
          .toLowerCase()
          .includes(query) ||
        String(lead.batchName || "")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [
    callbackSearch,
    callbackStatusFilter,
    callbacks,
  ]);

  const statistics = useMemo(() => {
    return {
      total: leads.length,
      pending: leads.filter(
        (lead) => lead.callStatus === "pending"
      ).length,
      completed: leads.filter(
        (lead) => lead.callStatus === "completed"
      ).length,
      interested: leads.filter(
        (lead) =>
          lead.callbackRequested === true ||
          [
            "mutual_fund",
            "sip",
            "trading_account",
            "callback",
          ].includes(lead.selectedService)
      ).length,
      failed: leads.filter((lead) =>
        ["failed", "no_answer", "busy"].includes(
          lead.callStatus
        )
      ).length,
    };
  }, [leads]);

  const campaignResultLeads = useMemo(() => {
    const resultIdSet = new Set(campaignResultIds);

    return leads.filter((lead) => resultIdSet.has(lead._id));
  }, [campaignResultIds, leads]);

  const campaignSummary = useMemo(() => {
    const interestedServices = new Set([
      "mutual_fund",
      "sip",
      "trading_account",
      "callback",
    ]);

    return {
      total: campaignResultIds.length,
      completed: campaignResultLeads.filter(
        (lead) => lead.callStatus === "completed"
      ).length,
      interested: campaignResultLeads.filter(
        (lead) =>
          lead.callbackRequested === true ||
          interestedServices.has(lead.selectedService)
      ).length,
      callbacks: campaignResultLeads.filter(
        (lead) => lead.callbackRequested === true
      ).length,
      noAnswer: campaignResultLeads.filter(
        (lead) => lead.callStatus === "no_answer"
      ).length,
      busy: campaignResultLeads.filter(
        (lead) => lead.callStatus === "busy"
      ).length,
      failed: campaignResultLeads.filter(
        (lead) => lead.callStatus === "failed"
      ).length,
      optedOut: campaignResultLeads.filter(
        (lead) =>
          lead.optedOut === true ||
          lead.callStatus === "opted_out"
      ).length,
    };
  }, [campaignResultIds.length, campaignResultLeads]);

  const campaignTotal = campaignQueue.length;
  const campaignPosition =
    campaignIndex >= 0 ? campaignIndex + 1 : 0;

  const campaignCurrentCustomer =
    campaignIndex >= 0 ? campaignQueue[campaignIndex] : null;

  const campaignStatusText = useMemo(() => {
    if (!campaignActive) {
      return "Ready to call pending customers";
    }

    if (campaignPhase === "starting") {
      return `Starting call for ${
        campaignCurrentCustomer?.name || "customer"
      }`;
    }

    if (campaignPhase === "calling") {
      return `Calling ${
        campaignCurrentCustomer?.name || "customer"
      }`;
    }

    if (campaignPhase === "waiting") {
      return `Next call in ${campaignSecondsRemaining} second${
        campaignSecondsRemaining === 1 ? "" : "s"
      }`;
    }

    return "Campaign currently running";
  }, [
    campaignActive,
    campaignCurrentCustomer,
    campaignPhase,
    campaignSecondsRemaining,
  ]);

  function resetCampaignState() {
    setCampaignActive(false);
    setCampaignQueue([]);
    setCampaignIndex(-1);
    setCampaignPhase("idle");
    setCampaignSecondsRemaining(0);
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openEntryPanel(type) {
    if (campaignActive) {
      showMessage(
        "error",
        "Stop the campaign before adding customers"
      );
      return;
    }

    setEntryPanel(type);
  }

  function closeEntryPanel() {
    if (addingLead || uploadingCsv) {
      return;
    }

    setEntryPanel(null);
  }

  async function handleAddLead(event) {
    event.preventDefault();

    if (!backendConnected) {
      showMessage("error", "Backend is disconnected");
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
        response.message || "Customer added successfully"
      );

      setForm(initialForm);
      setEntryPanel(null);
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
      showMessage("error", "Backend is disconnected");
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
        `CSV completed: ${summary.inserted || 0} inserted, ${
          summary.alreadyExisting || 0
        } existing, ${summary.invalid || 0} invalid`
      );

      setCsvFile(null);
      setEntryPanel(null);

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
      showMessage("error", "Backend is disconnected");
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

  async function handleExportCallbacks() {
    if (!backendConnected) {
      showMessage("error", "Backend is disconnected");
      return;
    }

    try {
      setExportingCallbacks(true);
      await downloadCallbackRequestsCsv({
        status: callbackStatusFilter,
        search: callbackSearch.trim(),
      });
      showMessage(
        "success",
        "Callback requests exported successfully"
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to export callback requests"
      );
    } finally {
      setExportingCallbacks(false);
    }
  }

  async function handleUpdateCallbackStatus(lead, status) {
    if (!backendConnected) {
      showMessage("error", "Backend is disconnected");
      return;
    }

    if (!lead?._id) {
      showMessage("error", "Customer ID is missing");
      return;
    }

    try {
      setUpdatingCallbackId(lead._id);

      const response = await updateCallbackFollowUpStatus(
        lead._id,
        status
      );

      showMessage(
        "success",
        response.message || "Callback status updated"
      );

      await Promise.all([
        loadCallbacks({ silent: true }),
        loadLeads({ silent: true }),
      ]);
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to update callback status"
      );
    } finally {
      setUpdatingCallbackId(null);
    }
  }

  async function handleExportCampaignResults() {
    if (!backendConnected) {
      showMessage("error", "Backend is disconnected");
      return;
    }

    if (campaignResultIds.length === 0) {
      showMessage(
        "error",
        "Run a campaign before exporting campaign results"
      );
      return;
    }

    try {
      setExportingCampaign(true);
      await downloadCampaignResultsCsv(campaignResultIds);
      showMessage(
        "success",
        "Campaign results exported successfully"
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to export campaign results"
      );
    } finally {
      setExportingCampaign(false);
    }
  }

  function handleClearCampaignResults() {
    setCampaignResultIds([]);
    showMessage("success", "Campaign summary cleared");
  }

  async function handleDeleteLead(lead) {
    if (!backendConnected) {
      showMessage("error", "Backend is disconnected");
      return;
    }

    if (campaignActive) {
      showMessage(
        "error",
        "Stop the campaign before deleting customers"
      );
      return;
    }

    if (!lead?._id) {
      showMessage("error", "Customer ID is missing");
      return;
    }

    if (ACTIVE_CALL_STATUSES.has(lead.callStatus)) {
      showMessage(
        "error",
        "Wait for the active call to finish before deleting this customer"
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${lead.name || "this customer"}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingLeadId(lead._id);

      const response = await deleteLead(lead._id);

      setCampaignResultIds((currentIds) =>
        currentIds.filter((leadId) => leadId !== lead._id)
      );

      showMessage(
        "success",
        response.message || "Customer deleted successfully"
      );

      await Promise.all([
        loadLeads({ silent: true }),
        loadCallbacks({ silent: true }),
      ]);
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to delete customer"
      );
    } finally {
      setDeletingLeadId(null);
    }
  }

  async function handleStartLiveCall(lead) {
    if (!backendConnected) {
      showMessage("error", "Backend is disconnected");
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

    const activeStatus = ["calling", "answered"].includes(
      lead.callStatus
    );

    const optedOut =
      lead.optedOut === true ||
      lead.callStatus === "opted_out";

    if (optedOut) {
      showMessage(
        "error",
        "This customer has opted out of calls"
      );
      return;
    }

    if (activeStatus) {
      showMessage(
        "error",
        "A call is already active for this customer"
      );
      return;
    }

    try {
      setCallLoading(true);

      const response = await startLiveCall(lead._id);

      showMessage(
        "success",
        response.message ||
          `Live Exotel call started for ${
            lead.name || "customer"
          }`
      );

      await loadLeads({ silent: true });
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to start Exotel call"
      );

      await loadLeads({ silent: true });
    } finally {
      setCallLoading(false);
    }
  }

  async function fetchCampaignLeads() {
    const response = await getLeads({ limit: 100 });
    const latestLeads = response.leads || [];

    setLeads(latestLeads);
    setBackendConnected(true);

    return latestLeads;
  }

  async function waitForCampaignCallToFinish(leadId, runId) {
    const startedWaitingAt = Date.now();

    while (campaignRunIdRef.current === runId) {
      await wait(CAMPAIGN_POLL_INTERVAL_MS);

      if (campaignRunIdRef.current !== runId) {
        return { cancelled: true };
      }

      try {
        await syncLiveCall(leadId).catch(() => null);

        const latestLeads = await fetchCampaignLeads();
        const latestLead = latestLeads.find(
          (lead) => lead._id === leadId
        );

        if (!latestLead) {
          return {
            completed: true,
            status: "missing",
          };
        }

        if (TERMINAL_CALL_STATUSES.has(latestLead.callStatus)) {
          return {
            completed: true,
            status: latestLead.callStatus,
            lead: latestLead,
          };
        }

        if (
          Date.now() - startedWaitingAt >=
          CAMPAIGN_MAX_WAIT_MS
        ) {
          return {
            completed: true,
            status: "timeout",
            lead: latestLead,
          };
        }
      } catch {
        setBackendConnected(false);

        if (
          Date.now() - startedWaitingAt >=
          CAMPAIGN_MAX_WAIT_MS
        ) {
          return {
            completed: true,
            status: "timeout",
          };
        }
      }
    }

    return { cancelled: true };
  }

  async function waitBeforeNextCampaignCall(runId) {
    setCampaignPhase("waiting");

    for (
      let seconds = CAMPAIGN_DELAY_SECONDS;
      seconds > 0;
      seconds -= 1
    ) {
      if (campaignRunIdRef.current !== runId) {
        return false;
      }

      setCampaignSecondsRemaining(seconds);
      await wait(1000);
    }

    setCampaignSecondsRemaining(0);
    return campaignRunIdRef.current === runId;
  }

  async function runLiveCampaign(queue, runId) {
    for (let index = 0; index < queue.length; index += 1) {
      if (campaignRunIdRef.current !== runId) {
        return;
      }

      const lead = queue[index];

      setCampaignIndex(index);
      setCampaignPhase("starting");
      setCampaignSecondsRemaining(0);
      setCallLoading(true);

      let callWasStarted = false;

      setCampaignResultIds((currentIds) =>
        currentIds.includes(lead._id)
          ? currentIds
          : [...currentIds, lead._id]
      );

      try {
        await startLiveCall(lead._id);
        callWasStarted = true;
        setCampaignPhase("calling");

        showMessage(
          "success",
          `Live call started for ${lead.name || "customer"}`
        );
      } catch (error) {
        try {
          const latestLeads = await fetchCampaignLeads();
          const latestLead = latestLeads.find(
            (item) => item._id === lead._id
          );

          callWasStarted = ACTIVE_CALL_STATUSES.has(
            latestLead?.callStatus
          );
        } catch {
          setBackendConnected(false);
        }

        if (callWasStarted) {
          setCampaignPhase("calling");
          showMessage(
            "success",
            `Exotel accepted the call for ${
              lead.name || "customer"
            }`
          );
        } else {
          showMessage(
            "error",
            `${lead.name || "Customer"}: ${
              error.message || "Unable to start Exotel call"
            }`
          );
        }
      } finally {
        setCallLoading(false);
      }

      if (callWasStarted) {
        const result = await waitForCampaignCallToFinish(
          lead._id,
          runId
        );

        if (result.cancelled) {
          return;
        }

        if (result.status === "timeout") {
          showMessage(
            "error",
            `${lead.name || "Customer"} exceeded the call wait limit. Moving to the next customer.`
          );
        }
      }

      if (campaignRunIdRef.current !== runId) {
        return;
      }

      if (index + 1 < queue.length) {
        const shouldContinue =
          await waitBeforeNextCampaignCall(runId);

        if (!shouldContinue) {
          return;
        }
      }
    }

    if (campaignRunIdRef.current !== runId) {
      return;
    }

    resetCampaignState();
    await Promise.all([
      loadLeads({ silent: true }),
      loadCallbacks({ silent: true }),
    ]);
    showMessage("success", "Live campaign completed successfully");
  }

  async function handleStartCampaign() {
    if (!backendConnected) {
      showMessage("error", "Backend is disconnected");
      return;
    }

    if (campaignActive) {
      return;
    }

    if (
      leads.some((lead) =>
        ACTIVE_CALL_STATUSES.has(lead.callStatus)
      )
    ) {
      showMessage(
        "error",
        "Wait for the active call to finish before starting a campaign"
      );
      return;
    }

    try {
      setCallLoading(true);

      const response = await getLeads({
        status: "pending",
        limit: 100,
      });

      const allPendingCustomers = (response.leads || []).filter(
        (lead) =>
          !lead.optedOut && lead.callStatus === "pending"
      );

      if (allPendingCustomers.length === 0) {
        showMessage(
          "error",
          "No pending customers are available"
        );
        return;
      }

      const campaignCustomers = allPendingCustomers.slice(
        0,
        CAMPAIGN_MAX_CUSTOMERS
      );

      const runId = campaignRunIdRef.current + 1;
      campaignRunIdRef.current = runId;

      setCampaignResultIds([]);
      setCampaignQueue(campaignCustomers);
      setCampaignIndex(0);
      setCampaignPhase("starting");
      setCampaignSecondsRemaining(0);
      setCampaignActive(true);
      setActiveView("campaigns");

      showMessage(
        "success",
        `Live campaign started with ${campaignCustomers.length} customer${
          campaignCustomers.length === 1 ? "" : "s"
        }`
      );

      void runLiveCampaign(campaignCustomers, runId);
    } catch (error) {
      resetCampaignState();
      showMessage(
        "error",
        error.message || "Unable to start live campaign"
      );
    } finally {
      setCallLoading(false);
    }
  }

  async function handleStopCampaign() {
    campaignRunIdRef.current += 1;
    resetCampaignState();
    setCallLoading(false);

    showMessage(
      "success",
      "Campaign stopped. A call already connected may finish normally."
    );

    if (backendConnected) {
      await Promise.all([
        loadLeads({ silent: true }),
        loadCallbacks({ silent: true }),
      ]);
    }
  }

  async function handleRefresh() {
    await Promise.allSettled([
      checkConnection(),
      loadLeads(),
      loadCallbacks(),
    ]);
  }

  const tableProps = {
    leads: filteredLeads,
    loading,
    search,
    onSearchChange: setSearch,
    statusFilter,
    onStatusChange: setStatusFilter,
    onStartCall: handleStartLiveCall,
    onDeleteLead: handleDeleteLead,
    callLoading,
    deletingLeadId,
    campaignActive,
    backendConnected,
  };

  return (
    <div className="app-shell">
      <header className="top-navigation">
        <div className="top-navigation-inner">
          <button
            className="top-brand"
            type="button"
            onClick={() => setActiveView("dashboard")}
          >
            <span className="top-brand-icon">
              <PhoneCall size={22} />
            </span>

            <span>
              <strong>Geojit</strong>
              <small>Voice Bot</small>
            </span>
          </button>

          <nav className="top-nav-tabs" aria-label="Main navigation">
            <button
              className={
                activeView === "dashboard" ? "active" : ""
              }
              type="button"
              onClick={() => setActiveView("dashboard")}
            >
              <LayoutDashboard size={17} />
              Dashboard
            </button>

            <button
              className={
                activeView === "campaigns" ? "active" : ""
              }
              type="button"
              onClick={() => setActiveView("campaigns")}
            >
              <Megaphone size={17} />
              Call Campaigns
            </button>

            <button
              className={
                activeView === "callbacks" ? "active" : ""
              }
              type="button"
              onClick={() => setActiveView("callbacks")}
            >
              <ClipboardList size={17} />
              Callback Requests
            </button>

            <button
              className={
                activeView === "customers" ? "active" : ""
              }
              type="button"
              onClick={() => setActiveView("customers")}
            >
              <Users size={17} />
              Customers
            </button>
          </nav>

          <div className="top-nav-tools">
            <div className="admin-session-pill" title={admin?.email}>
              <span className="admin-session-icon">
                <ShieldCheck size={16} />
              </span>
              <span className="admin-session-copy">
                <strong>Administrator</strong>
                <small>{admin?.email || "Signed in"}</small>
              </span>
            </div>

            <div
              className={`connection-pill ${
                backendConnected ? "online" : "offline"
              }`}
            >
              <span />
              {checkingBackend
                ? "Checking..."
                : backendConnected
                  ? "online"
                  : "offline"}
            </div>

            <button
              className="icon-action-button"
              type="button"
              onClick={handleRefresh}
              disabled={loading || callLoading}
              aria-label="Refresh dashboard"
            >
              <RefreshCw
                size={18}
                className={
                  loading || checkingBackend ? "spin" : ""
                }
              />
            </button>

            <button
              className="logout-button"
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page-content">
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

        {activeView === "dashboard" && (
          <>
            <section className="page-hero dashboard-hero">
              <div>
                <p className="page-eyebrow">Proactive Investor Communication System </p>
                <h1>Customer Call Dashboard</h1>
                <p>
                  Manage customer numbers, launch campaigns and
                  review keypad responses from one workspace.
                </p>
              </div>

              <div className="hero-action-group">
                <button
                  className="premium-action-button primary"
                  type="button"
                  onClick={() => openEntryPanel("add")}
                  disabled={!backendConnected || campaignActive}
                >
                  <UserPlus size={19} />
                  <span>
                    <strong>Add Customer</strong>
                    <small>Enter one phone number</small>
                  </span>
                </button>

                <button
                  className="premium-action-button secondary"
                  type="button"
                  onClick={() => openEntryPanel("upload")}
                  disabled={!backendConnected || campaignActive}
                >
                  <Upload size={19} />
                  <span>
                    <strong>Upload CSV</strong>
                    <small>Add customers in bulk</small>
                  </span>
                </button>
              </div>
            </section>

            <CustomerTable
              {...tableProps}
              title="Customer Numbers"
              subtitle="Your latest customer activity is shown first."
              compact
              onViewAll={() => setActiveView("customers")}
            />

            <section className="stats-grid">
              <StatCard
                icon={<Users size={21} />}
                label="Total Customers"
                value={statistics.total}
              />
              <StatCard
                icon={<Phone size={21} />}
                label="Pending Calls"
                value={statistics.pending}
                tone="amber"
              />
              <StatCard
                icon={<CheckCircle2 size={21} />}
                label="Completed"
                value={statistics.completed}
                tone="blue"
              />
              <StatCard
                icon={<PhoneCall size={21} />}
                label="Interested"
                value={statistics.interested}
                tone="purple"
              />
              <StatCard
                icon={<XCircle size={21} />}
                label="Failed / No Answer"
                value={statistics.failed}
                tone="red"
              />
              <StatCard
                icon={<Clock3 size={21} />}
                label="Pending Follow-ups"
                value={callbackSummary.pending}
                tone="amber"
              />
            </section>
          </>
        )}

        {activeView === "campaigns" && (
          <>
            <section className="page-hero compact-hero">
              <div>
                <p className="page-eyebrow">Campaign workspace</p>
                <h1>Call Campaigns</h1>
                <p>
                  Start the pending customer queue and track the
                  current campaign progress.
                </p>
              </div>

              <div className="hero-inline-actions">
                {campaignActive ? (
                  <button
                    className="danger-button"
                    type="button"
                    onClick={handleStopCampaign}
                  >
                    <Square size={17} />
                    Stop Campaign
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={handleStartCampaign}
                    disabled={
                      !backendConnected ||
                      callLoading ||
                      statistics.pending === 0
                    }
                  >
                    <Play size={17} />
                    Start Campaign
                  </button>
                )}
              </div>
            </section>

            <section className="campaign-command-card">
              <div className="campaign-command-icon">
                <Megaphone size={28} />
              </div>

              <div className="campaign-command-copy">
                <span>Campaign status</span>
                <strong>
                  {campaignActive
                    ? campaignStatusText
                    : "Ready to call pending customers"}
                </strong>
                <p>
                  {campaignActive
                    ? `Customer ${campaignPosition} of ${campaignTotal} · one live call at a time`
                    : `${statistics.pending} customer${
                        statistics.pending === 1 ? "" : "s"
                      } waiting · trial safety limit ${CAMPAIGN_MAX_CUSTOMERS}`}
                </p>
              </div>

              <div className="campaign-command-progress">
                <div>
                  <span>Progress</span>
                  <strong>
                    {campaignActive && campaignTotal > 0
                      ? `${Math.round(
                          (campaignPosition / campaignTotal) * 100
                        )}%`
                      : "0%"}
                  </strong>
                </div>

                <div className="campaign-progress-track">
                  <span
                    style={{
                      width:
                        campaignActive && campaignTotal > 0
                          ? `${
                              (campaignPosition / campaignTotal) * 100
                            }%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </section>

            {campaignResultIds.length > 0 && (
              <section className="campaign-summary-card">
                <div className="campaign-summary-header">
                  <div>
                    <p className="section-kicker">Latest campaign</p>
                    <h2>Campaign Result Summary</h2>
                    <p>
                      Live results for {campaignSummary.total} attempted
                      customer{campaignSummary.total === 1 ? "" : "s"}.
                    </p>
                  </div>

                  <div className="campaign-summary-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={handleClearCampaignResults}
                      disabled={campaignActive || exportingCampaign}
                    >
                      <X size={17} />
                      Clear Summary
                    </button>

                    <button
                      className="primary-button"
                      type="button"
                      onClick={handleExportCampaignResults}
                      disabled={
                        !backendConnected ||
                        exportingCampaign ||
                        campaignResultIds.length === 0
                      }
                    >
                      <Download size={17} />
                      {exportingCampaign
                        ? "Exporting..."
                        : "Export Campaign Results"}
                    </button>
                  </div>
                </div>

                <div className="campaign-summary-grid">
                  <StatCard
                    icon={<Users size={20} />}
                    label="Total Called"
                    value={campaignSummary.total}
                  />
                  <StatCard
                    icon={<CheckCircle2 size={20} />}
                    label="Completed"
                    value={campaignSummary.completed}
                    tone="blue"
                  />
                  <StatCard
                    icon={<PhoneCall size={20} />}
                    label="Interested"
                    value={campaignSummary.interested}
                    tone="purple"
                  />
                  <StatCard
                    icon={<Phone size={20} />}
                    label="Callback Requests"
                    value={campaignSummary.callbacks}
                    tone="amber"
                  />
                  <StatCard
                    icon={<PhoneOutgoing size={20} />}
                    label="No Answer"
                    value={campaignSummary.noAnswer}
                    tone="amber"
                  />
                  <StatCard
                    icon={<Phone size={20} />}
                    label="Busy"
                    value={campaignSummary.busy}
                    tone="purple"
                  />
                  <StatCard
                    icon={<XCircle size={20} />}
                    label="Failed"
                    value={campaignSummary.failed}
                    tone="red"
                  />
                  <StatCard
                    icon={<XCircle size={20} />}
                    label="Opted Out"
                    value={campaignSummary.optedOut}
                    tone="red"
                  />
                </div>
              </section>
            )}

            <CustomerTable
              {...tableProps}
              title="Campaign Customers"
              subtitle="Review pending, completed and failed campaign calls."
            />
          </>
        )}

        {activeView === "callbacks" && (
          <>
            <section className="page-hero compact-hero">
              <div>
                <p className="page-eyebrow">Follow-up workspace</p>
                <h1>Callback Requests</h1>
                <p>
                  Track customers who asked for a representative
                  callback and complete every follow-up.
                </p>
              </div>

              <div className="hero-inline-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleExportCallbacks}
                  disabled={
                    !backendConnected ||
                    exportingCallbacks ||
                    callbackSummary.total === 0
                  }
                >
                  <Download size={17} />
                  {exportingCallbacks
                    ? "Exporting..."
                    : "Export Callback List"}
                </button>
              </div>
            </section>

            <section className="callback-summary-grid">
              <StatCard
                icon={<ClipboardList size={21} />}
                label="Total Requests"
                value={callbackSummary.total}
              />
              <StatCard
                icon={<Clock3 size={21} />}
                label="Pending"
                value={callbackSummary.pending}
                tone="amber"
              />
              <StatCard
                icon={<UserCheck size={21} />}
                label="Contacted"
                value={callbackSummary.contacted}
                tone="blue"
              />
              <StatCard
                icon={<CheckCircle2 size={21} />}
                label="Completed"
                value={callbackSummary.completed}
                tone="purple"
              />
            </section>

            <CallbackQueue
              callbacks={filteredCallbacks}
              loading={callbackLoading}
              search={callbackSearch}
              onSearchChange={setCallbackSearch}
              statusFilter={callbackStatusFilter}
              onStatusChange={setCallbackStatusFilter}
              onUpdateStatus={handleUpdateCallbackStatus}
              updatingCallbackId={updatingCallbackId}
              backendConnected={backendConnected}
            />
          </>
        )}

        {activeView === "customers" && (
          <>
            <section className="page-hero compact-hero">
              <div>
                <p className="page-eyebrow">Customer management</p>
                <h1>Customers</h1>
                <p>
                  Search, filter, add and export the customer call
                  database.
                </p>
              </div>

              <div className="hero-inline-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleExportInterested}
                  disabled={exporting || !backendConnected}
                >
                  <Download size={17} />
                  {exporting ? "Exporting..." : "Export Interested"}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => openEntryPanel("upload")}
                  disabled={!backendConnected || campaignActive}
                >
                  <Upload size={17} />
                  Upload CSV
                </button>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openEntryPanel("add")}
                  disabled={!backendConnected || campaignActive}
                >
                  <Plus size={17} />
                  Add Customer
                </button>
              </div>
            </section>

            <CustomerTable
              {...tableProps}
              title="All Customers"
              subtitle="Complete customer list with call status and service interest."
            />
          </>
        )}
      </main>

      {entryPanel && (
        <div
          className="entry-modal-backdrop"
          onMouseDown={closeEntryPanel}
        >
          <section
            className="entry-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="entry-modal-header">
              <div className="entry-modal-title">
                <span>
                  {entryPanel === "add" ? (
                    <UserPlus size={21} />
                  ) : (
                    <FileSpreadsheet size={21} />
                  )}
                </span>

                <div>
                  <p className="section-kicker">
                    {entryPanel === "add"
                      ? "Manual customer entry"
                      : "Bulk customer import"}
                  </p>
                  <h2>
                    {entryPanel === "add"
                      ? "Add Customer"
                      : "Upload Customer CSV"}
                  </h2>
                </div>
              </div>

              <button
                className="modal-close-button"
                type="button"
                onClick={closeEntryPanel}
                disabled={addingLead || uploadingCsv}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {entryPanel === "add" ? (
              <form
                className="entry-form"
                onSubmit={handleAddLead}
              >
                <div className="field">
                  <label htmlFor="name">Customer name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleInputChange}
                    placeholder="Example: Arun Kumar"
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleInputChange}
                    placeholder="9876543210"
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
                  />
                </div>

                <div className="entry-form-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={closeEntryPanel}
                    disabled={addingLead}
                  >
                    Cancel
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={addingLead || !backendConnected}
                  >
                    <UserPlus size={17} />
                    {addingLead ? "Adding..." : "Add Customer"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="entry-form"
                onSubmit={handleCsvUpload}
              >
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
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label htmlFor="lead-csv-file">CSV file</label>
                  <input
                    id="lead-csv-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) =>
                      setCsvFile(
                        event.target.files?.[0] || null
                      )
                    }
                    required
                  />
                </div>

                <div className="csv-guide-card">
                  <strong>CSV column guide</strong>
                  <p>
                    Required: <code>phone</code>
                  </p>
                  <p>
                    Optional: <code>name</code>{" "}
                    <code>batchName</code>
                  </p>
                </div>

                <div className="entry-form-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={closeEntryPanel}
                    disabled={uploadingCsv}
                  >
                    Cancel
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={
                      uploadingCsv || !backendConnected
                    }
                  >
                    <Upload size={17} />
                    {uploadingCsv
                      ? "Uploading..."
                      : "Upload Customers"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

    </div>
  );
}

export default App;