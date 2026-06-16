import * as XLSX from "xlsx";
import { getPrisma } from "@/lib/prisma";
import { type Role } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export type FullExportActor = {
  id: string;
  role: Role;
};

export type FullExportFormat = "xlsx" | "csv";

type FullExportResult = {
  buffer: Buffer;
  fileName: string;
  rowCount: number;
  contentType: string;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toString();
}

function normalizeDate(value: Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function normalizeNumber(value: number | string | undefined) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return value;
}

function normalizeRawJson(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeDecimal(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof value.toNumber === "function") {
    return String((value as { toNumber: () => number }).toNumber());
  }
  return "";
}

function toCsvValue(raw: unknown) {
  const value = raw == null ? "" : typeof raw === "string" ? raw : String(raw);
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function mapCustomerRows(
  customers: Array<{
    name: string;
    contactPerson: string | null;
    phone: string;
    industry: string;
    address: string | null;
    website: string | null;
    notes: string | null;
    assignedTo: { name: string } | null;
    totalLeads: number;
    lastCommunication: Date | null;
    rawData?: unknown;
  }>,
) {
  return customers.map((customer) => {
    const raw = normalizeRawJson(customer.rawData);
    const normalized: Record<string, unknown> = {
      ...raw,
      "Company Name": raw["Company Name"] ?? raw["companyName"] ?? raw["customer"] ?? customer.name,
      "Contact Person": raw["Contact Person"] ?? raw["Contact Person 1 Name"] ?? raw["contactPerson"] ?? customer.contactPerson ?? "",
      "Primary Phone": raw["Primary Phone"] ?? raw["Phone"] ?? raw["phone"] ?? customer.phone,
      "Primary Email": raw["Primary Email"] ?? raw["Email"] ?? raw["email"] ?? raw["Email 1"] ?? "",
      Industry: raw["Industry"] ?? raw["industry"] ?? customer.industry,
      Address: raw["Address"] ?? raw["address"] ?? customer.address ?? "",
      Website: raw["Website"] ?? raw["website"] ?? customer.website ?? "",
      Assigned: raw["Assigned"] ?? raw["Assigned To"] ?? raw["assignedTo"] ?? (customer.assignedTo?.name ?? ""),
      "Total Leads": raw["Total Leads"] ?? raw["totalLeads"] ?? normalizeNumber(customer.totalLeads),
      "Last Communication": raw["Last Communication"] ?? raw["Last Communication Date"] ?? raw["lastCommunication"] ?? normalizeDate(customer.lastCommunication),
      Note: raw["Note"] ?? raw["Notes"] ?? customer.notes ?? "",
    };

    return normalized;
  });
}

function mapLeadRows(
  leads: Array<{
    title: string;
    phone: string;
    email: string | null;
    company: { name: string } | null;
    customerName: string;
    status: string;
    assignedTo: { name: string } | null;
  }>,
) {
  return leads.map((lead) => ({
    Name: lead.title,
    Phone: lead.phone,
    Email: normalizeText(lead.email),
    Company: normalizeText(lead.company?.name ?? lead.customerName),
    Status: normalizeText(lead.status),
    "Assigned To": lead.assignedTo?.name ?? "",
  }));
}

function mapProductRows(
  products: Array<{ name: string; category: string; price: unknown; stock?: number | null }>,
) {
  return products.map((product) => ({
    "Product Name": product.name,
    Category: normalizeText(product.category),
    Price: normalizeDecimal(product.price),
    Stock: product.stock == null ? "" : normalizeNumber(product.stock),
  }));
}

function mapFollowUpRows(
  followUps: Array<{
    id: string;
    note: string | null;
    nextDiscussionPlan: string | null;
    method: string;
    followUpDate: Date;
    company: { name: string } | null;
    lead: { title: string; customerName: string | null } | null;
    assignedTo: { name: string } | null;
  }>,
) {
  return followUps.map((followUp) => ({
    Title: normalizeText(followUp.note || followUp.nextDiscussionPlan || `${followUp.method} follow-up`),
    "Company / Customer": normalizeText((followUp.company?.name ?? "") || followUp.lead?.customerName),
    Lead: normalizeText(followUp.lead?.title),
    "Assigned To": followUp.assignedTo?.name ?? "",
    Method: followUp.method,
    Date: normalizeDate(followUp.followUpDate),
    Notes: normalizeText(followUp.note || followUp.nextDiscussionPlan),
  }));
}

function toCsvSection(title: string, rows: Array<Record<string, unknown>>, headers: string[]) {
  const lines: string[] = [];
  lines.push(`"${title}"`);
  lines.push(headers.map((header) => toCsvValue(header)).join(","));
  for (const row of rows) {
        lines.push(headers.map((header) => toCsvValue(row[header])).join(","));
  }
  lines.push("");
  return lines.join("\n");
}

export async function exportAllCrmData(
  _actor: FullExportActor,
  format: FullExportFormat,
): Promise<FullExportResult> {
  const prisma = getPrisma();

  const today = new Date();
  const fileDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const fileName = format === "csv" ? `crm_full_export_${fileDate}.csv` : `crm_full_export_${fileDate}.xlsx`;

  const [rawCustomers, rawLeads, rawProducts, rawFollowUps] = await Promise.all([
    prisma.customerCompany.findMany({
      orderBy: { name: "asc" },
      include: {
        assignedTo: { select: { name: true } },
        contacts: true,
        phoneNumbers: true,
        leads: true,
        communications: { orderBy: { communicationAt: "desc" }, take: 1 },
      },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.productService.findMany({ orderBy: { name: "asc" } }),
    prisma.followUp.findMany({
      orderBy: { followUpDate: "desc" },
      include: {
        company: { select: { name: true } },
        lead: { select: { id: true, title: true, customerName: true } },
        assignedTo: { select: { name: true } },
      },
    }),
  ]);

  const customers = rawCustomers as Array<{
    name: string;
    contactPerson: string | null;
    phone: string;
    industry: string;
    address: string | null;
    website: string | null;
    notes: string | null;
    assignedTo: { name: string } | null;
    totalLeads: number;
    lastCommunication: Date | null;
    rawData?: unknown;
  }>;

  const customerRows = mapCustomerRows(customers);
  const leadRows = mapLeadRows(rawLeads);
  const productRows = mapProductRows(rawProducts);
  const followUpRows = mapFollowUpRows(rawFollowUps);
  const totalRows = customerRows.length + leadRows.length + productRows.length + followUpRows.length;

  if (format === "csv") {
    const requiredCustomerHeaders = [
      "Company Name",
      "Contact Person",
      "Primary Phone",
      "Primary Email",
      "Industry",
      "Address",
      "Website",
      "Assigned",
      "Total Leads",
      "Last Communication",
      "Note",
    ];
    const allCustomerHeaders = new Set<string>(requiredCustomerHeaders);
    for (const row of customerRows) {
      for (const key of Object.keys(row)) {
        allCustomerHeaders.add(key);
      }
    }

    const customerHeaders = requiredCustomerHeaders.filter((header) => allCustomerHeaders.has(header))
      .concat(Array.from(allCustomerHeaders).filter((header) => !requiredCustomerHeaders.includes(header)).sort());
    const leadHeaders = ["Name", "Phone", "Email", "Company", "Status", "Assigned To"];
    const productHeaders = ["Product Name", "Category", "Price", "Stock"];
    const followUpHeaders = ["Title", "Company / Customer", "Lead", "Assigned To", "Method", "Date", "Notes"];

    const csv = [
      toCsvSection("Customers", customerRows, customerHeaders),
      toCsvSection("Leads", leadRows, leadHeaders),
      toCsvSection("Products", productRows, productHeaders),
      toCsvSection("Follow-ups", followUpRows, followUpHeaders),
    ].join("\n");

    await prisma.importExportLog.create({
      data: {
        type: "EXPORT",
        module: "IMPORT_EXPORT",
        format: "CSV",
        requestedById: _actor.id,
        fileName,
        status: "COMPLETED",
        processedRows: totalRows,
        failedRows: 0,
        completedAt: new Date(),
      },
    });

    return {
      buffer: Buffer.from(`\uFEFF${csv}`),
      fileName,
      rowCount: totalRows,
      contentType: "text/csv; charset=utf-8",
    };
  }

  const allCustomerHeaders = new Set<string>([
    "Company Name",
    "Contact Person",
    "Primary Phone",
    "Primary Email",
    "Industry",
    "Address",
    "Website",
    "Assigned",
    "Total Leads",
    "Last Communication",
    "Note",
  ]);

  const workbook = XLSX.utils.book_new();
  for (const row of customerRows) {
    for (const key of Object.keys(row)) {
      allCustomerHeaders.add(key);
    }
  }
  const customerHeaderList = Array.from(allCustomerHeaders)
    .filter((header) => header.length > 0)
    .sort();
  const customerSheet = XLSX.utils.json_to_sheet(customerRows, { header: customerHeaderList });
  XLSX.utils.book_append_sheet(workbook, customerSheet, "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(leadRows), "Leads");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productRows), "Products");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(followUpRows), "Follow-ups");

  await prisma.importExportLog.create({
    data: {
      type: "EXPORT",
      module: "IMPORT_EXPORT",
      format: "EXCEL",
      requestedById: _actor.id,
      fileName,
      status: "COMPLETED",
      processedRows: totalRows,
      failedRows: 0,
      completedAt: new Date(),
    },
  });

  const output = Buffer.from(
    XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }),
  );

  return {
    buffer: output,
    fileName,
    rowCount: totalRows,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
