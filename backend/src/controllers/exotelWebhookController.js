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

async function handleExotelStatus(req, res) {
  try {
    const payload = {
      ...req.query,
      ...req.body,
    };

    console.log(
      "Exotel status webhook:",
      payload
    );

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

    const providerStatus = String(
      rawStatus || ""
    ).toLowerCase();

    let lead = null;

    if (customField) {
      lead = await Lead.findById(
        customField
      ).catch(() => null);
    }

    if (!lead && callSid) {
      lead = await Lead.findOne({
        providerCallId: callSid,
      });
    }

    if (!lead) {
      console.warn(
        "No lead found for Exotel webhook",
        {
          callSid,
          customField,
        }
      );

      // Acknowledge so Exotel does not retry unnecessarily.
      return res.status(200).json({
        success: true,
        message:
          "Webhook acknowledged; customer not found",
      });
    }

    if (callSid) {
      lead.providerCallId = callSid;
    }

    if (statusMap[providerStatus]) {
      lead.callStatus =
        statusMap[providerStatus];
    }

    const terminalStatuses = [
      "completed",
      "failed",
      "busy",
      "no-answer",
      "no_answer",
      "canceled",
      "cancelled",
    ];

    if (
      terminalStatuses.includes(providerStatus)
    ) {
      lead.callStep = "completed";
    }

    const durationValue = getPayloadValue(
      payload,
      [
        "ConversationDuration",
        "Duration",
        "duration",
      ]
    );

    const duration = Number(durationValue || 0);

    if (
      Number.isFinite(duration) &&
      duration >= 0
    ) {
      lead.callDuration = duration;
    }

    const recordingUrl = getPayloadValue(
      payload,
      [
        "RecordingUrl",
        "recordingUrl",
        "recordingurl",
      ]
    );

    if (recordingUrl) {
      lead.recordingUrl = recordingUrl;
    }

    if (providerStatus === "completed") {
      lead.lastCallError = null;
    } else if (
      terminalStatuses.includes(providerStatus)
    ) {
      lead.lastCallError =
        `Exotel call ended with status: ${providerStatus}`;
    }

    await lead.save();

    return res.status(200).json({
      success: true,
      message: "Exotel call status updated",
    });
  } catch (error) {
    console.error(
      "Exotel webhook processing error:",
      error
    );

    // Exotel expects a fast HTTP 200 acknowledgement.
    return res.status(200).json({
      success: false,
      message:
        "Webhook acknowledged but processing failed",
    });
  }
}

module.exports = {
  handleExotelStatus,
};