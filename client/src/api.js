const API_BASE_URL = "/api";
const DEFAULT_API_TIMEOUT_MS = 15000;

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function apiRequest(path, options = {}) {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...requestOptions } = options;
  const token = localStorage.getItem("rms_token");
  const headers = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  const timeout = createTimeoutSignal(timeoutMs);

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
      signal: timeout.signal,
    });
  } catch (error) {
    timeout.clear();
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out for ${API_BASE_URL}${path}`);
    }
    throw new Error(`Unable to reach the API at ${API_BASE_URL}${path}`);
  }
  timeout.clear();

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

export async function apiDownload(path, filename) {
  const timeout = createTimeoutSignal(30000);
  const token = localStorage.getItem("rms_token");
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers,
      signal: timeout.signal,
    });
  } catch (error) {
    timeout.clear();
    if (error?.name === "AbortError") {
      throw new Error(`Download timed out for ${API_BASE_URL}${path}`);
    }
    throw new Error(`Unable to reach the API at ${API_BASE_URL}${path}`);
  }
  timeout.clear();

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Download failed");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
