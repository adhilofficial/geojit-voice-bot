const Lead = require("../models/Lead");

const statusMap = {
  queued: "calling",
  ringing: "calling",
  "in-progress": "calling",
  answered: "answered",
  completed: "completed",
  failed: "failed",
  busy: "busy",
  "no-answer": "no_answer",
  no_answer: "no_answer",
  canceled: "failed",
  cancelled: "failed",
};

const terminalStatuses = new Set([
  "completed",
  "failed",
  "busy",
  "no-answer",
  "no_answer",
  "canceled",
  "cancelled",
]);

function getPayloadValue(payload, names) {
  for (const name of names) {
    if (
      payload[name] !== undefined &&
      payload[name] !== null &&
      payload[name] !== ""
    ) {
      return payload[name];
    }
  }

  return null;
}

async function findLeadForCallback({
  leadId,
  customField,
  callSid,
}) {
  if (leadId) {
    const lead = await Lead.findById(leadId).catch(() => null);

    if (lead) {
      return lead;
    }
  }

  if (customField) {
    const lead = await Lead.findById(customField).catch(
      () => null
    );

    if (lead) {
      return lead;
    }
  }

  if (callSid) {
    return Lead.findOne({ providerCallId: callSid });
  }

  return null;
}

async function handleExotelStatus(req, res) {
  try {
    const payload = {
      ...req.query,
      ...req.body,
    };

    console.log("Exotel status webhook:", payload);

    const leadId = getPayloadValue(payload, [
      "leadId",
      "LeadId",
      "lead_id",
    ]);
    const callSid = getPayloadValue(payload, [
      "CallSid",
      "callSid",
      "callsid",
    ]);
    const customField = getPayloadValue(payload, [
      "CustomField",
      "customField",
      "customfield",
    ]);
    const rawStatus = getPayloadValue(payload, [
      "Status",
      "status",
    ]);
    const providerStatus = String(rawStatus || "")
      .trim()
      .toLowerCase();

    const lead = await findLeadForCallback({
      leadId,
      customField,
      callSid,
    });

    if (!lead) {
      console.warn("No lead found for Exotel webhook", {
        leadId,
        callSid,
        customField,
      });

      return res.status(200).json({
        success: true,
        message: "Webhook acknowledged; customer not found",
      });
    }

    if (callSid) {
      lead.providerCallId = String(callSid);
    }

    if (providerStatus) {
      lead.providerStatus = providerStatus;
    }

    if (statusMap[providerStatus]) {
      lead.callStatus = statusMap[providerStatus];
    }

    if (terminalStatuses.has(providerStatus)) {
      lead.callStep = "completed";
    }

    const durationValue = getPayloadValue(payload, [
      "ConversationDuration",
      "Duration",
      "duration",
    ]);
    const duration = Number(durationValue || 0);

    if (Number.isFinite(duration) && duration >= 0) {
      lead.callDuration = duration;
    }

    const recordingUrl = getPayloadValue(payload, [
      "RecordingUrl",
      "recordingUrl",
      "recordingurl",
    ]);

    if (recordingUrl) {
      lead.recordingUrl = String(recordingUrl);
    }

    if (providerStatus === "completed") {
      lead.lastCallError = null;
    } else if (terminalStatuses.has(providerStatus)) {
      lead.lastCallError =
        `Exotel call ended with status: ${providerStatus}`;
    }

    await lead.save();

    return res.status(200).json({
      success: true,
      message: "Exotel call status updated",
    });
  } catch (error) {
    console.error("Exotel webhook processing error:", error);

    // Acknowledge the callback so Exotel does not keep retrying while
    // the application records the error in its own logs.
    return res.status(200).json({
      success: false,
      message: "Webhook acknowledged but processing failed",
    });
  }
}

module.exports = {
  handleExotelStatus,
};
