/**
 * Minimal RFC 4180 CSV reader.
 *
 * Handles quoted fields, escaped quotes, and newlines inside quotes, which is
 * enough for the contact exports people paste into a CRM import.
 */
export function parseCsv(input: string): string[][] {
  return parseNumberedRows(input).map((entry) => entry.cells);
}

/**
 * A parsed row and its position in the file, counting from 1.
 *
 * Position counts records, not physical lines, which is what a spreadsheet
 * shows: a blank line takes a row, and a quoted field running over several
 * lines is still one.
 */
export type NumberedRow = { row: number; cells: string[] };

/**
 * Every non-blank row, tagged with its position in the file.
 *
 * A record can span several lines when a field is quoted, and blank lines are
 * skipped, so a record's index among the parsed rows is not where the user will
 * find it. Anything that reports a row back to a person needs the number they
 * would see, which is what this keeps.
 */
export function parseNumberedRows(input: string): NumberedRow[] {
  const rows: NumberedRow[] = [];
  let position = 0;
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Treat CRLF as one break.
      if (char === '\r' && input[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      position += 1;
      rows.push({ row: position, cells: row });
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    position += 1;
    rows.push({ row: position, cells: row });
  }

  return rows.filter((entry) => entry.cells.some((cell) => cell.trim().length > 0));
}

/** A record keyed by the header, and the file row it came from. */
export type CsvRecord = { row: number; values: Record<string, string> };

/**
 * Parse CSV text into objects keyed by the header row, each tagged with the
 * row it came from so a rejected record can be pointed at.
 */
export function parseCsvRecordsWithRows(input: string): CsvRecord[] {
  const [header, ...body] = parseNumberedRows(input);
  if (!header) {
    return [];
  }
  const keys = header.cells.map((cell) => cell.trim());
  return body.map((entry) => ({
    row: entry.row,
    values: Object.fromEntries(keys.map((key, index) => [key, (entry.cells[index] ?? '').trim()])),
  }));
}

/** Parse CSV text into objects keyed by the header row. */
export const parseCsvRecords = (input: string): Record<string, string>[] =>
  parseCsvRecordsWithRows(input).map((entry) => entry.values);
