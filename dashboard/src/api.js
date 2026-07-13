const rawApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api";

const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 30000;
const AUTH_TOKEN_STORAGE_KEY = "geojit:admin-access-token";
const AUTH_EXPIRES_AT_STORAGE_KEY = "geojit:admin-expires-at";

export function getAuthToken() {
  try {
    return window.sessionStorage.getItem(
      AUTH_TOKEN_STORAGE_KEY
    );
  } catch {
    return null;
  }
}

export function saveAuthSession(token, expiresAt) {
  try {
    window.sessionStorage.setItem(
      AUTH_TOKEN_STORAGE_KEY,
      token
    );

    if (expiresAt) {
      window.sessionStorage.setItem(
        AUTH_EXPIRES_AT_STORAGE_KEY,
        expiresAt
      );
    } else {
      window.sessionStorage.removeItem(
        AUTH_EXPIRES_AT_STORAGE_KEY
      );
    }
  } catch {
    throw new Error(
      "Unable to save the login session in this browser"
    );
  }
}

export function clearAuthSession() {
  try {
    window.sessionStorage.removeItem(
      AUTH_TOKEN_STORAGE_KEY
    );
    window.sessionStorage.removeItem(
      AUTH_EXPIRES_AT_STORAGE_KEY
    );
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export function getStoredSessionExpiry() {
  try {
    return window.sessionStorage.getItem(
      AUTH_EXPIRES_AT_STORAGE_KEY
    );
  } catch {
    return null;
  }
}

function notifyUnauthorized() {
  window.dispatchEvent(
    new CustomEvent("geojit:unauthorized")
  );
}

async function request(
  url,
  options = {},
  { auth = true } = {}
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS
  );

  try {
    const headers = new Headers(options.headers || {});

    if (auth) {
      const token = getAuthToken();

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    if (response.status === 401 && auth && getAuthToken()) {
      clearAuthSession();
      notifyUnauthorized();
    }

    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The server took too long to respond");
    }

    throw new Error(
      error.message || "Unable to connect to the server"
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

async function handleResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  } else {
    const text = await response.text();
    data = text ? { message: text } : {};
  }

  if (!response.ok) {
    if (response.status === 401 && getAuthToken()) {
      clearAuthSession();
      notifyUnauthorized();
    }

    throw new Error(
      data.message ||
        data.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

async function downloadCsvResponse(response, fallbackFilename) {
  if (!response.ok) {
    let message = "Unable to download CSV file";

    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // Keep the default message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const contentDisposition =
    response.headers.get("content-disposition") || "";
  const filenameMatch = contentDisposition.match(
    /filename="?([^";]+)"?/i
  );
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filenameMatch?.[1] || fallbackFilename;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export async function loginAdmin(email, password) {
  const response = await request(
    `${API_BASE_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
    { auth: false }
  );

  return handleResponse(response);
}


export async function logoutAdmin() {
  const response = await request(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
  });

  return handleResponse(response);
}

export async function getCurrentAdmin() {
  const response = await request(
    `${API_BASE_URL}/auth/me`
  );

  return handleResponse(response);
}

export async function getLeads(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const response = await request(
    `${API_BASE_URL}/leads${query ? `?${query}` : ""}`
  );

  return handleResponse(response);
}

export async function createLead(payload) {
  const response = await request(`${API_BASE_URL}/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function deleteLead(leadId) {
  const response = await request(
    `${API_BASE_URL}/leads/${encodeURIComponent(leadId)}`,
    {
      method: "DELETE",
    }
  );

  return handleResponse(response);
}

export async function uploadLeadCsv(file, batchName) {
  const formData = new FormData();
  formData.append("file", file);

  if (batchName) {
    formData.append("batchName", batchName);
  }

  const response = await request(
    `${API_BASE_URL}/leads/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  return handleResponse(response);
}

export async function startLiveCall(leadId) {
  const response = await request(
    `${API_BASE_URL}/live-calls/${encodeURIComponent(
      leadId
    )}/start`,
    {
      method: "POST",
    }
  );

  return handleResponse(response);
}

export async function syncLiveCall(leadId) {
  const response = await request(
    `${API_BASE_URL}/live-calls/${encodeURIComponent(
      leadId
    )}/sync`,
    {
      method: "POST",
    }
  );

  return handleResponse(response);
}

export async function startMockCall(leadId) {
  const response = await request(
    `${API_BASE_URL}/calls/${encodeURIComponent(
      leadId
    )}/start`,
    {
      method: "POST",
    }
  );

  return handleResponse(response);
}

export async function submitMockDigit(leadId, digit) {
  const response = await request(
    `${API_BASE_URL}/calls/${encodeURIComponent(
      leadId
    )}/digit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ digit: String(digit) }),
    }
  );

  return handleResponse(response);
}

export async function endMockCall(leadId) {
  const response = await request(
    `${API_BASE_URL}/calls/${encodeURIComponent(
      leadId
    )}/end`,
    {
      method: "POST",
    }
  );

  return handleResponse(response);
}

export async function downloadInterestedCsv() {
  const response = await request(
    `${API_BASE_URL}/leads/export/interested`
  );
  const date = new Date().toISOString().slice(0, 10);

  await downloadCsvResponse(
    response,
    `geojit-interested-customers-${date}.csv`
  );
}

export async function getCallbackRequests(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const response = await request(
    `${API_BASE_URL}/leads/callbacks${query ? `?${query}` : ""}`
  );

  return handleResponse(response);
}

export async function updateCallbackFollowUpStatus(
  leadId,
  status
) {
  const response = await request(
    `${API_BASE_URL}/leads/${encodeURIComponent(
      leadId
    )}/callback-status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  return handleResponse(response);
}

export async function downloadCallbackRequestsCsv(
  params = {}
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const response = await request(
    `${API_BASE_URL}/leads/export/callbacks${
      query ? `?${query}` : ""
    }`
  );
  const date = new Date().toISOString().slice(0, 10);

  await downloadCsvResponse(
    response,
    `geojit-callback-requests-${date}.csv`
  );
}

export async function downloadCampaignResultsCsv(leadIds) {
  const response = await request(
    `${API_BASE_URL}/leads/export/campaign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadIds,
      }),
    }
  );
  const date = new Date().toISOString().slice(0, 10);

  await downloadCsvResponse(
    response,
    `geojit-campaign-results-${date}.csv`
  );
}


export async function getActivityLogs(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const response = await request(
    `${API_BASE_URL}/activity-logs${query ? `?${query}` : ""}`
  );

  return handleResponse(response);
}

export async function recordAdminActivity(payload) {
  const response = await request(
    `${API_BASE_URL}/activity-logs/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(response);
}

export async function downloadActivityLogsCsv(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const response = await request(
    `${API_BASE_URL}/activity-logs/export${
      query ? `?${query}` : ""
    }`
  );
  const date = new Date().toISOString().slice(0, 10);

  await downloadCsvResponse(
    response,
    `geojit-admin-activity-${date}.csv`
  );
}


export async function checkBackendHealth() {
  const response = await request(
    `${API_BASE_URL}/health`,
    {},
    { auth: false }
  );
  return handleResponse(response);
}
