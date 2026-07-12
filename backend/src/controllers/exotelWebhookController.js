const crypto = require("crypto");

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

const digitActions = {
  1: {
    selectedService: "mutual_fund",
    callbackRequested: false,
    optedOut: false,
    callStatus: "completed",
    message: "Mutual Fund interest recorded",
  },
  2: {
    selectedService: "sip",
    callbackRequested: false,
    optedOut: false,
    callStatus: "completed",
    message: "SIP interest recorded",
  },
  3: {
    selectedService: "trading_account",
    callbackRequested: false,
    optedOut: false,
    callStatus: "completed",
    message: "Trading Account interest recorded",
  },
  4: {
    selectedService: "callback",
    callbackRequested: true,
    optedOut: false,
    callStatus: "completed",
    message: "Callback request recorded",
  },
  9: {
    selectedService: "not_interested",
    callbackRequested: false,
    optedOut: true,
    callStatus: "opted_out",
    message: "Opt-out preference recorded",
  },
};

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

function secureEquals(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isWebhookAuthorized(req) {
  const expectedSecret = String(
    process.env.EXOTEL_WEBHOOK_SECRET || ""
  ).trim();

  if (!expectedSecret) {
    return true;
  }

  const providedSecret =
    req.query.token || req.get("x-exotel-webhook-secret") || "";

  return secureEquals(providedSecret, expectedSecret);
}

function normalizeDigit(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
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

function getCallbackIdentity(payload) {
  return {
    leadId: getPayloadValue(payload, [
      "leadId",
      "LeadId",
      "lead_id",
    ]),
    callSid: getPayloadValue(payload, [
      "CallSid",
      "callSid",
      "callsid",
      "Sid",
      "sid",
    ]),
    customField: getPayloadValue(payload, [
      "CustomField",
      "customField",
      "customfield",
    ]),
  };
}

async function handleExotelStatus(req, res) {
  if (!isWebhookAuthorized(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized webhook request",
    });
  }

  try {
    const payload = {
      ...req.query,
      ...req.body,
    };
    const { leadId, callSid, customField } =
      getCallbackIdentity(payload);
    const rawStatus = getPayloadValue(payload, [
      "Status",
      "status",
      "CallStatus",
      "callStatus",
      "DialCallStatus",
    ]);
    const providerStatus = String(rawStatus || "")
      .trim()
      .toLowerCase();

    console.log("Exotel status callback received", {
      leadId,
      callSid,
      providerStatus,
    });

    const lead = await findLeadForCallback({
      leadId,
      customField,
      callSid,
    });

    if (!lead) {
      console.warn("No customer found for Exotel callback", {
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

    // Preserve an explicit opt-out recorded by the IVR digit webhook.
    if (
      !lead.optedOut &&
      lead.callStatus !== "opted_out" &&
      statusMap[providerStatus]
    ) {
      lead.callStatus = statusMap[providerStatus];
    }

    if (terminalStatuses.has(providerStatus)) {
      lead.callStep = "completed";
    }

    const durationValue = getPayloadValue(payload, [
      "ConversationDuration",
      "Duration",
      "duration",
      "DialCallDuration",
    ]);

    if (durationValue !== null) {
      const duration = Number(durationValue);

      if (Number.isFinite(duration) && duration >= 0) {
        lead.callDuration = duration;
      }
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

    return res.status(200).json({
      success: false,
      message: "Webhook acknowledged but processing failed",
    });
  }
}

async function handleExotelDigit(req, res) {
  if (!isWebhookAuthorized(req)) {
    return res.status(401).type("text/plain").send("Unauthorized");
  }

  try {
    const payload = {
      ...req.query,
      ...req.body,
    };
    const { leadId, callSid, customField } =
      getCallbackIdentity(payload);
    const digit = normalizeDigit(
      getPayloadValue(payload, [
        "Digits",
        "digits",
        "Digit",
        "digit",
      ])
    );
    const action = digitActions[digit];

    console.log("Exotel IVR digit callback received", {
      leadId,
      callSid,
      customField,
      digit,
    });

    if (!action) {
      console.warn("Unsupported Exotel IVR digit", {
        leadId,
        callSid,
        digit,
      });

      // Passthru should continue the call flow even for an unexpected digit.
      return res.status(200).type("text/plain").send("OK");
    }

    const lead = await findLeadForCallback({
      leadId,
      customField,
      callSid,
    });

    if (!lead) {
      console.warn("No customer found for Exotel digit callback", {
        leadId,
        callSid,
        customField,
        digit,
      });

      return res.status(200).type("text/plain").send("OK");
    }

    if (callSid) {
      lead.providerCallId = String(callSid);
    }

    lead.selectedService = action.selectedService;
    lead.callbackRequested = action.callbackRequested;
    lead.optedOut = action.optedOut;
    lead.callStatus = action.callStatus;
    lead.callStep = "completed";
    lead.lastCallError = null;

    lead.answers = {
      consent: action.optedOut ? "opted_out" : "yes",
      service: action.selectedService,
      existingCustomer:
        lead.answers?.existingCustomer || null,
      callback: action.callbackRequested ? "yes" : "no",
    };

    await lead.save();

    console.log("Exotel IVR response saved", {
      leadId: String(lead._id),
      digit,
      selectedService: lead.selectedService,
      callbackRequested: lead.callbackRequested,
      optedOut: lead.optedOut,
    });

    return res.status(200).type("text/plain").send("OK");
  } catch (error) {
    console.error("Exotel digit webhook processing error:", error);

    // Acknowledge quickly so the live call can continue.
    return res.status(200).type("text/plain").send("OK");
  }
}

module.exports = {
  handleExotelStatus,
  handleExotelDigit,
};
