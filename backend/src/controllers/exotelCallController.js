const Lead = require("../models/Lead");
const {
  startExotelFlowCall,
} = require("../services/exotelService");
const {
  resetLeadIfStale,
} = require("../utils/staleCallRecovery");

async function startLiveCall(req, res) {
  try {
    const lead = await Lead.findById(req.params.leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (lead.optedOut || lead.callStatus === "opted_out") {
      return res.status(400).json({
        success: false,
        message: "This customer has opted out of calls",
      });
    }

    if (["calling", "answered"].includes(lead.callStatus)) {
      const staleCallWasReset = await resetLeadIfStale(lead);

      if (!staleCallWasReset) {
        return res.status(409).json({
          success: false,
          message: "A call is already active for this customer",
        });
      }
    }

    lead.callStatus = "calling";
    lead.callStep = "not_started";
    lead.callAttempts = Number(lead.callAttempts || 0) + 1;
    lead.lastCalledAt = new Date();
    lead.lastCallError = null;
    lead.callDuration = 0;
    lead.providerCallId = null;
    lead.providerStatus = "starting";
    lead.recordingUrl = null;
    lead.selectedService = null;
    lead.callbackRequested = false;
    lead.answers = {
      consent: null,
      service: null,
      existingCustomer: null,
      callback: null,
    };

    await lead.save();

    try {
      const callResult = await startExotelFlowCall(lead);

      if (callResult.providerCallId) {
        lead.providerCallId = callResult.providerCallId;
      }

      lead.providerStatus = callResult.providerStatus;
      lead.callStatus = "calling";
      lead.lastCallError = null;

      await lead.save();

      return res.status(202).json({
        success: true,
        provider: "exotel",
        message: callResult.providerCallId
          ? "Exotel call started successfully"
          : "Exotel accepted the call request",
        call: {
          leadId: lead._id,
          customerName: lead.name,
          phone: lead.phone,
          callStatus: lead.callStatus,
          providerCallId: lead.providerCallId,
          providerStatus: lead.providerStatus,
          mode: "live",
        },
      });
    } catch (providerError) {
      console.error("Exotel provider request failed:", {
        message: providerError.message,
        leadId: String(lead._id),
        phone: lead.phone,
        subdomain: process.env.EXOTEL_SUBDOMAIN,
        accountSid: process.env.EXOTEL_ACCOUNT_SID,
        callerId: process.env.EXOTEL_CALLER_ID,
        flowId: process.env.EXOTEL_FLOW_ID,
      });

      lead.callStatus = "failed";
      lead.callStep = "completed";
      lead.providerStatus = "failed";
      lead.lastCallError = providerError.message;

      await lead.save();

      return res.status(502).json({
        success: false,
        message: "Exotel could not start the call",
        error: providerError.message,
      });
    }
  } catch (error) {
    console.error("Start Exotel call error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to start live call",
      error: error.message,
    });
  }
}

module.exports = {
  startLiveCall,
};
