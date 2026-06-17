import * as XLSX from "xlsx";
import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/utils";
import type * as Prisma from "@prisma/client";

export const CUSTOMER_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export const CUSTOMER_TEMPLATE_COLUMNS = [
  "SL",
  "Industry",
  "Company Name",
  "City/Zilla",
  "Address",
  "Primary Phone",
  "Phone 2",
  "Phone 3",
  "Primary Email",
  "Email 2",
  "Website",
  "Note",
  "Contact Person 1 Name",
  "Contact Person 1 Designation",
  "Contact Person 1 Department",
  "Contact Person 1 Phone 1",
  "Contact Person 1 Phone 2",
  "Contact Person 1 Email 1",
  "Contact Person 1 Email 2",
  "Contact Person 2 Name",
  "Contact Person 2 Designation",
  "Contact Person 2 Department",
  "Contact Person 2 Phone 1",
  "Contact Person 2 Phone 2",
  "Contact Person 2 Email 1",
  "Contact Person 2 Email 2",
  "Lead Source",
] as const;

export type CustomerTemplateColumn = (typeof CUSTOMER_TEMPLATE_COLUMNS)[number];

export const CUSTOMER_TEMPLATE_RAW_KEYS: readonly string[] = [
  "SL",
  "Industry",
  "Company Name",
  "City/Zilla",
  "Address",
  "Primary Phone",
  "Phone 2",
  "Phone 3",
  "Primary Email",
  "Email 2",
  "Website",
  "Note",
  "Contact Person 1 Name",
  "Contact Person 1 Designation",
  "Contact Person 1 Department",
  "Contact Person 1 Phone 1",
  "Contact Person 1 Phone 2",
  "Contact Person 1 Email 1",
  "Contact Person 1 Email 2",
  "Contact Person 2 Name",
  "Contact Person 2 Designation",
  "Contact Person 2 Department",
  "Contact Person 2 Phone 1",
  "Contact Person 2 Phone 2",
  "Contact Person 2 Email 1",
  "Contact Person 2 Email 2",
  "Lead Source",
] as const;

const CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN = CUSTOMER_TEMPLATE_COLUMNS.length;

export type CustomerTransferActor = {
  id: string;
  role: Role;
};

export type CustomerImportFailure = {
  row: number;
  reason: string;
};

export type CustomerImportResult = {
  success: true;
  inserted: number;
  updated: number;
  failed: CustomerImportFailure[];
};

export type CustomerExportFormat = "xlsx" | "csv";
type CustomerImportFormat = "EXCEL" | "CSV";

type ParsedCustomerRow = {
  row: number;
  companyName: string;
  primaryPhone: string;
  phone2?: string;
  phone3?: string;
  contactPerson?: string;
  industry?: string;
  address?: string;
  city?: string;
  website?: string;
  note?: string;
  leadSource?: string;
  primaryEmail?: string;
  email2?: string;
  designation1?: string;
  department1?: string;
  phone11?: string;
  phone12?: string;
  email11?: string;
  email12?: string;
  contactPerson2?: string;
  designation2?: string;
  department2?: string;
  phone21?: string;
  phone22?: string;
  email21?: string;
  email22?: string;
  rawData: Record<string, unknown>;
  totalLeads: number;
  lastCommunication?: Date;
};

interface JsonLikeRecord {
  [key: string]: JsonLike;
}

type JsonLike = string | number | boolean | null | JsonLike[] | JsonLikeRecord;
type ExistingCustomerRecord = {
  id: string;
  name: string;
  industry: string | null;
  phone: string;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  contactPerson?: string | null;
  phone2?: string | null;
  rawData?: Prisma.Prisma.JsonValue | null;
  contacts: Array<{
    id: string;
    name: string;
    designation: string | null;
    department?: string | null;
    email: string | null;
    mobile: string | null;
    isPrimary: boolean | null;
  }>;
  phoneNumbers: Array<{
    id: string;
    label: string | null;
    number: string;
    whatsapp: boolean | null;
  }>;
  leads: Array<{ id: string }>;
  communications: Array<{ createdAt: Date }>;
};

function normalizeCompanyKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .toLowerCase();
}

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  return undefined;
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function normalizeRawJson(value: Prisma.Prisma.JsonValue | undefined | null): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value) && value !== null) return value as Record<string, unknown>;
  return {};
}

function uniquePhones(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const value of values) {
    const phone = normalizePhone(value);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    phones.push(phone);
  }
  return phones;
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = normalizeJsonValue(nestedValue);
    }
    return output;
  }
  return String(value);
}

function toDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = normalizeText(value);
  if (!text) return undefined;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function exportDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function rowIndexFromTemplate(index: number) {
  const safe = Number.isFinite(index) ? index : 0;
  return safe + 2;
}

function mapTemplateRow(rawRow: Record<string, unknown>, rowNumber: number): ParsedCustomerRow {
  const get = (key: string) => normalizeText(rawRow[key]);

  const city = get("City/Zilla") ?? get("City / Zilla");
  const address = get("Address");
  const companyName = get("Company Name");
  const primaryPhone = normalizePhone(get("Primary Phone"));

  return {
    row: rowNumber,
    companyName: companyName ?? "",
    primaryPhone,
    phone2: get("Phone 2"),
    phone3: get("Phone 3"),
    contactPerson: get("Contact Person 1 Name"),
    industry: get("Industry"),
    address,
    city,
    website: get("Website"),
    note: get("Note"),
    leadSource: get("Lead Source"),
    primaryEmail: get("Primary Email"),
    email2: get("Email 2"),
    designation1: get("Contact Person 1 Designation"),
    department1: get("Contact Person 1 Department"),
    phone11: get("Contact Person 1 Phone 1"),
    phone12: get("Contact Person 1 Phone 2"),
    email11: get("Contact Person 1 Email 1"),
    email12: get("Contact Person 1 Email 2"),
    contactPerson2: get("Contact Person 2 Name"),
    designation2: get("Contact Person 2 Designation"),
    department2: get("Contact Person 2 Department"),
    phone21: get("Contact Person 2 Phone 1"),
    phone22: get("Contact Person 2 Phone 2"),
    email21: get("Contact Person 2 Email 1"),
    email22: get("Contact Person 2 Email 2"),
    rawData: rawRow,
    totalLeads: 0,
  };
}

function buildContactCreates(row: ParsedCustomerRow): Prisma.Prisma.ContactPersonCreateWithoutCompanyInput[] | undefined {
  const contacts: Prisma.Prisma.ContactPersonCreateWithoutCompanyInput[] = [];

  if (row.contactPerson || row.primaryPhone) {
    contacts.push({
      name: row.contactPerson ?? row.companyName,
      designation: row.designation1,
      email: row.primaryEmail,
      mobile: row.primaryPhone,
      isPrimary: true,
    });
  }

  if (row.contactPerson2) {
    contacts.push({
      name: row.contactPerson2,
      designation: row.designation2,
      email: row.email21 ?? row.email22 ?? undefined,
      mobile: row.phone21 ?? row.phone22 ?? undefined,
      isPrimary: false,
    });
  }

  return contacts.length ? contacts : undefined;
}

function buildPhoneCreates(row: ParsedCustomerRow): Prisma.Prisma.PhoneNumberCreateWithoutCompanyInput[] {
  return uniquePhones([row.primaryPhone, row.phone2, row.phone3, row.phone11, row.phone12, row.phone21, row.phone22]).map((number, index) => ({
    label: index === 0 ? "Primary" : `Phone ${index + 1}`,
    number,
    whatsapp: false,
  }));
}

