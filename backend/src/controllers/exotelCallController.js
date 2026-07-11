const Lead = require("../models/Lead");

const {
  startExotelFlowCall,
} = require("../services/exotelService");

async function startLiveCall(req, res) {
  try {
    const lead = await Lead.findById(req.params.leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (
      lead.optedOut ||
      lead.callStatus === "opted_out"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This customer has opted out of calls",
      });
    }

    if (
      ["calling", "answered"].includes(
        lead.callStatus
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "A call is already active for this customer",
      });
    }

    lead.callStatus = "calling";
    lead.callStep = "not_started";
    lead.callAttempts =
      Number(lead.callAttempts || 0) + 1;

    lead.lastCalledAt = new Date();
    lead.lastCallError = null;
    lead.callDuration = 0;
    lead.providerCallId = null;

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
      const callResult =
        await startExotelFlowCall(lead);

      lead.providerCallId =
        callResult.providerCallId;

      await lead.save();

      return res.status(202).json({
        success: true,
        provider: "exotel",
        message:
          "Exotel call started successfully",

        call: {
          leadId: lead._id,
          customerName: lead.name,
          phone: lead.phone,
          callStatus: lead.callStatus,
          providerCallId:
            lead.providerCallId,
          providerStatus:
            callResult.providerStatus,
          mode: "live",
        },
      });
    } catch (providerError) {
      lead.callStatus = "failed";
      lead.callStep = "completed";
      lead.lastCallError =
        providerError.message;

      await lead.save();

      return res.status(502).json({
        success: false,
        message:
          "Exotel could not start the call",
        error: providerError.message,
      });
    }
  } catch (error) {
    console.error(
      "Start Exotel call error:",
      error
    );

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