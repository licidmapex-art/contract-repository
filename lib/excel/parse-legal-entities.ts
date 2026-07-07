import * as XLSX from "xlsx";

export interface ParsedLegalEntity {
  name: string;
  registration_number: string | null;
  country: string | null;
  vat_number: string | null;
  notes: string | null;
}

const COLUMN_ALIASES: Record<string, keyof ParsedLegalEntity> = {
  name: "name",
  "legal entity": "name",
  "legal entity name": "name",
  company: "name",
  "company name": "name",
  entity: "name",
  registration_number: "registration_number",
  "registration number": "registration_number",
  "company number": "registration_number",
  "reg no": "registration_number",
  country: "country",
  vat_number: "vat_number",
  "vat number": "vat_number",
  vat: "vat_number",
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

export function parseLegalEntitiesExcel(buffer: Buffer): ParsedLegalEntity[] {
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
  const columnMap = new Map<number, keyof ParsedLegalEntity>();

  headerRow.forEach((cell, index) => {
    const key = COLUMN_ALIASES[normalizeHeader(cell)];
    if (key) columnMap.set(index, key);
  });

  const dataRows =
    columnMap.size > 0
      ? rows.slice(1)
      : rows.map((row) => {
          const cells = row as unknown[];
          return [cells[0], cells[1], cells[2], cells[3], cells[4]];
        });

  if (columnMap.size === 0) {
    columnMap.set(0, "name");
    columnMap.set(1, "registration_number");
    columnMap.set(2, "country");
    columnMap.set(3, "vat_number");
    columnMap.set(4, "notes");
  }

  const entities: ParsedLegalEntity[] = [];

  for (const row of dataRows) {
    const cells = row as unknown[];
    const entity: ParsedLegalEntity = {
      name: "",
      registration_number: null,
      country: null,
      vat_number: null,
      notes: null,
    };

    columnMap.forEach((field, index) => {
      const value = cellValue(cells[index]);
      if (field === "name" && value) entity.name = value;
      else if (value) entity[field] = value;
    });

    if (entity.name) entities.push(entity);
  }

  return entities;
}
