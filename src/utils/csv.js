// Pure CSV helpers (no DB access) shared by the evaluator and Study 5 exports.

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCsvCell(value, { neutralizeFormulas = false } = {}) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (neutralizeFormulas && FORMULA_PREFIX.test(s)) {
    // Spreadsheet formula-injection guard: a leading apostrophe makes the cell literal text.
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param rows objects keyed by column key
 * @param columns [{ key, header, neutralizeFormulas? }]
 * @param options.neutralizeFormulas default for columns that do not set it
 */
function rowsToCsvString(rows, columns, { neutralizeFormulas = false } = {}) {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns
      .map((col) =>
        escapeCsvCell(row[col.key] ?? '', {
          neutralizeFormulas: col.neutralizeFormulas ?? neutralizeFormulas
        })
      )
      .join(',')
  );
  return [headerLine, ...dataLines].join('\r\n');
}

function sanitizeFilename(name) {
  return String(name || 'export')
    .replace(/[^\w\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'export';
}

module.exports = {
  escapeCsvCell,
  rowsToCsvString,
  sanitizeFilename
};
