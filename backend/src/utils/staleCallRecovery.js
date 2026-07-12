const Lead = require("../models/Lead");
const {
  POSITIVE_IVR_SERVICES,
  applyRecordedIvrOutcome,
} = require("./callOutcome");

const ACTIVE_CALL_STATUSES = ["calling", "answered"];
const DEFAULT_STALE_CALL_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_STALE_CALL_TIMEOUT_MS = 60 * 1000;
const MAX_STALE_CALL_TIMEOUT_MS = 60 * 60 * 1000;

function getStaleCallTimeoutMs() {
  const configuredTimeout = Number(
    process.env.STALE_CALL_TIMEOUT_MS
  );

  if (
    Number.isFinite(configuredTimeout) &&
    configuredTimeout >= MIN_STALE_CALL_TIMEOUT_MS &&
    configuredTimeout <= MAX_STALE_CALL_TIMEOUT_MS
  ) {
    return configuredTimeout;
  }

  return DEFAULT_STALE_CALL_TIMEOUT_MS;
}

function getLeadActivityTime(lead) {
  const value = lead?.lastCalledAt || lead?.updatedAt;
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isLeadCallStale(lead, now = Date.now()) {
  if (!ACTIVE_CALL_STATUSES.includes(lead?.callStatus)) {
    return false;
  }

  const activityTime = getLeadActivityTime(lead);

  if (!activityTime) {
    return true;
  }

  return now - activityTime >= getStaleCallTimeoutMs();
}

function applyStaleCallState(lead) {
  lead.callStatus = "failed";
  lead.callStep = "completed";
  lead.providerStatus = "stale_timeout";
  lead.lastCallError =
    "Call status callback was not received before the timeout";
}

async function resetLeadIfStale(lead) {
  // Recover a customer response before considering the call stale.
  if (applyRecordedIvrOutcome(lead)) {
    await lead.save();
    return true;
  }

  if (!isLeadCallStale(lead)) {
    return false;
  }

  applyStaleCallState(lead);
  await lead.save();

  return true;
}

async function resetAllStaleCalls() {
  const cutoff = new Date(Date.now() - getStaleCallTimeoutMs());
  const positiveServices = Array.from(POSITIVE_IVR_SERVICES);

  const optedOutResult = await Lead.updateMany(
    {
      callStatus: { $in: ACTIVE_CALL_STATUSES },
      $or: [
        { optedOut: true },
        { selectedService: "not_interested" },
      ],
    },
    {
      $set: {
        callStatus: "opted_out",
        callStep: "completed",
        optedOut: true,
        lastCallError: null,
      },
    }
  );

  const completedResult = await Lead.updateMany(
    {
      callStatus: { $in: ACTIVE_CALL_STATUSES },
      optedOut: { $ne: true },
      selectedService: { $in: positiveServices },
    },
    {
      $set: {
        callStatus: "completed",
        callStep: "completed",
        lastCallError: null,
      },
    }
  );

  const staleResult = await Lead.updateMany(
    {
      callStatus: { $in: ACTIVE_CALL_STATUSES },
      optedOut: { $ne: true },
      selectedService: {
        $nin: [...positiveServices, "not_interested"],
      },
      $or: [
        { lastCalledAt: { $lte: cutoff } },
        {
          lastCalledAt: null,
          updatedAt: { $lte: cutoff },
        },
        {
          lastCalledAt: { $exists: false },
          updatedAt: { $lte: cutoff },
        },
      ],
    },
    {
      $set: {
        callStatus: "failed",
        callStep: "completed",
        providerStatus: "stale_timeout",
        lastCallError:
          "Call status callback was not received before the timeout",
      },
    }
  );

  return (
    (optedOutResult.modifiedCount || 0) +
    (completedResult.modifiedCount || 0) +
    (staleResult.modifiedCount || 0)
  );
}

module.exports = {
  getStaleCallTimeoutMs,
  isLeadCallStale,
  resetAllStaleCalls,
  resetLeadIfStale,
};
