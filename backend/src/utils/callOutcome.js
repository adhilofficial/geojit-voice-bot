const POSITIVE_IVR_SERVICES = new Set([
  "mutual_fund",
  "sip",
  "trading_account",
  "callback",
]);

const ALL_RECORDED_IVR_SERVICES = new Set([
  ...POSITIVE_IVR_SERVICES,
  "not_interested",
]);

function getRecordedService(lead) {
  const selectedService = String(
    lead?.selectedService || lead?.answers?.service || ""
  )
    .trim()
    .toLowerCase();

  return ALL_RECORDED_IVR_SERVICES.has(selectedService)
    ? selectedService
    : null;
}

function hasRecordedIvrOutcome(lead) {
  return Boolean(
    lead?.optedOut === true || getRecordedService(lead)
  );
}

function applyRecordedIvrOutcome(lead) {
  const service = getRecordedService(lead);

  if (!service && lead?.optedOut !== true) {
    return false;
  }

  const optedOut =
    lead.optedOut === true || service === "not_interested";

  lead.optedOut = optedOut;
  lead.callStatus = optedOut ? "opted_out" : "completed";
  lead.callStep = "completed";
  lead.lastCallError = null;

  return true;
}

module.exports = {
  ALL_RECORDED_IVR_SERVICES,
  POSITIVE_IVR_SERVICES,
  applyRecordedIvrOutcome,
  getRecordedService,
  hasRecordedIvrOutcome,
};
