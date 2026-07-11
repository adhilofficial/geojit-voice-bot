const rawApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api";

const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

async function handleResponse(response) {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        "Something went wrong"
    );
  }

  return data;
}

export async function getLeads(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();

  const response = await fetch(
    `${API_BASE_URL}/leads${query ? `?${query}` : ""}`
  );

  return handleResponse(response);
}

export async function createLead(payload) {
  const response = await fetch(`${API_BASE_URL}/leads`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function uploadLeadCsv(file, batchName) {
  const formData = new FormData();

  formData.append("file", file);

  if (batchName) {
    formData.append("batchName", batchName);
  }

  const response = await fetch(
    `${API_BASE_URL}/leads/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  return handleResponse(response);
}

export async function startMockCall(leadId) {
  const response = await fetch(
    `${API_BASE_URL}/calls/${leadId}/start`,
    {
      method: "POST",
    }
  );

  return handleResponse(response);
}

export async function submitMockDigit(leadId, digit) {
  const response = await fetch(
    `${API_BASE_URL}/calls/${leadId}/digit`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        digit: String(digit),
      }),
    }
  );

  return handleResponse(response);
}

export async function endMockCall(leadId) {
  const response = await fetch(
    `${API_BASE_URL}/calls/${leadId}/end`,
    {
      method: "POST",
    }
  );

  return handleResponse(response);
}

export async function downloadInterestedCsv() {
  const response = await fetch(
    `${API_BASE_URL}/leads/export/interested`
  );

  if (!response.ok) {
    let message =
      "Unable to export interested customers";

    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);

  const date = new Date()
    .toISOString()
    .slice(0, 10);

  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download =
    `geojit-interested-customers-${date}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(downloadUrl);
}

export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  return handleResponse(response);
}