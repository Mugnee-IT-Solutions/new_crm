import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/utils";

export const CUSTOMER_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

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
  contactPerson?: string;
  phone: string;
  extraPhones: string[];
  industry?: string;
  address?: string;
  website?: string;
  notes?: string;
  primaryEmail?: string;
  designation?: string;
  secondaryContact?: {
    name: string;
    designation?: string;
    email?: string;
    phone?: string;
  };
  rawData: Record<string, unknown>;
  assignedTo?: string;
  totalLeads: number;
  lastCommunication?: Date;
};

type ExistingCustomerRecord = Prisma.CustomerCompanyGetPayload<{
  include: {
    assignedTo: true;
    contacts: { orderBy: { createdAt: "asc" } };
    phoneNumbers: { orderBy: { createdAt: "asc" } };
    leads: true;
    communications: { orderBy: { communicationAt: "desc" }; take: 1 };
  };
}>;

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function normalizeCompanyKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = normalizeHeader(key);
      if (!normalizedKey) continue;
      output[normalizedKey] = normalizeJsonValue(nestedValue);
    }
    return output;
  }

  return String(value);
}

function normalizeRawJson(value: Prisma.JsonValue | undefined | null): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value) && value !== null) return value as Record<string, unknown>;
  return {};
}

function normalizeRawRow(rawRow: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(rawRow)) {
    const key = normalizeHeader(rawKey);
    if (!key) continue;
    output[key] = normalizeJsonValue(rawValue);
  }
  return output;
}

function getCell(row: Record<string, unknown>, header: string) {
  if (Object.prototype.hasOwnProperty.call(row, header)) return row[header];

  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeader(key) === header) return value;
  }

  return undefined;
}

export function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function getFirstText(row: Record<string, unknown>, headers: string[]) {
  for (const header of headers) {
    const value = normalizeText(getCell(row, header));
    if (value) return value;
  }

  return undefined;
}

function getFirstCell(row: Record<string, unknown>, headers: string[]) {
  for (const header of headers) {
    const value = getCell(row, header);
    if (normalizeText(value)) return value;
  }

  return undefined;
}

function getFirstPhone(row: Record<string, unknown>, headers: string[]) {
  for (const header of headers) {
    const phone = normalizePhone(getCell(row, header));
    if (phone) return phone;
  }

  return undefined;
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

function toLeadCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function toDate(value: unknown) {
  if (!value) return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
  }

  const text = normalizeText(value);
  if (!text) return undefined;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function exportDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function mapExportRow(company: ExistingCustomerRecord) {
  const rawDataValue = (company as { rawData?: Prisma.JsonValue }).rawData;
  const rawData = (typeof rawDataValue === "object" && rawDataValue !== null && !Array.isArray(rawDataValue))
    ? rawDataValue as Record<string, unknown>
    : {};
  const primaryContact = company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0];
  const primaryPhone = company.phoneNumbers[0];
  const exportRow: Record<string, unknown> = { ...rawData };

  if (!("Company Name" in exportRow) && !("companyName" in exportRow) && !("customer" in exportRow)) {
    exportRow["Company Name"] = company.name;
  }

  if (!("Contact Person" in exportRow) && !("contactPerson" in exportRow) && !("Contact Person 1 Name" in exportRow)) {
    exportRow["Contact Person"] = company.contactPerson ?? primaryContact?.name ?? "";
  }

  if (!("Phone" in exportRow) && !("Primary Phone" in exportRow) && !("phone" in exportRow)) {
    exportRow["Phone"] = company.phone || primaryPhone?.number || primaryContact?.mobile || "";
  }

  if (!("Industry" in exportRow) && !("industry" in exportRow)) {
    exportRow["Industry"] = company.industry ?? "";
  }

  if (!("Address" in exportRow) && !("address" in exportRow)) {
    exportRow["Address"] = company.address ?? "";
  }

  if (!("Website" in exportRow) && !("website" in exportRow)) {
    exportRow["Website"] = company.website ?? "";
  }

  if (!("Assigned" in exportRow) && !("Assigned To" in exportRow) && !("assignedTo" in exportRow)) {
    exportRow["Assigned"] = company.assignedTo?.name ?? "";
  }

  if (!("Total Leads" in exportRow) && !("totalLeads" in exportRow)) {
    exportRow["Total Leads"] = Math.max(company.totalLeads, company.leads.length);
  }

  if (!("Last Communication" in exportRow) && !("Last Communication Date" in exportRow) && !("lastCommunication" in exportRow)) {
    exportRow["Last Communication"] = exportDate(company.lastCommunication ?? company.communications[0]?.communicationAt);
  }

  return exportRow;
}

