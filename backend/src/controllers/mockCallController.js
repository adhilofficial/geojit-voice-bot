const crypto = require("crypto");

const Lead = require("../models/Lead");

const serviceNames = {
  mutual_fund: "Mutual Funds",
  sip: "SIP investments",
  trading_account: "Trading and Demat Accounts",
  callback: "a representative callback",
  not_interested: "Not Interested",
};

function getServiceName(service) {
  return serviceNames[service] || "the selected service";
}

function getPrompt(lead) {
  switch (lead.callStep) {
    case "consent":
      return {
        message:
          "Hello, this is an automated customer-interest call from Geojit. To continue, press 1. If you do not wish to receive this call, press 9.",
        validDigits: ["1", "9"],
      };

    case "service":
      return {
        message:
          "Which Geojit service would you like to know more about? For Mutual Funds, press 1. For SIP investments, press 2. For Trading and Demat Accounts, press 3. To request a callback, press 4. If you are not interested, press 9.",
        validDigits: ["1", "2", "3", "4", "9"],
      };

    case "existing_customer":
      if (lead.selectedService === "mutual_fund") {
        return {
          message:
            "Are you currently investing in Mutual Funds? Press 1 for Yes or press 2 for No.",
          validDigits: ["1", "2"],
        };
      }

      if (lead.selectedService === "sip") {
        return {
          message:
            "Do you currently have an active SIP investment? Press 1 for Yes or press 2 for No.",
          validDigits: ["1", "2"],
        };
      }

      if (lead.selectedService === "trading_account") {
        return {
          message:
            "Do you currently have a Trading and Demat Account? Press 1 for Yes or press 2 for No.",
          validDigits: ["1", "2"],
        };
      }

      return {
        message:
          "Are you currently using this service? Press 1 for Yes or press 2 for No.",
        validDigits: ["1", "2"],
      };

    case "callback":
      return {
        message: `Would you like a Geojit representative to contact you regarding ${getServiceName(
          lead.selectedService
        )}? Press 1 for Yes or press 2 for No.`,
        validDigits: ["1", "2"],
      };

    case "completed":
      if (lead.optedOut) {
        return {
          message:
            "Your preference has been recorded. You will not receive further calls from this campaign. Thank you.",
          validDigits: [],
        };
      }

      if (lead.selectedService === "not_interested") {
        return {
          message:
            "Thank you. Your response has been recorded.",
          validDigits: [],
        };
      }

      if (lead.callbackRequested) {
        return {
          message:
            "Thank you. Your interest has been recorded. A Geojit representative may contact you regarding your selected service.",
          validDigits: [],
        };
      }

      return {
        message:
          "Thank you. Your service preference has been recorded.",
        validDigits: [],
      };

    default:
      return {
        message: "The call has ended.",
        validDigits: [],
      };
  }
}

function calculateCallDuration(lead) {
  if (!lead.lastCalledAt) {
    return 0;
  }

  const startedAt = new Date(lead.lastCalledAt).getTime();

  if (Number.isNaN(startedAt)) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((Date.now() - startedAt) / 1000)
  );
}

function buildCallResponse(lead) {
  return {
    leadId: lead._id,
    customerName: lead.name,
    phone: lead.phone,
    callStatus: lead.callStatus,
    callStep: lead.callStep,
    providerCallId: lead.providerCallId,
    selectedService: lead.selectedService,
    selectedServiceLabel:
      getServiceName(lead.selectedService),
    callbackRequested: lead.callbackRequested,
    optedOut: lead.optedOut,
    answers: lead.answers,
    callDuration: lead.callDuration,
    prompt: getPrompt(lead),
  };
}

