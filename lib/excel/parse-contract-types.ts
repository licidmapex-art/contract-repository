import * as XLSX from "xlsx";

export interface ParsedContractType {
  name: string;
  description: string | null;
  notes: string | null;
}

const COLUMN_ALIASES: Record<string, keyof ParsedContractType> = {
  name: "name",
  "contract type": "name",
  type: "name",
  description: "description",
  desc: "description",
  notes: "notes",
  note: "notes",
  comments: "notes",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function parseContractTypesExcel(buffer: Buffer): ParsedContractType[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  if (!rows.length) return [];

  const headerRow = rows[0] as unknown[];
  const columnMap = new Map<number, keyof ParsedContractType>();

  headerRow.forEach((cell, index) => {
    const key = COLUMN_ALIASES[normalizeHeader(cell)];
    if (key) columnMap.set(index, key);
  });

  const dataRows =
    columnMap.size > 0
      ? rows.slice(1)
      : rows.map((row) => {
          const cells = row as unknown[];
          return [cells[0], cells[1], cells[2]];
        });

  if (columnMap.size === 0) {
    columnMap.set(0, "name");
    columnMap.set(1, "description");
    columnMap.set(2, "notes");
  }

  const types: ParsedContractType[] = [];

  for (const row of dataRows) {
    const cells = row as unknown[];
    const item: ParsedContractType = {
      name: "",
      description: null,
      notes: null,
    };

    columnMap.forEach((field, index) => {
      const value = cellValue(cells[index]);
      if (field === "name" && value) item.name = value;
      else if (value) item[field] = value;
    });

    if (item.name) types.push(item);
  }

  return types;
}