function buildContactCreates(row: ParsedCustomerRow): Prisma.ContactPersonCreateWithoutCompanyInput[] | undefined {
  const contacts: Prisma.ContactPersonCreateWithoutCompanyInput[] = [];

  if (row.contactPerson || row.phone) {
    contacts.push({
      name: row.contactPerson ?? row.companyName,
      designation: row.designation,
      email: row.primaryEmail,
      mobile: row.phone,
      isPrimary: true,
    });
  }

  if (row.secondaryContact?.name) {
    contacts.push({
      name: row.secondaryContact.name,
      designation: row.secondaryContact.designation,
      email: row.secondaryContact.email,
      mobile: row.secondaryContact.phone,
      isPrimary: false,
    });
  }

  return contacts.length ? contacts : undefined;
}

function hasMatchingContact(existing: ExistingCustomerRecord, contact: NonNullable<ParsedCustomerRow["secondaryContact"]>) {
  const nameKey = normalizeCompanyKey(contact.name);
  const emailKey = contact.email?.toLowerCase();
  const phoneKey = contact.phone ? normalizePhone(contact.phone) : undefined;

  return existing.contacts.some((person) => {
    if (normalizeCompanyKey(person.name) === nameKey) return true;
    if (emailKey && person.email?.toLowerCase() === emailKey) return true;
    return Boolean(phoneKey && person.mobile && normalizePhone(person.mobile) === phoneKey);
  });
}

function buildContactUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.ContactPersonUpdateManyWithoutCompanyNestedInput | undefined {
  const primaryContact = existing.contacts.find((contact) => contact.isPrimary) ?? existing.contacts[0];
  const secondaryCreates = row.secondaryContact && !hasMatchingContact(existing, row.secondaryContact)
    ? [{
        name: row.secondaryContact.name,
        designation: row.secondaryContact.designation,
        email: row.secondaryContact.email,
        mobile: row.secondaryContact.phone,
        isPrimary: false,
      } satisfies Prisma.ContactPersonCreateWithoutCompanyInput]
    : undefined;

  if (primaryContact) {
    return {
      update: [
        {
          where: { id: primaryContact.id },
          data: {
            name: row.contactPerson ?? primaryContact.name,
            designation: row.designation ?? primaryContact.designation,
            email: row.primaryEmail ?? primaryContact.email,
            mobile: row.phone,
            isPrimary: true,
          },
        },
      ],
      ...(secondaryCreates ? { create: secondaryCreates } : {}),
    };
  }

  if (!row.contactPerson && !row.phone) return undefined;

  const contactCreates = buildContactCreates(row);
  if (!contactCreates) return undefined;

  return {
    create: contactCreates,
  };
}

function buildContactCreateMutation(row: ParsedCustomerRow): Prisma.ContactPersonCreateNestedManyWithoutCompanyInput | undefined {
  const contactCreates = buildContactCreates(row);
  if (!contactCreates) return undefined;

  return {
    create: contactCreates,
  };
}

function buildPhoneUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.PhoneNumberUpdateManyWithoutCompanyNestedInput {
  const primaryPhone = existing.phoneNumbers[0];
  const existingPhones = new Set(existing.phoneNumbers.map((phone) => normalizePhone(phone.number)).filter(Boolean));
  const extraCreates = uniquePhones(row.extraPhones)
    .filter((phone) => !existingPhones.has(phone))
    .map((phone, index) => ({
      label: `Phone ${index + 2}`,
      number: phone,
      whatsapp: false,
    } satisfies Prisma.PhoneNumberCreateWithoutCompanyInput));

  if (primaryPhone) {
    return {
      update: [
        {
          where: { id: primaryPhone.id },
          data: {
            label: primaryPhone.label || "Primary",
            number: row.phone,
            whatsapp: primaryPhone.whatsapp,
          },
        },
      ],
      ...(extraCreates.length ? { create: extraCreates } : {}),
    };
  }

  return {
    create: buildPhoneCreates(row),
  };
}

function buildPhoneCreates(row: ParsedCustomerRow): Prisma.PhoneNumberCreateWithoutCompanyInput[] {
  return uniquePhones([row.phone, ...row.extraPhones]).map((phone, index) => (
    {
      label: index === 0 ? "Primary" : `Phone ${index + 1}`,
      number: phone,
      whatsapp: false,
    }
  ));
}

function buildPhoneCreateMutation(row: ParsedCustomerRow): Prisma.PhoneNumberCreateNestedManyWithoutCompanyInput {
  return {
    create: buildPhoneCreates(row),
  };
}

