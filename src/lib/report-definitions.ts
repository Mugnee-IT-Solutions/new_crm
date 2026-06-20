export const REPORT_DEFINITIONS = [
  {
    type: "CUSTOMER_COMMUNICATION",
    slug: "customer-communication-report",
    title: "Customer Communication Report",
    description: "Call, email, meeting, and WhatsApp history with customers and leads.",
  },
  {
    type: "FOLLOW_UP",
    slug: "follow-up-report",
    title: "Follow-up Report",
    description: "Due, overdue, upcoming, and completed follow-up records.",
  },
  {
    type: "TASK",
    slug: "task-report",
    title: "Task Report",
    description: "Assigned work, carry-forward tasks, completion status, and ownership.",
  },
  {
    type: "EMPLOYEE_PERFORMANCE",
    slug: "employee-performance-report",
    title: "Employee Performance Report",
    description: "Lead, communication, follow-up, task, sales, and conversion performance.",
  },
  {
    type: "LEAD_CONVERSION",
    slug: "lead-conversion-report",
    title: "Lead Conversion Report",
    description: "Lead pipeline movement, score, probability, and conversion readiness.",
  },
  {
    type: "SALES",
    slug: "sales-report",
    title: "Sales Report",
    description: "Quotation totals, converted sales, value tracking, and ownership.",
  },
  {
    type: "QUOTATION",
    slug: "quotation-report",
    title: "Quotation Report",
    description: "Quotation status, items, validity, totals, and customer mapping.",
  },
  {
    type: "PRODUCT_INTEREST",
    slug: "product-interest-report",
    title: "Product Interest Report",
    description: "Product demand, engagement, lead interest, and customer coverage.",
  },
  {
    type: "CUSTOMER_GROWTH",
    slug: "customer-growth-report",
    title: "Customer Growth Report",
    description: "New customer growth with assigned ownership and engagement context.",
  },
  {
    type: "REWARD",
    slug: "reward-report",
    title: "Reward Report",
    description: "Reward points, rule-driven incentives, and manual reward entries.",
  },
  {
    type: "DAILY_WORK_SUMMARY",
    slug: "daily-work-summary-report",
    title: "Daily Work Summary Report",
    description: "Daily task, follow-up, communication, and lead activity summary.",
  },
  {
    type: "ACTIVITY_LOG",
    slug: "activity-log-report",
    title: "Activity Log Report",
    description: "Operational audit log for work performed within the allowed CRM scope.",
  },
] as const;

export type ReportTypeKey = (typeof REPORT_DEFINITIONS)[number]["type"];

export type ReportFormat = "pdf" | "xlsx" | "csv" | "print";

export const DATE_PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
] as const;

export type ReportDatePreset = (typeof DATE_PRESET_OPTIONS)[number]["value"];

export function getReportDefinition(reportType: string) {
  return REPORT_DEFINITIONS.find((item) => item.type === reportType);
}