function hasMatchingContact(existing: ExistingCustomerRecord, contact: NonNullable<ParsedCustomerRow["contactPerson2"]>) {
  const normalizedName = normalizeCompanyKey(contact);
  const normalizedEmail = normalizedText(contact.toLowerCase());
  const normalizedPhone = normalizePhone(contact);

  return existing.contacts.some((person) =>
    normalizeCompanyKey(person.name) === normalizedName
    || (person.email && person.email.toLowerCase() === normalizedEmail)
    || (person.mobile && normalizePhone(person.mobile) === normalizedPhone),
  );
}

function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildContactUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.Prisma.ContactPersonUpdateManyWithoutCompanyNestedInput | undefined {
  const primaryContact = existing.contacts.find((contact) => contact.isPrimary) ?? existing.contacts[0];
  const secondaryCreates = row.contactPerson2 && (!primaryContact || !hasMatchingContact(existing, row.contactPerson2))
    ? [{
      name: row.contactPerson2,
      designation: row.designation2,
      email: row.email21 ?? row.email22 ?? "",
      mobile: row.phone21 ?? row.phone22 ?? "",
      isPrimary: false,
    } satisfies Prisma.Prisma.ContactPersonCreateWithoutCompanyInput]
    : undefined;

  if (primaryContact) {
    return {
      update: [{
        where: { id: primaryContact.id },
        data: {
          name: row.contactPerson ?? primaryContact.name,
          designation: row.designation1 ?? primaryContact.designation,
          email: row.primaryEmail ?? primaryContact.email,
          mobile: row.primaryPhone,
          isPrimary: true,
        },
      }],
      ...(secondaryCreates ? { create: secondaryCreates } : {}),
    };
  }

  const contactCreates = buildContactCreates(row);
  if (!contactCreates) return undefined;
  return { create: contactCreates };
}

function buildContactCreateMutation(row: ParsedCustomerRow): Prisma.Prisma.ContactPersonCreateNestedManyWithoutCompanyInput | undefined {
  const contactCreates = buildContactCreates(row);
  return contactCreates ? { create: contactCreates } : undefined;
}

function buildPhoneUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.Prisma.PhoneNumberUpdateManyWithoutCompanyNestedInput {
  const primaryPhone = existing.phoneNumbers[0];
  const existingPhones = new Set(existing.phoneNumbers.map((item) => normalizePhone(item.number)).filter(Boolean));
  const createPhones = uniquePhones([row.phone2, row.phone3, row.phone11, row.phone12, row.phone21, row.phone22])
    .filter((phone) => !existingPhones.has(phone))
    .map((phone, index) => ({
      label: `Phone ${index + 2}`,
      number: phone,
      whatsapp: false,
    } satisfies Prisma.Prisma.PhoneNumberCreateWithoutCompanyInput));

  if (primaryPhone) {
    return {
      update: [{
        where: { id: primaryPhone.id },
        data: {
          label: primaryPhone.label || "Primary",
          number: row.primaryPhone,
          whatsapp: primaryPhone.whatsapp ?? false,
        },
      }],
      ...(createPhones.length ? { create: createPhones } : {}),
    };
  }

  return { create: buildPhoneCreates(row) };
}

function buildPhoneCreateMutation(row: ParsedCustomerRow): Prisma.Prisma.PhoneNumberCreateNestedManyWithoutCompanyInput {
  return {
    create: buildPhoneCreates(row),
  };
}