function buildAddress(street?: string, city?: string) {
  return [street, city].filter(Boolean).join(", ") || undefined;
}

function buildNotes(note?: string, leadSource?: string) {
  return [
    note,
    leadSource ? `Lead Source: ${leadSource}` : undefined,
  ].filter(Boolean).join("\n") || undefined;
}

function buildSecondaryContact(rawRow: Record<string, unknown>): ParsedCustomerRow["secondaryContact"] {
  const name = getFirstText(rawRow, ["Contact Person 2 Name"]);
  if (!name) return undefined;

  return {
    name,
    designation: getFirstText(rawRow, ["Designation_1"]),
    email: getFirstText(rawRow, ["Email 1_1", "Email 2_2"]),
    phone: getFirstPhone(rawRow, ["Phone 1_1", "Phone 2_2"]),
  };
}

function importFormatFromFileName(fileName: string): CustomerImportFormat {
  return fileName.toLowerCase().endsWith(".csv") ? "CSV" : "EXCEL";
}

function parseWorkbookRows(buffer: Buffer, fileName: string) {
  const format = importFormatFromFileName(fileName);
  const workbook = format === "CSV"
    ? XLSX.read(buffer.toString("utf8"), { type: "string", cellDates: true })
    : XLSX.read(buffer, { type: "buffer", cellDates: true });
  const [firstSheetName] = workbook.SheetNames;

  if (!firstSheetName) {
    return { rows: [] as ParsedCustomerRow[], failed: [{ row: 1, reason: "Workbook is empty." }] as CustomerImportFailure[] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  const failed: CustomerImportFailure[] = [];
  const seenNames = new Set<string>();
  const rows: ParsedCustomerRow[] = [];

  jsonRows.forEach((rawRow, index) => {
    const rawData = normalizeRawRow(rawRow);
    const rowNumber = index + 2;
    const companyName = getFirstText(rawRow, ["Company Name", "Customer Name", "Customer/Company Name"]);
    const primaryPhone = getFirstPhone(rawRow, ["Phone", "Primary Phone", "Phone 1"]);

    if (!companyName) {
      failed.push({ row: rowNumber, reason: "Company Name is required." });
      return;
    }

    if (!primaryPhone) {
      failed.push({ row: rowNumber, reason: "Phone or Primary Phone is required." });
      return;
    }

    const key = normalizeCompanyKey(companyName);
    if (seenNames.has(key)) {
      failed.push({ row: rowNumber, reason: "Duplicate company name found in the uploaded file." });
      return;
    }

    seenNames.add(key);

    const streetAddress = getFirstText(rawRow, ["Address"]);
    const city = getFirstText(rawRow, ["City/Zilla", "City", "Zilla"]);
    const note = getFirstText(rawRow, ["Note", "Notes"]);
    const leadSource = getFirstText(rawRow, ["Lead Source"]);
    const allPhones = uniquePhones([
      primaryPhone,
      getFirstPhone(rawRow, ["Phone 2"]),
      getFirstPhone(rawRow, ["Phone 3"]),
      getFirstPhone(rawRow, ["Phone 2_1"]),
      getFirstPhone(rawRow, ["Phone 1_1"]),
      getFirstPhone(rawRow, ["Phone 2_2"]),
    ]);

    rows.push({
      row: rowNumber,
      companyName,
      rawData,
      contactPerson: getFirstText(rawRow, ["Contact Person", "Contact Person 1 Name"]),
      phone: primaryPhone,
      extraPhones: allPhones.filter((phone) => phone !== primaryPhone),
      industry: getFirstText(rawRow, ["Industry"]),
      address: buildAddress(streetAddress, city),
      website: getFirstText(rawRow, ["Website"]),
      notes: buildNotes(note, leadSource),
      primaryEmail: getFirstText(rawRow, ["Primary Email", "Email 1", "Email 2"]),
      designation: getFirstText(rawRow, ["Designation"]),
      secondaryContact: buildSecondaryContact(rawRow),
      assignedTo: getFirstText(rawRow, ["Assigned", "Assigned To"]),
      totalLeads: toLeadCount(getFirstCell(rawRow, ["Total Leads"])),
      lastCommunication: toDate(getFirstCell(rawRow, ["Last Communication", "Last Communication Date"])),
    });
  });

  return { rows, failed };
}

export async function importCustomersFromFile(buffer: Buffer, fileName: string, actor: CustomerTransferActor): Promise<CustomerImportResult> {
  const prisma = getPrisma();
  const format = importFormatFromFileName(fileName);
  const { rows, failed } = parseWorkbookRows(buffer, fileName);

  if (!rows.length) {
    await prisma.importExportLog.create({
      data: {
        type: "IMPORT",
        module: "CUSTOMERS",
        format,
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

  const assignedNames = Array.from(new Set(rows.map((row) => row.assignedTo).filter((value): value is string => Boolean(value)).map(normalizeCompanyKey)));
  const [assignedUsers, existingCompanies] = await Promise.all([
    assignedNames.length
      ? prisma.user.findMany({
          where: {
            status: "ACTIVE",
            role: "MARKETER",
            OR: assignedNames.map((name) => ({
              name: { equals: name, mode: "insensitive" },
            })),
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.customerCompany.findMany({
      where: {
        OR: rows.map((row) => ({
          name: { equals: row.companyName, mode: "insensitive" },
        })),
      },
      include: {
        assignedTo: true,
        contacts: { orderBy: { createdAt: "asc" } },
        phoneNumbers: { orderBy: { createdAt: "asc" } },
        leads: true,
        communications: { orderBy: { communicationAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const assignedUserByName = new Map(assignedUsers.map((user) => [normalizeCompanyKey(user.name), user]));
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
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  let inserted = 0;
  let updated = 0;
  const mergeRawData = (existing: Prisma.JsonValue | null | undefined, incoming: Record<string, unknown>) => {
    const base = normalizeRawJson(existing ?? {});
    return {
      ...base,
      ...incoming,
    };
  };

  for (const row of rows) {
    const rowKey = normalizeCompanyKey(row.companyName);
    if (duplicateExistingKeys.has(rowKey)) {
      failed.push({ row: row.row, reason: `Multiple existing companies match \"${row.companyName}\".` });
      continue;
    }

    const assignedUser = row.assignedTo ? assignedUserByName.get(normalizeCompanyKey(row.assignedTo)) : undefined;
    if (row.assignedTo && actor.role === "ADMIN" && !assignedUser) {
      failed.push({ row: row.row, reason: `Assigned user \"${row.assignedTo}\" was not found.` });
      continue;
    }

    const assignedToId = actor.role === "MARKETER" ? actor.id : assignedUser?.id ?? null;
    const existing = existingByName.get(rowKey);
    const assignedRelation = actor.role === "MARKETER"
      ? { assignedTo: { connect: { id: actor.id } } }
      : assignedToId
        ? { assignedTo: { connect: { id: assignedToId } } }
        : { assignedTo: { disconnect: true } };

    const mergedRawData = existing
      ? mergeRawData((existing as { rawData?: Prisma.JsonValue }).rawData, row.rawData)
      : row.rawData;

    const data = {
      name: row.companyName,
      contactPerson: row.contactPerson ?? null,
      phone: row.phone,
      industry: row.industry ?? "General",
      address: row.address ?? null,
      website: row.website ?? null,
      notes: row.notes ?? null,
      totalLeads: row.totalLeads,
      lastCommunication: row.lastCommunication ?? null,
      rawData: mergedRawData,
      ...assignedRelation,
    } as Prisma.CustomerCompanyUpdateInput & { rawData?: Prisma.JsonValue };

    if (existing) {
      updated += 1;
      operations.push(prisma.customerCompany.update({
        where: { id: existing.id },
        data: {
          ...data,
          contacts: buildContactUpdateMutation(row, existing),
          phoneNumbers: buildPhoneUpdateMutation(row, existing),
        },
      }));
      continue;
    }

    inserted += 1;
    operations.push(prisma.customerCompany.create({
      data: {
        name: row.companyName,
        contactPerson: row.contactPerson,
        phone: row.phone,
        industry: row.industry ?? "General",
        address: row.address,
        website: row.website,
        notes: row.notes,
        totalLeads: row.totalLeads,
        lastCommunication: row.lastCommunication,
        rawData: row.rawData,
        ...(assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : actor.role === "MARKETER" ? { assignedTo: { connect: { id: actor.id } } } : {}),
        contacts: buildContactCreateMutation(row),
        phoneNumbers: buildPhoneCreateMutation(row),
      } as Prisma.CustomerCompanyCreateInput & { rawData?: Prisma.JsonValue },
    }));
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }

  await prisma.importExportLog.create({
    data: {
      type: "IMPORT",
      module: "CUSTOMERS",
      format,
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

  const rows = companies.map(mapExportRow);
  const headerOrder = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headerOrder.add(key);
    }
  }
  const headers = Array.from(headerOrder);
  const normalizedRows = rows.map((row) => {
    const output: Record<string, unknown> = {};
    for (const header of headers) {
      output[header] = row[header] ?? "";
    }
    return output;
  });
  const worksheet = XLSX.utils.json_to_sheet(normalizedRows, { header: headers });
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
