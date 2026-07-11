function requireEnvironmentVariable(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function normalizeIndianPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  throw new Error(
    "Invalid customer phone number. Expected a 10-digit Indian number."
  );
}

function parseResponseBody(rawBody) {
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return {
      raw: rawBody,
    };
  }
}

async function startExotelFlowCall(lead) {
  const accountSid = requireEnvironmentVariable(
    "EXOTEL_ACCOUNT_SID"
  );

  const apiKey = requireEnvironmentVariable(
    "EXOTEL_API_KEY"
  );

  const apiToken = requireEnvironmentVariable(
    "EXOTEL_API_TOKEN"
  );

  const subdomain = requireEnvironmentVariable(
    "EXOTEL_SUBDOMAIN"
  );

  const callerId = requireEnvironmentVariable(
    "EXOTEL_CALLER_ID"
  );

  const flowId = requireEnvironmentVariable(
    "EXOTEL_FLOW_ID"
  );

  const publicBackendUrl = requireEnvironmentVariable(
    "PUBLIC_BACKEND_URL"
  ).replace(/\/+$/, "");

  const endpoint =
    `https://${subdomain}` +
    `/v1/Accounts/${accountSid}/Calls/connect`;

  const flowUrl =
    `http://my.exotel.com/${accountSid}` +
    `/exoml/start_voice/${flowId}`;

  const statusCallback =
    `${publicBackendUrl}/api/webhooks/exotel/status`;

  const requestBody = new URLSearchParams();

  requestBody.set(
    "From",
    normalizeIndianPhone(lead.phone)
  );

  requestBody.set("CallerId", callerId);
  requestBody.set("Url", flowUrl);
  requestBody.set("CallType", "trans");
  requestBody.set("TimeLimit", "180");
  requestBody.set("TimeOut", "30");
  requestBody.set("StatusCallback", statusCallback);
  requestBody.set("StatusCallbackEvents", "terminal");

  // MongoDB lead ID returned through the webhook.
  requestBody.set("CustomField", String(lead._id));

  const encodedCredentials = Buffer.from(
    `${apiKey}:${apiToken}`
  ).toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",

    headers: {
      Authorization: `Basic ${encodedCredentials}`,
      Accept: "application/json",
      "Content-Type":
        "application/x-www-form-urlencoded",
    },

    body: requestBody,
  });

  const rawBody = await response.text();
  const data = parseResponseBody(rawBody);

  if (!response.ok) {
    const providerMessage =
      data?.RestException?.Message ||
      data?.message ||
      data?.raw ||
      `Exotel returned HTTP ${response.status}`;

    throw new Error(providerMessage);
  }

  const call = data.Call || data.call;

  if (!call?.Sid && !call?.sid) {
    throw new Error(
      "Exotel accepted the request but returned no call ID"
    );
  }

  return {
    providerCallId: call.Sid || call.sid,
    providerStatus:
      call.Status || call.status || "in-progress",
    raw: data,
  };
}

module.exports = {
  startExotelFlowCall,
};