import { Prisma } from "@prisma/client";
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
  industry?: string;
  assignedTo?: string;
  totalLeads: number;
  lastCommunication?: Date;
};

type ExistingCustomerRecord = Prisma.CustomerCompanyGetPayload<{
  include: {
    assignedTo: true;
    contacts: { where: { isPrimary: true }; take: 1 };
    phoneNumbers: { orderBy: { createdAt: "asc" }; take: 1 };
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

function companyScopeWhere(actor: CustomerTransferActor): Prisma.CustomerCompanyWhereInput {
  if (actor.role === "ADMIN") return {};

  return {
    OR: [
      { assignedToId: actor.id },
      { leads: { some: { OR: [{ assignedToId: actor.id }, { createdById: actor.id }] } } },
      { followUps: { some: { assignedToId: actor.id } } },
      { communications: { some: { userId: actor.id } } },
    ],
  };
}

function exportDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function mapExportRow(company: ExistingCustomerRecord) {
  const primaryContact = company.contacts[0];
  const primaryPhone = company.phoneNumbers[0];

  return {
    "Company Name": company.name,
    "Contact Person": company.contactPerson ?? primaryContact?.name ?? "",
    Phone: company.phone || primaryPhone?.number || primaryContact?.mobile || "",
    Industry: company.industry ?? "",
    Assigned: company.assignedTo?.name ?? "",
    "Total Leads": Math.max(company.totalLeads, company.leads.length),
    "Last Communication": exportDate(company.lastCommunication ?? company.communications[0]?.communicationAt),
  };
}

function buildContactUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.ContactPersonUpdateManyWithoutCompanyNestedInput | undefined {
  const primaryContact = existing.contacts[0];

  if (primaryContact) {
    return {
      update: [
        {
          where: { id: primaryContact.id },
          data: {
            name: row.contactPerson ?? primaryContact.name,
            mobile: row.phone,
            isPrimary: true,
          },
        },
      ],
    };
  }

  if (!row.contactPerson && !row.phone) return undefined;

  return {
    create: [
      {
        name: row.contactPerson ?? row.companyName,
        mobile: row.phone,
        isPrimary: true,
      },
    ],
  };
}

function buildContactCreateMutation(row: ParsedCustomerRow): Prisma.ContactPersonCreateNestedManyWithoutCompanyInput | undefined {
  if (!row.contactPerson && !row.phone) return undefined;

  return {
    create: [
      {
        name: row.contactPerson ?? row.companyName,
        mobile: row.phone,
        isPrimary: true,
      },
    ],
  };
}

function buildPhoneUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.PhoneNumberUpdateManyWithoutCompanyNestedInput {
  const primaryPhone = existing.phoneNumbers[0];

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
    };
  }

  return {
    create: [
      {
        label: "Primary",
        number: row.phone,
        whatsapp: false,
      },
    ],
  };
}

function buildPhoneCreateMutation(row: ParsedCustomerRow): Prisma.PhoneNumberCreateNestedManyWithoutCompanyInput {
  return {
    create: [
      {
        label: "Primary",
        number: row.phone,
        whatsapp: false,
      },
    ],
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
    const rowNumber = index + 2;
    const companyName = normalizeText(getCell(rawRow, "Company Name"));
    const phone = normalizePhone(getCell(rawRow, "Phone"));

    if (!companyName) {
      failed.push({ row: rowNumber, reason: "Company Name is required." });
      return;
    }

    if (!phone) {
      failed.push({ row: rowNumber, reason: "Phone is required." });
      return;
    }

    const key = normalizeCompanyKey(companyName);
    if (seenNames.has(key)) {
      failed.push({ row: rowNumber, reason: "Duplicate company name found in the uploaded file." });
      return;
    }

    seenNames.add(key);

    rows.push({
      row: rowNumber,
      companyName,
      contactPerson: normalizeText(getCell(rawRow, "Contact Person")),
      phone,
      industry: normalizeText(getCell(rawRow, "Industry")),
      assignedTo: normalizeText(getCell(rawRow, "Assigned")),
      totalLeads: toLeadCount(getCell(rawRow, "Total Leads")),
      lastCommunication: toDate(getCell(rawRow, "Last Communication")),
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
        contacts: { where: { isPrimary: true }, take: 1 },
        phoneNumbers: { orderBy: { createdAt: "asc" }, take: 1 },
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

    const data: Prisma.CustomerCompanyUpdateInput = {
      name: row.companyName,
      contactPerson: row.contactPerson ?? null,
      phone: row.phone,
      industry: row.industry ?? "General",
      totalLeads: row.totalLeads,
      lastCommunication: row.lastCommunication ?? null,
      ...assignedRelation,
    };

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
          totalLeads: row.totalLeads,
          lastCommunication: row.lastCommunication,
          ...(assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : actor.role === "MARKETER" ? { assignedTo: { connect: { id: actor.id } } } : {}),
          contacts: buildContactCreateMutation(row),
          phoneNumbers: buildPhoneCreateMutation(row),
        },
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
    where: companyScopeWhere(actor),
    include: {
      assignedTo: true,
      contacts: { where: { isPrimary: true }, take: 1 },
      phoneNumbers: { orderBy: { createdAt: "asc" }, take: 1 },
      leads: true,
      communications: { orderBy: { communicationAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const rows = companies.map(mapExportRow);
  const worksheet = XLSX.utils.json_to_sheet(rows);
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