function parseWorkbookRows(buffer: Buffer, fileName: string) {
  const format = fileName.toLowerCase().endsWith(".csv") ? "CSV" : "EXCEL";
  const workbook = format === "CSV"
    ? XLSX.read(buffer.toString("utf8"), { type: "string", cellDates: true })
    : XLSX.read(buffer, { type: "buffer", cellDates: true });

  const [firstSheetName] = workbook.SheetNames;
  if (!firstSheetName) {
    return {
      rows: [] as ParsedCustomerRow[],
      failed: [{ row: 1, reason: "Workbook is empty." }] as CustomerImportFailure[],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (!rows.length) {
    return { rows: [] as ParsedCustomerRow[], failed: [{ row: 1, reason: "No rows found." }] as CustomerImportFailure[] };
  }

  const headers = rows[0] as unknown[];
  const failed: CustomerImportFailure[] = [];
  const fileHeaders = headers.map((value) => normalizeHeader(String(value ?? "")));
  const expectedHeaders = CUSTOMER_TEMPLATE_COLUMNS.map(normalizeHeader);

  for (let index = 0; index < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN; index += 1) {
    if (fileHeaders[index] !== expectedHeaders[index]) {
      failed.push({ row: 1, reason: `Template mismatch at column ${index + 1}. Expected "${CUSTOMER_TEMPLATE_COLUMNS[index]}".` });
      break;
    }
  }

  if (failed.length) {
    return { rows: [] as ParsedCustomerRow[], failed };
  }

  const parsed: ParsedCustomerRow[] = [];
  const seenNames = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index] as Array<unknown>;
    const rowNumber = index + 1;
    const rawData: Record<string, unknown> = {};

    for (let column = 0; column < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN; column += 1) {
      rawData[CUSTOMER_TEMPLATE_RAW_KEYS[column]] = normalizeJsonValue(values[column]);
    }

    const templateRow = mapTemplateRow(rawData, rowNumber);
    if (!templateRow.companyName) {
      failed.push({ row: rowIndexFromTemplate(index), reason: "Company Name is required." });
      continue;
    }

    if (!templateRow.primaryPhone) {
      failed.push({ row: rowIndexFromTemplate(index), reason: "Primary Phone is required." });
      continue;
    }

    const existingKey = normalizeCompanyKey(templateRow.companyName);
    if (seenNames.has(existingKey)) {
      failed.push({ row: rowIndexFromTemplate(index), reason: "Duplicate company name found in uploaded file." });
      continue;
    }

    seenNames.add(existingKey);
    parsed.push(templateRow);
  }

  return { rows: parsed, failed };
}

function readTemplateField(rawData: Record<string, unknown>, candidates: string[], fallback: string | undefined) {
  for (const key of candidates) {
    const value = normalizeText(rawData[key]);
    if (value) return value;
  }
  return fallback;
}

function buildTemplateRaw(company: ExistingCustomerRecord): Record<string, unknown> {
  const raw = normalizeRawJson((company as { rawData?: Prisma.Prisma.JsonValue }).rawData);
  const primaryContact = company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0];
  const companyCity = (company as { city?: string | null }).city;

  return {
    "SL": raw["SL"] ?? "",
    "Industry": raw["Industry"] ?? company.industry,
    "Company Name": raw["Company Name"] ?? raw["name"] ?? raw["customer"] ?? company.name,
    "City/Zilla": raw["City/Zilla"] ?? raw["City / Zilla"] ?? companyCity ?? "",
    "Address": raw["Address"] ?? company.address ?? "",
    "Primary Phone": raw["Primary Phone"] ?? company.phone,
    "Phone 2": raw["Phone 2"] ?? "",
    "Phone 3": raw["Phone 3"] ?? "",
    "Primary Email": readTemplateField(raw, ["Primary Email", "Email"], ""),
    "Email 2": readTemplateField(raw, ["Email 2"], ""),
    "Website": raw["Website"] ?? company.website ?? "",
    "Note": raw["Note"] ?? company.notes ?? "",
    "Contact Person 1 Name": raw["Contact Person 1 Name"] ?? company.contactPerson ?? primaryContact?.name ?? "",
    "Contact Person 1 Designation": raw["Contact Person 1 Designation"] ?? raw["Designation"] ?? "",
    "Contact Person 1 Department": raw["Contact Person 1 Department"] ?? raw["Department"] ?? "",
    "Contact Person 1 Phone 1": raw["Contact Person 1 Phone 1"] ?? "",
    "Contact Person 1 Phone 2": raw["Contact Person 1 Phone 2"] ?? "",
    "Contact Person 1 Email 1": raw["Contact Person 1 Email 1"] ?? primaryContact?.email ?? "",
    "Contact Person 1 Email 2": raw["Contact Person 1 Email 2"] ?? "",
    "Contact Person 2 Name": raw["Contact Person 2 Name"] ?? "",
    "Contact Person 2 Designation": raw["Contact Person 2 Designation"] ?? "",
    "Contact Person 2 Department": raw["Contact Person 2 Department"] ?? "",
    "Contact Person 2 Phone 1": raw["Contact Person 2 Phone 1"] ?? "",
    "Contact Person 2 Phone 2": raw["Contact Person 2 Phone 2"] ?? "",
    "Contact Person 2 Email 1": raw["Contact Person 2 Email 1"] ?? "",
    "Contact Person 2 Email 2": raw["Contact Person 2 Email 2"] ?? "",
    "Lead Source": raw["Lead Source"] ?? "",
  };
}

