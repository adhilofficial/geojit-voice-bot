const Lead = require("../models/Lead");

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
  if (!isLeadCallStale(lead)) {
    return false;
  }

  applyStaleCallState(lead);
  await lead.save();

  return true;
}

async function resetAllStaleCalls() {
  const cutoff = new Date(Date.now() - getStaleCallTimeoutMs());

  const result = await Lead.updateMany(
    {
      callStatus: {
        $in: ACTIVE_CALL_STATUSES,
      },
      $or: [
        {
          lastCalledAt: {
            $lte: cutoff,
          },
        },
        {
          lastCalledAt: null,
          updatedAt: {
            $lte: cutoff,
          },
        },
        {
          lastCalledAt: {
            $exists: false,
          },
          updatedAt: {
            $lte: cutoff,
          },
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

  return result.modifiedCount || 0;
}

module.exports = {
  getStaleCallTimeoutMs,
  isLeadCallStale,
  resetAllStaleCalls,
  resetLeadIfStale,
};
