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

function normalizeSubdomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function getXmlValue(xml, tagName) {
  const expression = new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${tagName}>`,
    "i"
  );

  return String(xml || "").match(expression)?.[1]?.trim() || null;
}

function findCallObject(data) {
  return (
    data?.Call ||
    data?.call ||
    data?.TwilioResponse?.Call ||
    data?.twilioResponse?.Call ||
    null
  );
}

function parseExotelResponse(rawBody) {
  if (!rawBody) {
    return {
      data: {},
      call: null,
    };
  }

  try {
    const data = JSON.parse(rawBody);

    return {
      data,
      call: findCallObject(data),
    };
  } catch {
    const callSid =
      getXmlValue(rawBody, "Sid") ||
      getXmlValue(rawBody, "CallSid");

    const status = getXmlValue(rawBody, "Status");

    return {
      data: {
        raw: rawBody,
      },
      call: callSid
        ? {
            Sid: callSid,
            Status: status,
          }
        : null,
    };
  }
}

function extractExotelError(rawBody, data, statusCode) {
  return (
    data?.RestException?.Message ||
    data?.restException?.message ||
    data?.message ||
    getXmlValue(rawBody, "Message") ||
    `Exotel returned HTTP ${statusCode}`
  );
}

async function startExotelFlowCall(lead) {
  const accountSid = requireEnvironmentVariable(
    "EXOTEL_ACCOUNT_SID"
  );
  const apiKey = requireEnvironmentVariable("EXOTEL_API_KEY");
  const apiToken = requireEnvironmentVariable(
    "EXOTEL_API_TOKEN"
  );
  const subdomain = normalizeSubdomain(
    requireEnvironmentVariable("EXOTEL_SUBDOMAIN")
  );
  const callerId = requireEnvironmentVariable(
    "EXOTEL_CALLER_ID"
  );
  const flowId = requireEnvironmentVariable("EXOTEL_FLOW_ID");
  const publicBackendUrl = requireEnvironmentVariable(
    "PUBLIC_BACKEND_URL"
  ).replace(/\/+$/, "");

  const endpoint =
    `https://${subdomain}` +
    `/v1/Accounts/${encodeURIComponent(
      accountSid
    )}/Calls/connect.json`;

  const flowUrl =
    `http://my.exotel.com/${accountSid}` +
    `/exoml/start_voice/${flowId}`;

  const statusCallbackUrl = new URL(
    `${publicBackendUrl}/api/webhooks/exotel/status`
  );

  // This query value lets the callback identify the lead even when
  // Exotel's immediate response does not contain a readable Call SID.
  statusCallbackUrl.searchParams.set("leadId", String(lead._id));

  const requestBody = new URLSearchParams();
  requestBody.set("From", normalizeIndianPhone(lead.phone));
  requestBody.set("CallerId", callerId);
  requestBody.set("Url", flowUrl);
  requestBody.set("CallType", "trans");
  requestBody.set("TimeLimit", "180");
  requestBody.set("TimeOut", "30");
  requestBody.set(
    "StatusCallback",
    statusCallbackUrl.toString()
  );
  requestBody.set("CustomField", String(lead._id));

  // StatusCallbackEvents is intentionally omitted. Some Exotel trial
  // accounts reject it for Connect-to-Flow calls, while StatusCallback
  // still sends the terminal call result.

  const encodedCredentials = Buffer.from(
    `${apiKey}:${apiToken}`
  ).toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedCredentials}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody,
  });

  const rawBody = await response.text();
  const { data, call } = parseExotelResponse(rawBody);

  if (!response.ok) {
    throw new Error(
      extractExotelError(rawBody, data, response.status)
    );
  }

  const providerCallId =
    call?.Sid ||
    call?.sid ||
    call?.CallSid ||
    call?.callSid ||
    null;

  const providerStatus =
    call?.Status || call?.status || "accepted";

  if (!providerCallId) {
    console.warn(
      "Exotel accepted the call without a readable immediate Call SID",
      {
        statusCode: response.status,
        contentType: response.headers.get("content-type"),
        leadId: String(lead._id),
      }
    );
  }

  return {
    accepted: true,
    providerCallId,
    providerStatus,
  };
}

module.exports = {
  startExotelFlowCall,
};