function mapExportRow(company: ExistingCustomerRecord) {
  const baseRaw = normalizeRawJson((company as { rawData?: Prisma.Prisma.JsonValue }).rawData);
  const primaryContact = company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0];
  const rawData = buildTemplateRaw({
    ...company,
    rawData: baseRaw,
    contacts: company.contacts,
    phoneNumbers: company.phoneNumbers,
    communications: company.communications,
    leads: company.leads,
  } as ExistingCustomerRecord);
  return CUSTOMER_TEMPLATE_RAW_KEYS.map((key) => normalizeText(rawData[key]) ?? "");
}

function readRawValue(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const found = raw[key];
    if (found === undefined || found === null) continue;
    const value = normalizeText(found);
    if (value) return value;
  }
  return "";
}

export async function importCustomersFromFile(buffer: Buffer, fileName: string, actor: CustomerTransferActor): Promise<CustomerImportResult> {
  const prisma = getPrisma();
  const format = fileName.toLowerCase().endsWith(".csv") ? "CSV" : "EXCEL";
  const parsed = parseWorkbookRows(buffer, fileName);
  const rows = parsed.rows;
  const failed = [...parsed.failed];

  if (!rows.length) {
    await prisma.importExportLog.create({
      data: {
        type: "IMPORT",
        module: "CUSTOMERS",
        format: format === "CSV" ? "CSV" : "EXCEL",
        requestedById: actor.id,
        fileName,
        status: "FAILED",
        processedRows: 0,
        failedRows: failed.length,
        errorMessage: failed.map((item) => `Row ${item.row}: ${item.reason}`).join("; "),
        completedAt: new Date(),
      },
    });

    return { success: true, inserted: 0, updated: 0, failed };
  }

  const companyNames = rows.map((row) => row.companyName);
  const existingCompanies = await prisma.customerCompany.findMany({
    where: {
      OR: companyNames.map((name) => ({ name: { equals: name, mode: "insensitive" } })),
    },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      phoneNumbers: { orderBy: { createdAt: "asc" } },
      leads: true,
      communications: { orderBy: { communicationAt: "desc" }, take: 1 },
    },
  });

  const existingByName = new Map<string, ExistingCustomerRecord>();
  const duplicateExistingKeys = new Set<string>();
  for (const company of existingCompanies) {
    const key = normalizeCompanyKey(company.name);
    if (existingByName.has(key)) {
      duplicateExistingKeys.add(key);
      continue;
    }
    existingByName.set(key, company);
  }

  const operations: Prisma.Prisma.PrismaPromise<unknown>[] = [];
  let inserted = 0;
  let updated = 0;

  const mergeRawData = (existing: Prisma.Prisma.JsonValue | null | undefined, incoming: Record<string, unknown>) => {
    const base = normalizeRawJson(existing);
    const merged = { ...base };
    const templateEntries = Object.entries(incoming);

    for (const [key, value] of templateEntries) {
      const asString = normalizeText(value);
      if (asString === undefined) continue;
      if (key === "SL") continue;
      merged[key] = asString;
    }

    for (const alias of ["Contact Person 1 Designation", "Designation"]) {
      const value = normalizeText(incoming[alias]);
      if (value) merged["Contact Person 1 Designation"] = value;
    }
    for (const alias of ["Contact Person 2 Designation"]) {
      const value = normalizeText(incoming[alias]);
      if (value) merged["Contact Person 2 Designation"] = value;
    }

    return merged;
  };

  for (const row of rows) {
    const rowKey = normalizeCompanyKey(row.companyName);
    if (duplicateExistingKeys.has(rowKey)) {
      failed.push({ row: row.row, reason: `Multiple existing records match "${row.companyName}".` });
      continue;
    }

    const existing = existingByName.get(rowKey);
    const assignedRelation = actor.role === "MARKETER"
      ? { assignedTo: { connect: { id: actor.id } } }
      : undefined;

    const mergedRawData = existing
      ? mergeRawData((existing as { rawData?: Prisma.Prisma.JsonValue }).rawData, row.rawData)
      : row.rawData;

    const companyPayload = {
      name: row.companyName,
      contactPerson: row.contactPerson ?? null,
      phone: row.primaryPhone,
      industry: row.industry ?? "General",
      phone2: row.phone2 || readRawValue(row.rawData, ["Phone 2"]) || undefined,
      city: row.city,
      address: row.address,
      website: row.website,
      notes: row.note ? row.note : undefined,
      totalLeads: row.totalLeads,
      lastCommunication: row.lastCommunication ?? undefined,
      rawData: mergedRawData,
      ...(assignedRelation ? assignedRelation : {}),
    } as Prisma.Prisma.CustomerCompanyUpdateInput & { rawData?: Prisma.Prisma.JsonValue };

    if (existing) {
      updated += 1;
      operations.push(prisma.customerCompany.update({
        where: { id: existing.id },
        data: {
          ...companyPayload,
          contacts: buildContactUpdateMutation(row, existing),
          phoneNumbers: buildPhoneUpdateMutation(row, existing),
        },
      }));
      continue;
    }

    inserted += 1;
    operations.push(prisma.customerCompany.create({
      data: {
        ...companyPayload,
        contacts: buildContactCreateMutation(row),
        phoneNumbers: buildPhoneCreateMutation(row),
      } as any,
    }));
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }

  await prisma.importExportLog.create({
    data: {
      type: "IMPORT",
      module: "CUSTOMERS",
      format: format === "CSV" ? "CSV" : "EXCEL",
      requestedById: actor.id,
      fileName,
      status: failed.length ? "FAILED" : "COMPLETED",
      processedRows: inserted + updated,
      failedRows: failed.length,
      errorMessage: failed.length ? failed.map((item) => `Row ${item.row}: ${item.reason}`).join("; ") : undefined,
      completedAt: new Date(),
    },
  });

  return {
    success: true,
    inserted,
    updated,
    failed,
  };
}

export async function exportCustomers(actor: CustomerTransferActor, format: CustomerExportFormat) {
  const prisma = getPrisma();
  const companies = await prisma.customerCompany.findMany({
    where: {},
    include: {
      assignedTo: true,
      contacts: { orderBy: { createdAt: "asc" } },
      phoneNumbers: { orderBy: { createdAt: "asc" } },
      leads: true,
      communications: { orderBy: { communicationAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const rows = companies.map((company) => mapExportRow(company));
  const worksheet = XLSX.utils.aoa_to_sheet([[...CUSTOMER_TEMPLATE_COLUMNS], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

  const output = format === "csv"
    ? Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8")
    : Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  await prisma.importExportLog.create({
    data: {
      type: "EXPORT",
      module: "CUSTOMERS",
      format: format === "csv" ? "CSV" : "EXCEL",
      requestedById: actor.id,
      fileName: format === "csv" ? "customers-export.csv" : "customers-export.xlsx",
      status: "COMPLETED",
      processedRows: rows.length,
      failedRows: 0,
      completedAt: new Date(),
    },
  });

  return {
    buffer: output,
    rowCount: rows.length,
    fileName: format === "csv" ? "customers-export.csv" : "customers-export.xlsx",
    contentType: format === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}