async function startMockCall(req, res) {
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
        message: "This customer has opted out of calls",
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
          "A mock call is already active for this customer",
      });
    }

    lead.callStatus = "calling";
    lead.callStep = "consent";
    lead.callAttempts += 1;
    lead.lastCalledAt = new Date();

    lead.providerCallId = `mock-${crypto.randomUUID()}`;

    lead.lastCallError = null;
    lead.callDuration = 0;
    lead.selectedService = null;
    lead.callbackRequested = false;

    lead.answers = {
      consent: null,
      service: null,
      existingCustomer: null,
      callback: null,
    };

    await lead.save();

    return res.status(200).json({
      success: true,
      message: "Mock call started",
      call: buildCallResponse(lead),
    });
  } catch (error) {
    console.error("Start mock call error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to start mock call",
      error: error.message,
    });
  }
}

async function submitMockDigit(req, res) {
  try {
    const digit = String(
      req.body.digit || ""
    ).trim();

    const lead = await Lead.findById(req.params.leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (
      !["calling", "answered"].includes(
        lead.callStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "There is no active mock call for this customer",
      });
    }

    const currentPrompt = getPrompt(lead);

    if (!currentPrompt.validDigits.includes(digit)) {
      return res.status(400).json({
        success: false,
        message: `Invalid keypad input for step: ${lead.callStep}`,
        validDigits: currentPrompt.validDigits,
      });
    }

    if (lead.callStep === "consent") {
      if (digit === "9") {
        lead.answers.consent = "opted_out";
        lead.optedOut = true;
        lead.callStatus = "opted_out";
        lead.callStep = "completed";
        lead.selectedService = "not_interested";
        lead.callbackRequested = false;
        lead.callDuration =
          calculateCallDuration(lead);
      } else {
        lead.answers.consent = "yes";
        lead.callStatus = "answered";
        lead.callStep = "service";
      }
    } else if (lead.callStep === "service") {
      const serviceMap = {
        1: "mutual_fund",
        2: "sip",
        3: "trading_account",
        4: "callback",
        9: "not_interested",
      };

      const selectedService = serviceMap[digit];

      lead.selectedService = selectedService;
      lead.answers.service = selectedService;

      if (digit === "4") {
        lead.callbackRequested = true;
        lead.answers.callback = "yes";
        lead.callStatus = "completed";
        lead.callStep = "completed";
        lead.callDuration =
          calculateCallDuration(lead);
      } else if (digit === "9") {
        lead.callbackRequested = false;
        lead.answers.callback = "no";
        lead.callStatus = "completed";
        lead.callStep = "completed";
        lead.callDuration =
          calculateCallDuration(lead);
      } else {
        lead.callStatus = "calling";
        lead.callStep = "existing_customer";
      }
    } else if (
      lead.callStep === "existing_customer"
    ) {
      lead.answers.existingCustomer =
        digit === "1" ? "yes" : "no";

      lead.callStatus = "calling";
      lead.callStep = "callback";
    } else if (lead.callStep === "callback") {
      lead.answers.callback =
        digit === "1" ? "yes" : "no";

      lead.callbackRequested = digit === "1";
      lead.callStatus = "completed";
      lead.callStep = "completed";
      lead.callDuration =
        calculateCallDuration(lead);
    }

    await lead.save();

    return res.status(200).json({
      success: true,

      message:
        lead.callStep === "completed"
          ? "Mock call completed"
          : "Keypad response recorded",

      call: buildCallResponse(lead),
    });
  } catch (error) {
    console.error("Submit mock digit error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to save keypad response",
      error: error.message,
    });
  }
}

async function endMockCall(req, res) {
  try {
    const lead = await Lead.findById(req.params.leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (
      ["calling", "answered"].includes(
        lead.callStatus
      )
    ) {
      lead.callStatus = "failed";
      lead.callStep = "completed";
      lead.callDuration =
        calculateCallDuration(lead);

      lead.lastCallError =
        "Mock call ended before the IVR flow was completed";

      await lead.save();
    }

    return res.status(200).json({
      success: true,
      message: "Mock call ended",
      call: buildCallResponse(lead),
    });
  } catch (error) {
    console.error("End mock call error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to end mock call",
      error: error.message,
    });
  }
}

module.exports = {
  startMockCall,
  submitMockDigit,
  endMockCall,
};