const API_BASE_URL = '/api';

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP Error: ${response.status}`);
  }
  return response.json();
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  return handleResponse(res);
}

export async function fetchOverviewStats() {
  const res = await fetch(`${API_BASE_URL}/overview/stats`);
  return handleResponse(res);
}

export async function fetchAccounts({ page = 1, limit = 20, search = '', layer = 'ALL', minRisk = null, sortBy = 'priority' } = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort_by: sortBy
  });
  if (search) params.append('search', search);
  if (layer && layer !== 'ALL') params.append('layer', layer);
  if (minRisk !== null && minRisk !== undefined) params.append('min_risk', minRisk.toString());

  const res = await fetch(`${API_BASE_URL}/accounts?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchReviewSuggestions() {
  const res = await fetch(`${API_BASE_URL}/accounts/review-suggestions`);
  return handleResponse(res);
}

export async function fetchAccountDetails(accountId) {
  const res = await fetch(`${API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/details`);
  return handleResponse(res);
}

export async function fetchAccountTransactions(accountId, { page = 1, limit = 50, direction = 'all' } = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    direction: direction
  });
  const res = await fetch(`${API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/transactions?${params.toString()}`);
  return handleResponse(res);
}

export async function traceAccountFunds(accountId, { maxHops = 4, maxOutgoing = 25, maxPaths = 1000 } = {}) {
  const params = new URLSearchParams({
    max_hops: maxHops.toString(),
    max_outgoing: maxOutgoing.toString(),
    max_paths: maxPaths.toString()
  });
  const res = await fetch(`${API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/trace?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchGlobalNetworkGraph(limitHubs = 25) {
  const res = await fetch(`${API_BASE_URL}/network/global-graph?limit_hubs=${limitHubs}`);
  return handleResponse(res);
}

export async function fetchDetectionSignals() {
  const res = await fetch(`${API_BASE_URL}/detection/signals`);
  return handleResponse(res);
}

export async function runDataAnalysis(datasetName = 'VoidHacks8_MuleAccount_2M_Transactions.csv') {
  const res = await fetch(`${API_BASE_URL}/analysis/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_name: datasetName })
  });
  return handleResponse(res);
}

export async function uploadDatasetFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/analysis/upload`, {
    method: 'POST',
    body: formData
  });
  return handleResponse(res);
}

export async function generateReport(accountId) {
  const res = await fetch(`${API_BASE_URL}/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId })
  });
  return handleResponse(res);
}

export function getExportHighRiskUrl() {
  return `${API_BASE_URL}/exports/high-risk`;
}

export function getExportLowRiskUrl() {
  return `${API_BASE_URL}/exports/low-risk`;
}

export function getExportRapidPassThroughUrl() {
  return `${API_BASE_URL}/exports/rapid-pass-through`;
}
