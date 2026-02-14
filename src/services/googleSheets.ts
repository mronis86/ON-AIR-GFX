// Google Sheets API integration
// This will handle writing data to Google Sheets in real-time

/**
 * Extracts the spreadsheet ID from a Google Sheets URL.
 * Accepts: docs.google.com/spreadsheets/d/ID/edit, /view, / or ?...
 * @param url - Google Sheets URL (any leading/trailing space is trimmed)
 * @returns The spreadsheet ID or null if not found
 */
export const extractSpreadsheetId = (url: string): string | null => {
  const trimmed = (url || '').trim();
  // Match /spreadsheets/d/ID followed by /, ?, #, or end of string (ID is alphanumeric, hyphen, underscore)
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?|#)/) ||
    trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

/**
 * Returns true if the string looks like a Google Apps Script Web App URL (script.google.com).
 */
export const isValidWebAppUrl = (url: string): boolean => {
  const trimmed = (url || '').trim();
  return /^https:\/\/script\.google\.com\/macros\/.+\/(exec|dev)/i.test(trimmed) ||
    /^https:\/\/script\.google\.com\/.+\/exec/i.test(trimmed);
};

/**
 * Creates sub-sheets in a Google Spreadsheet
 * Note: This requires Google Sheets API setup with proper authentication
 * Currently disabled - will be implemented when Google Sheets API is configured
 * @param spreadsheetId - The ID of the spreadsheet
 * @param sheetNames - Array of sheet names to create
 */
export const createSubSheets = async (
  _spreadsheetId: string,
  _sheetNames: string[]
): Promise<void> => {
  // Google Sheets API integration is currently disabled
  // This will be implemented when Google Sheets API credentials are configured
  // For now, we'll just log that it would be called
  console.log('Google Sheets API integration is disabled');
  return Promise.resolve();
};

/**
 * Writes event data to Google Sheets
 * @param spreadsheetId - The ID of the spreadsheet
 * @param event - Event data to write
 */
export const writeEventToSheet = async (
  _spreadsheetId: string,
  event: { id: string; name: string; date: string; googleSheetUrl?: string }
): Promise<void> => {
  // TODO: Implement Google Sheets API call to write event data
  console.log('Writing event to sheet:', event);
};

/**
 * Writes poll data to Google Sheets
 * @param spreadsheetId - The ID of the spreadsheet
 * @param poll - Poll data to write
 */
export const writePollToSheet = async (
  _spreadsheetId: string,
  poll: { id: string; eventId: string; type: string; title: string; options: any[] }
): Promise<void> => {
  // TODO: Implement Google Sheets API call to write poll data
  console.log('Writing poll to sheet:', poll);
};

/** Default sub-sheet names to create in the spreadsheet when initializing. */
export const DEFAULT_SHEET_NAMES = ['Events', 'Polls', 'WebLinks', 'InfoBars', 'Boxes', 'Q&A'] as const;

/** Proxy URL for Google Web App (avoids CORS). Built from Firebase project when available. */
function getSheetProxyUrl(): string {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (projectId) {
    return `https://us-central1-${projectId}.cloudfunctions.net/sheetProxy`;
  }
  return '';
}

/**
 * POST JSON to a Google Apps Script Web App URL. Uses Firebase proxy when available to avoid CORS.
 */
export async function postToWebApp(webAppUrl: string, body: object): Promise<Response> {
  const url = webAppUrl.trim();
  if (!url) throw new Error('Web App URL is required');
  const proxy = getSheetProxyUrl();
  if (proxy) {
    const res = await fetch(proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, body }),
    });
    return res;
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Asks the Apps Script Web App to ensure these sub-sheets exist in the spreadsheet.
 * Uses proxy when available to avoid "Failed to fetch" (CORS).
 * @param webAppUrl - Full URL of the deployed Apps Script Web App
 * @param sheetNames - Sheet tab names to create if missing
 */
export const requestCreateSubSheets = async (
  webAppUrl: string,
  sheetNames: string[] = [...DEFAULT_SHEET_NAMES]
): Promise<void> => {
  const res = await postToWebApp(webAppUrl, { type: 'initialize', sheetNames });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text ? `Sheet initialization failed: ${text}` : `Sheet initialization failed: ${res.status} ${res.statusText}`);
  }
};

/**
 * Initializes a Google Sheet with the required structure.
 * If webAppUrl is provided, requests the Web App to create sub-sheets (Events, Polls, etc.).
 * Otherwise only validates the spreadsheet ID (no API credentials in the app).
 * @param spreadsheetId - The ID of the spreadsheet (from the sheet URL)
 * @param webAppUrl - Optional. When set, POSTs to the Web App to create sub-sheets.
 */
export const initializeGoogleSheet = async (
  spreadsheetId: string,
  webAppUrl?: string
): Promise<void> => {
  if (webAppUrl?.trim()) {
    await requestCreateSubSheets(webAppUrl.trim());
  }
  // If no Web App URL, we don't have a way to create sheets from the app (no Sheets API).
  // The spreadsheet ID is still valid for display/linking.
};

