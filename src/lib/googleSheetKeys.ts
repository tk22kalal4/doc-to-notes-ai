/**
 * Google Sheets integration for fetching Groq API keys
 * 
 * Fetches keys from Column C (Groq API Key) in the specified Google Sheet
 * The sheet must be shared publicly (view access)
 */

const SHEET_ID = "1Xxer-mz8HlzVWNajFC36SImgwdOdXmVwZdt5Ei-wYYU";
const SHEET_GID = "0"; // First sheet (modify if using a different sheet)
const HEADER_ROW = 1; // Keys start from row 2 (row 1 is header)

interface SheetRow {
  [key: string]: string;
}

/**
 * Fetches all Groq API keys from Google Sheet using CSV export
 * This bypasses the need for Google API credentials
 */
export async function fetchKeysFromGoogleSheet(): Promise<string[]> {
  try {
    // Use Google Sheets CSV export URL
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      console.warn("[googleSheetKeys] Failed to fetch sheet:", response.status);
      return [];
    }

    const csvText = await response.text();
    const lines = csvText.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) {
      console.warn("[googleSheetKeys] Sheet is empty or has only headers");
      return [];
    }

    // Parse CSV headers
    const headers = parseCSVLine(lines[0]);
    const groqKeyIndex = headers.findIndex(h => 
      h.toLowerCase().includes("groq") && h.toLowerCase().includes("key")
    );

    if (groqKeyIndex === -1) {
      console.warn("[googleSheetKeys] 'Groq API Key' column not found in sheet");
      return [];
    }

    // Extract keys from data rows
    const keys: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const key = row[groqKeyIndex]?.trim();
      
      if (key && key.startsWith("gsk_") && key.length > 10) {
        keys.push(key);
      }
    }

    console.log(`[googleSheetKeys] Successfully loaded ${keys.length} keys from Google Sheet`);
    return keys;
  } catch (err) {
    console.warn("[googleSheetKeys] Error fetching from Google Sheet:", err);
    return [];
  }
}

/**
 * Simple CSV parser that handles quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      // End of field
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
