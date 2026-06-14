"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  Check,
  Download,
  Edit,
  Eye,
  FileDown,
  FileText,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Printer,
  Send,
  Settings,
  Target,
  Upload,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { LeadStatusDonut, ProductBarChart, SalesLineChart } from "@/components/charts/crm-charts";
import { ChartCard } from "@/components/shared/chart-card";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { DataTable } from "@/components/shared/data-table";
import { DetailsDrawer } from "@/components/shared/details-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { FormModal } from "@/components/shared/form-modal";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  createCommunicationAction,
  createCustomerAction,
  createFollowUpAction,
  createImportExportLogAction,
  createLeadAction,
  createReportLogAction,
  createRewardRuleAction,
  createTaskAction,
  createTodayPlanAction,
  createUserAction,
  giveManualRewardAction,
  markNotificationReadAction,
  completeTaskFromTodayAction,
  saveSettingsAction,
  updateFollowUpStatusAction,
  updateTaskStatusAction,
} from "@/lib/crm-actions";
import type {
  CompanyRow,
  CrmWorkspace,
  FollowUpPageData,
  FollowUpRow,
  LeadRow,
  ProductEngagementData,
  ProductRow,
  QuotationRow,
  TaskRow,
  TodayPlanRow,
} from "@/lib/crm-data";
import { cn, formatCurrency, rolePath, type Role } from "@/lib/utils";

type ServerAction = (formData: FormData) => Promise<{ ok?: boolean; message?: string } | unknown>;
type TodayWorkItem = CrmWorkspace["todayWorkItems"][number];

type FollowUpFromTaskDraft = {
  taskId: string;
  companyId?: string;
  leadId?: string;
  assignedToId?: string;
  title: string;
  relatedTo: string;
};

function ratingBand(value: number) {
  if (value <= 3) return "Cold Lead";
  if (value <= 6) return "Warm Lead";
  if (value <= 8) return "Hot Lead";
  return "Very High Intent";
}

function formatDateTimeForInput(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function pageActions(items: { label: string; icon: typeof Plus; variant?: "default" | "outline"; onClick?: () => void; href?: string }[]) {
  return items.map(({ label, icon: Icon, variant = "outline", onClick, href }) => {
    const className = cn(
      "inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
      variant === "default" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
    );

    return href ? (
      <Link key={label} href={href} className={className}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    ) : (
      <Button key={label} type="button" size="sm" variant={variant} onClick={onClick}>
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    );
  });
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">{children}</div>;
}

function SelectBox({ label, name, children, defaultValue }: { label: string; name?: string; children: React.ReactNode; defaultValue?: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <select name={name} defaultValue={defaultValue} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
        {children}
      </select>
    </label>
  );
}

function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <Input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} />
    </label>
  );
}

function TextAreaField({ label, name, placeholder, required = false }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function ActionForm({
  action,
  children,
  onDone,
  submitLabel = "Save",
}: {
  action: ServerAction;
  children: React.ReactNode;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (typeof result === "object" && result && "ok" in result && result.ok === false) {
              setMessage("message" in result && typeof result.message === "string" ? result.message : "Action failed.");
              return;
            }
            form.reset();
            setMessage("");
            onDone?.();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed.");
          }
        });
      }}
    >
      {children}
      {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}

function RowActions({ detailHref }: { detailHref?: string }) {
  return (
    <div className="flex items-center gap-1">
      {detailHref ? (
        <Link href={detailHref} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="View">
          <Eye className="h-4 w-4" />
        </Link>
      ) : null}
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit">
        <Edit className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="More">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EntityLink({ href, children, className, stopPropagation = false }: { href?: string | null; children: React.ReactNode; className?: string; stopPropagation?: boolean }) {
  if (!href || children === "-") return <span className={className}>{children}</span>;

  return (
    <Link
      href={href}
      className={cn("text-blue-700 underline-offset-2 transition hover:underline", className)}
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
    >
      {children}
    </Link>
  );
}

function EntityOptions({ workspace, type }: { workspace: CrmWorkspace; type: "users" | "companies" | "leads" | "products" }) {
  const rows =
    type === "users" ? workspace.employees.map((item) => [item.id, item.name])
      : type === "companies" ? workspace.companies.map((item) => [item.id, item.name])
        : type === "leads" ? workspace.leads.map((item) => [item.id, item.title])
          : workspace.products.map((item) => [item.id, item.name]);

  return (
    <>
      <option value="">Select</option>
      {rows.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </>
  );
}

function InfoLine({ label, value, progress }: { label: string; value: React.ReactNode; progress?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-3 h-2 rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Timeline({ rows }: { rows: CrmWorkspace["activities"] }) {
  return (
    <div className="space-y-4">
      {rows.length ? rows.map((item, index) => (
        <div key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700">{index + 1}</span>
            {index < rows.length - 1 ? <span className="h-10 w-px bg-slate-200" /> : null}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              <EntityLink href={item.href} className="font-bold">{item.title}</EntityLink>
            </p>
            <p className="text-xs text-slate-500">{item.detail} - {item.time}</p>
          </div>
        </div>
      )) : <EmptyState title="No timeline yet" description="Customer communication and CRM activities will appear here." />}
    </div>
  );
}

function LeadForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  return (
    <ActionForm action={createLeadAction} onDone={onDone} submitLabel="Save Lead">
      <TextField label="Lead Title" name="title" />
      <TextField label="Customer Name" name="customerName" />
      <TextField label="Phone" name="phone" />
      <TextField label="Email" name="email" type="email" />
      <SelectBox label="Company" name="companyId"><EntityOptions workspace={workspace} type="companies" /></SelectBox>
      <SelectBox label="Interested Product" name="productId"><EntityOptions workspace={workspace} type="products" /></SelectBox>
      <SelectBox label="Assigned Marketer" name="assignedToId"><EntityOptions workspace={workspace} type="users" /></SelectBox>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectBox label="Priority" name="priority"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></SelectBox>
        <TextField label="Lead Score" name="score" type="number" defaultValue={10} />
        <TextField label="Probability %" name="purchaseProbability" type="number" defaultValue={10} />
      </div>
      <TextField label="Follow-up Date" name="followUpDate" type="datetime-local" />
      <TextAreaField label="Notes" name="notes" />
    </ActionForm>
  );
}

function TaskForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  return (
    <ActionForm action={createTaskAction} onDone={onDone} submitLabel="Save Task">
      <TextField label="Task Title" name="title" />
      <TextAreaField label="Task Description" name="description" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectBox label="Assign To" name="assignedToId"><EntityOptions workspace={workspace} type="users" /></SelectBox>
        <SelectBox label="Related Company" name="companyId"><EntityOptions workspace={workspace} type="companies" /></SelectBox>
        <SelectBox label="Related Lead" name="leadId"><EntityOptions workspace={workspace} type="leads" /></SelectBox>
        <SelectBox label="Related Product" name="productId"><EntityOptions workspace={workspace} type="products" /></SelectBox>
        <TextField label="Due Date" name="dueDate" type="date" />
        <TextField label="Time" name="taskTime" type="datetime-local" />
        <SelectBox label="Priority" name="priority"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></SelectBox>
        <SelectBox label="Status" name="status"><option value="TODO">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></SelectBox>
      </div>
      <TextField label="Reminder" name="reminder" placeholder="1 hour before" />
      <TextAreaField label="Notes" name="notes" />
    </ActionForm>
  );
}

function CommunicationForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  return (
    <ActionForm action={createCommunicationAction} onDone={onDone} submitLabel="Save Communication">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectBox label="Customer / Company" name="companyId"><EntityOptions workspace={workspace} type="companies" /></SelectBox>
        <SelectBox label="Lead" name="leadId"><EntityOptions workspace={workspace} type="leads" /></SelectBox>
        <SelectBox label="Communication Type" name="method"><option>Phone Call</option><option>WhatsApp</option><option>Email</option><option>Physical Visit</option><option>Meeting</option></SelectBox>
        <TextField label="Date & Time" name="communicationAt" type="datetime-local" />
      </div>
      <TextAreaField label="Notes / Discussion" name="note" />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Outcome" name="outcome" />
        <TextField label="Rating / Lead Score" name="rating" type="number" />
        <TextField label="Next Follow-up Date" name="nextFollowUpDate" type="datetime-local" />
      </div>
      <TextAreaField label="Next Follow-up Note" name="followUpNote" />
    </ActionForm>
  );
}

function FollowUpForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  return (
    <ActionForm action={createFollowUpAction} onDone={onDone} submitLabel="Save Follow-up">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectBox label="Customer / Company" name="companyId"><EntityOptions workspace={workspace} type="companies" /></SelectBox>
        <SelectBox label="Lead" name="leadId"><EntityOptions workspace={workspace} type="leads" /></SelectBox>
        <SelectBox label="Assigned To" name="assignedToId"><EntityOptions workspace={workspace} type="users" /></SelectBox>
        <SelectBox label="Method" name="method"><option>Phone Call</option><option>WhatsApp</option><option>Email</option><option>Physical Visit</option><option>Meeting</option></SelectBox>
      </div>
      <TextField label="Follow-up Date" name="followUpDate" type="datetime-local" />
      <TextAreaField label="Follow-up Note" name="note" />
      <TextAreaField label="Next Discussion Plan" name="nextDiscussionPlan" />
    </ActionForm>
  );
}

function CustomerForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  return (
    <ActionForm action={createCustomerAction} onDone={onDone} submitLabel="Save Customer">
      <TextField label="Company Name" name="name" />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Contact Person" name="contactPerson" />
        <TextField label="Designation" name="designation" />
        <TextField label="Email" name="email" type="email" />
        <TextField label="Phone" name="phone" />
        <TextField label="WhatsApp" name="whatsapp" />
        <TextField label="Industry" name="industry" />
      </div>
      <SelectBox label="Assigned Marketer" name="assignedToId"><EntityOptions workspace={workspace} type="users" /></SelectBox>
      <TextField label="Website" name="website" />
      <TextAreaField label="Address" name="address" />
      <TextAreaField label="Notes" name="notes" />
    </ActionForm>
  );
}

export function LeadsPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const [open, setOpen] = React.useState(false);
  const columns = React.useMemo<ColumnDef<LeadRow>[]>(
    () => [
      { accessorKey: "title", header: "Lead Name", cell: ({ row }) => <EntityLink href={`/leads/${row.original.id}`} className="font-bold">{row.original.title}</EntityLink> },
      { accessorKey: "company", header: "Company", cell: ({ row }) => <EntityLink href={row.original.companyId ? `/customers/${row.original.companyId}` : undefined} className="font-semibold">{row.original.company}</EntityLink> },
      { accessorKey: "phone", header: "Phone" },
      { accessorKey: "productInterest", header: "Product Interest" },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { accessorKey: "score", header: "Lead Score" },
      { accessorKey: "assignedTo", header: "Assigned To" },
      { accessorKey: "followUpDate", header: "Follow-up Date" },
      { id: "Action", header: "Action", cell: ({ row }) => <RowActions detailHref={`/leads/${row.original.id}`} /> },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Leads"
        description="Manage opportunities with score, priority, ownership, communication count, and follow-up tracking."
        actions={pageActions([
          { label: "Add Lead", icon: Plus, variant: "default", onClick: () => setOpen(true) },
          { label: "Import CSV", icon: Upload, href: rolePath(role, "import-export") },
          { label: "Export", icon: Download, href: rolePath(role, "reports") },
        ])}
      />
      <FilterBar>
        <SelectBox label="Status"><option>All Status</option><option>Interested</option><option>Negotiation</option></SelectBox>
        <SelectBox label="Priority"><option>All</option><option>High</option><option>Medium</option></SelectBox>
        <SelectBox label="Assigned To"><option>All</option>{workspace.employees.map((item) => <option key={item.id}>{item.name}</option>)}</SelectBox>
        <SelectBox label="Date Range"><option>Current Month</option></SelectBox>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-500">Search</span>
          <Input placeholder="Search lead..." />
        </label>
      </FilterBar>
      <DataTable data={workspace.leads} columns={columns} searchPlaceholder="Search leads..." />
      <FormModal open={open} title="Create Lead" onClose={() => setOpen(false)}>
        <LeadForm workspace={workspace} onDone={() => setOpen(false)} />
      </FormModal>
    </>
  );
}

export function LeadDetailsPage({ role, workspace, lead }: { role: Role; workspace: CrmWorkspace; lead?: LeadRow }) {
  const activeLead = lead;
  const companySummary = activeLead?.companyId ? workspace.companies.find((item) => item.id === activeLead.companyId) : undefined;
  const [communicationOpen, setCommunicationOpen] = React.useState(false);
  const [followUpOpen, setFollowUpOpen] = React.useState(false);

  if (!activeLead) return <EmptyState title="Lead not found" description="The requested lead is not available in your CRM scope." />;

  return (
    <>
      <Link href={rolePath(role, "leads")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-black text-blue-700">
              {activeLead.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-950">
                  <EntityLink href={activeLead.companyId ? `/customers/${activeLead.companyId}` : undefined} className="font-black">{activeLead.company}</EntityLink>
                </h1>
                <StatusBadge value={activeLead.status} />
              </div>
              <p className="mt-1 text-sm font-bold text-slate-700">
                Lead: <EntityLink href={`/leads/${activeLead.id}`} className="font-bold">{activeLead.title}</EntityLink>
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                <span>Lead Score: <b className="text-slate-800">{activeLead.score}</b></span>
                <span>Priority: <b className="text-slate-800">{activeLead.priority}</b></span>
                <span>Assigned: <b className="text-slate-800">{activeLead.assignedTo}</b></span>
                <span>Follow-up: <b className="text-slate-800">{activeLead.followUpDate}</b></span>
              </div>
            </div>
          </div>
          <Button type="button">Edit Lead</Button>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <Card className="p-5">
          <Tabs
            defaultValue="overview"
            tabs={[
              { label: "Overview", value: "overview" },
              { label: "Timeline", value: "timeline" },
              { label: "Communication", value: "communication" },
              { label: "Follow-ups", value: "followups" },
              { label: "Quotation", value: "quotation" },
              { label: "Products", value: "products" },
            ]}
          >
            {(value) => (
              value === "overview" ? (
                <div className="grid gap-4">
                  {companySummary ? (
                    <DashboardCard title="Connected Company">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoLine label="Company" value={<EntityLink href={`/customers/${companySummary.id}`} className="font-bold">{companySummary.name}</EntityLink>} />
                        <InfoLine label="Contact Person" value={companySummary.contactPerson} />
                        <InfoLine label="Phone" value={companySummary.phone} />
                        <InfoLine label="Industry" value={companySummary.industry} />
                      </div>
                    </DashboardCard>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoLine label="Interested Product" value={activeLead.productInterest} />
                    <InfoLine label="Purchase Probability" value={`${activeLead.purchaseProbability}%`} progress={activeLead.purchaseProbability} />
                    <InfoLine label="Communication Count" value={activeLead.communicationCount} />
                    <InfoLine label="Follow-up Count" value={activeLead.followUpCount} />
                  </div>
                  <ChartCard title="Lead Status Movement">
                    <SalesLineChart data={workspace.quotations.slice(0, 6).map((item) => ({ month: item.date, sales: item.amount }))} />
                  </ChartCard>
                </div>
              ) : <Timeline rows={workspace.activities} />
            )}
          </Tabs>
        </Card>
        <DashboardCard title="Quick Actions">
          <div className="grid gap-2">
            <Button type="button" onClick={() => setFollowUpOpen(true)}>Add Follow-up</Button>
            <Button variant="outline" type="button" onClick={() => setCommunicationOpen(true)}>Log Communication</Button>
            <Link className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-blue-50" href={rolePath(role, "quotations")}>Create Quotation</Link>
            <Button variant="outline" type="button">Change Status</Button>
          </div>
        </DashboardCard>
      </div>
      <FormModal open={communicationOpen} title="Add Communication / Activity Log" onClose={() => setCommunicationOpen(false)}>
        <CommunicationForm workspace={workspace} onDone={() => setCommunicationOpen(false)} />
      </FormModal>
      <FormModal open={followUpOpen} title="Add Follow-up" onClose={() => setFollowUpOpen(false)}>
        <FollowUpForm workspace={workspace} onDone={() => setFollowUpOpen(false)} />
      </FormModal>
    </>
  );
}

export function CustomersPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const [open, setOpen] = React.useState(false);
  const columns = React.useMemo<ColumnDef<CompanyRow>[]>(
    () => [
      { accessorKey: "name", header: "Company Name", cell: ({ row }) => <EntityLink href={`/customers/${row.original.id}`} className="font-bold">{row.original.name}</EntityLink> },
      { accessorKey: "contactPerson", header: "Contact Person" },
      { accessorKey: "phone", header: "Phone" },
      { accessorKey: "industry", header: "Industry" },
      { accessorKey: "assignedTo", header: "Assigned" },
      { accessorKey: "totalLeads", header: "Total Leads" },
      { accessorKey: "lastCommunication", header: "Last Communication" },
      { id: "Action", header: "Action", cell: ({ row }) => <RowActions detailHref={`/customers/${row.original.id}`} /> },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Customer / Companies"
        description="Central customer records, contacts, industries, assignment, and communication history."
        actions={pageActions([
          { label: "Add Customer", icon: Plus, variant: "default", onClick: () => setOpen(true) },
          { label: "Import CSV", icon: Upload, href: rolePath(role, "import-export") },
          { label: "Export", icon: Download, href: rolePath(role, "reports") },
        ])}
      />
      <DataTable data={workspace.companies} columns={columns} searchPlaceholder="Search customer..." />
      <FormModal open={open} title="Create Customer / Company" onClose={() => setOpen(false)}>
        <CustomerForm workspace={workspace} onDone={() => setOpen(false)} />
      </FormModal>
    </>
  );
}

export function CustomerProfilePage({ role, workspace, customer }: { role: Role; workspace: CrmWorkspace; customer?: CompanyRow }) {
  const active = customer;
  const [communicationOpen, setCommunicationOpen] = React.useState(false);
  const [followUpOpen, setFollowUpOpen] = React.useState(false);

  if (!active) return <EmptyState title="Customer not found" description="The requested customer is not available in your CRM scope." />;

  return (
    <>
      <Link href={rolePath(role, "customers")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-950">{active.name}</h1>
              <StatusBadge value={active.status} />
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
              <InfoLine label="Contact Person" value={active.contactPerson} />
              <InfoLine label="Email" value={active.email} />
              <InfoLine label="Phone" value={`${active.phone}, ${active.whatsapp}`} />
              <InfoLine label="Website" value={active.website} />
              <InfoLine label="Industry" value={active.industry} />
              <InfoLine label="Address" value={active.address} />
              <InfoLine label="Assigned Marketer" value={active.assignedTo} />
              <InfoLine label="Notes" value={active.notes} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["Call", Phone],
              ["WhatsApp", MessageSquare],
              ["Email", Mail],
              ["Create Quotation", FileText],
              ["Schedule Meeting", CalendarClock],
            ] as const).map(([label, Icon]) => (
              <Button key={label} variant="outline" size="sm" type="button" onClick={label === "Schedule Meeting" ? () => setFollowUpOpen(true) : label === "Call" ? () => setCommunicationOpen(true) : undefined}>
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Leads" value={String(active.totalLeads)} helper="Customer profile" icon={Target} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Communication" value={String(workspace.activities.length)} helper="Timeline activity" icon={MessageSquare} tone="bg-indigo-100 text-indigo-700" />
        <StatCard title="Quotations" value={String(workspace.quotations.filter((item) => item.customer === active.name).length)} helper="Customer quotes" icon={FileText} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Current Progress" value="Active" helper="Sales progress" icon={Check} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Card className="p-5">
        <Tabs
          defaultValue="overview"
          tabs={[
            { label: "Overview", value: "overview" },
            { label: "Timeline", value: "timeline" },
            { label: "Communication History", value: "communication" },
            { label: "Notes", value: "notes" },
            { label: "Follow-up Records", value: "followups" },
            { label: "Meeting Details", value: "meetings" },
            { label: "Quotation History", value: "quotations" },
            { label: "Interested Products", value: "products" },
            { label: "Documents", value: "documents" },
            { label: "Sales Progress", value: "progress" },
          ]}
        >
          {(value) => (value === "overview" ? <LeadStatusDonut total={active.totalLeads} data={workspace.pipeline.map((item, index) => ({ name: item.label, value: item.value, color: ["#2563EB", "#06B6D4", "#16A34A", "#F59E0B", "#4F46E5"][index % 5] }))} /> : <Timeline rows={workspace.activities} />)}
        </Tabs>
      </Card>
      <FormModal open={communicationOpen} title="Add Communication / Activity Log" onClose={() => setCommunicationOpen(false)}>
        <CommunicationForm workspace={workspace} onDone={() => setCommunicationOpen(false)} />
      </FormModal>
      <FormModal open={followUpOpen} title="Add Follow-up" onClose={() => setFollowUpOpen(false)}>
        <FollowUpForm workspace={workspace} onDone={() => setFollowUpOpen(false)} />
      </FormModal>
    </>
  );
}

function WorkSourceBadge({ item }: { item: TodayWorkItem }) {
  const variant = item.source === "Follow-up" ? "warning" : item.source === "Task" ? "default" : "neutral";
  return <Badge variant={variant}>{item.source}</Badge>;
}

function TodayWorkAction({
  item,
  onTaskComplete,
  completingTaskId,
}: {
  item: TodayWorkItem;
  onTaskComplete?: (item: TodayWorkItem) => void;
  completingTaskId?: string | null;
}) {
  if (item.source === "Follow-up") {
    return (
      <form action={updateFollowUpStatusAction}>
        <input type="hidden" name="id" value={item.sourceId} />
        <input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Complete
        </Button>
      </form>
    );
  }

  if (item.source === "Task") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => onTaskComplete?.(item)}
        disabled={completingTaskId === item.sourceId}
      >
        <Check className="h-3.5 w-3.5" />
        {completingTaskId === item.sourceId ? "Saving..." : "Complete"}
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
      <Edit className="h-3.5 w-3.5" />
      Plan
    </Button>
  );
}

function TaskCompletionFollowUpModal({
  draft,
  onClose,
  onDone,
}: {
  draft: FollowUpFromTaskDraft | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [followUpDate, setFollowUpDate] = React.useState(formatDateTimeForInput());
  const [note, setNote] = React.useState("");
  const [nextAction, setNextAction] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [rating, setRating] = React.useState(0);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (draft) {
      setFollowUpDate(formatDateTimeForInput());
      setNote("");
      setNextAction("");
      setPriority("MEDIUM");
      setRating(0);
      setMessage("");
    }
  }, [draft]);

  if (!draft) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setMessage("");

    try {
      const result = await createFollowUpAction(formData);
      if (typeof result === "object" && result && "ok" in result && result.ok === false) {
        setMessage(typeof result.message === "string" ? result.message : "Failed to save follow-up.");
        return;
      }

      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save follow-up.");
    } finally {
      setPending(false);
    }
  };

  return (
    <FormModal open title="Follow-up from completed task" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-slate-600">Customer / Lead reference:</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{draft.title}</p>
          {draft.relatedTo !== "-" ? <p className="text-xs text-slate-500">{draft.relatedTo}</p> : null}
        </div>
        <input type="hidden" name="taskId" value={draft.taskId} />
        <input type="hidden" name="companyId" value={draft.companyId ?? ""} />
        <input type="hidden" name="leadId" value={draft.leadId ?? ""} />
        {draft.assignedToId ? <input type="hidden" name="assignedToId" value={draft.assignedToId} /> : null}
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Follow-up Date</span>
          <Input
            name="followUpDate"
            type="datetime-local"
            required
            value={followUpDate}
            onChange={(event) => setFollowUpDate(event.target.value)}
            className="h-10"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Follow-up Note</span>
          <textarea
            name="note"
            required
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What was discussed and what changed?"
            className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Method</span>
            <select
              name="method"
              defaultValue="Phone Call"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option>Phone Call</option>
              <option>WhatsApp</option>
              <option>Email</option>
              <option>Physical Visit</option>
              <option>Meeting</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Next Action</span>
            <textarea
              name="nextDiscussionPlan"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Priority</span>
            <select
              name="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Customer Engagement Rating (0-10)</span>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                name="rating"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className="h-2 w-full accent-blue-600"
              />
              <span className="w-10 text-right text-xs font-black text-slate-900">{rating}</span>
            </div>
            <p className="text-xs font-semibold text-slate-500">Classification: {ratingBand(rating)}</p>
          </label>
        </div>
        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
            {pending ? "Saving..." : "Save Follow-up"}
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function TodaysPlanPage({ workspace }: { workspace: CrmWorkspace }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [workItems, setWorkItems] = React.useState<TodayWorkItem[]>(workspace.todayWorkItems);
  const [completedTasks, setCompletedTasks] = React.useState<TodayWorkItem[]>([]);
  const [completingTaskId, setCompletingTaskId] = React.useState<string | null>(null);
  const [taskMessage, setTaskMessage] = React.useState("");
  const [draftFollowUp, setDraftFollowUp] = React.useState<FollowUpFromTaskDraft | null>(null);

  React.useEffect(() => {
    setWorkItems(() => {
      const completedTaskIds = new Set(completedTasks.map((task) => task.sourceId));
      return workspace.todayWorkItems.filter((item) => !(item.source === "Task" && completedTaskIds.has(item.sourceId)));
    });
  }, [workspace.todayWorkItems, completedTasks]);
  const groups = [
    ["Today's Plan", workspace.todayPlans.filter((item) => item.section === "today")],
    ["Pending from Previous Day", workspace.todayPlans.filter((item) => item.section === "previous")],
    ["Completed Plan", workspace.todayPlans.filter((item) => item.section === "completed")],
  ] as const;

  const completeTask = async (item: TodayWorkItem) => {
    if (item.source !== "Task") return;
    setTaskMessage("");
    setCompletingTaskId(item.sourceId);

    const formData = new FormData();
    formData.set("id", item.sourceId);
    formData.set("status", "COMPLETED");

    try {
      const result = await completeTaskFromTodayAction(formData);
      if (typeof result === "object" && result && "ok" in result && result.ok === false) {
        setTaskMessage(typeof result.message === "string" ? result.message : "Unable to mark this task complete.");
        return;
      }

      setWorkItems((prev) => prev.filter((next) => !(next.source === "Task" && next.sourceId === item.sourceId)));
      setCompletedTasks((prev) => {
        if (prev.some((next) => next.sourceId === item.sourceId)) return prev;
        return [{ ...item, id: `completed-${item.id}`, status: "Completed", overdue: false }, ...prev];
      });
      setDraftFollowUp({
        taskId: item.sourceId,
        companyId: item.companyId ?? undefined,
        leadId: item.leadId ?? undefined,
        assignedToId: item.assignedToId ?? undefined,
        title: item.title,
        relatedTo: item.relatedTo,
      });
      router.refresh();
    } catch {
      setTaskMessage("Unable to mark this task complete.");
    } finally {
      setCompletingTaskId(null);
    }
  };

  return (
    <>
      <PageHeader title="Today's Tasks" description="Plans, assigned tasks, due follow-ups, and overdue work in one action queue." actions={pageActions([{ label: "Add Plan", icon: Plus, variant: "default", onClick: () => setOpen(true) }])} />
      <FilterBar>
        <SelectBox label="Date"><option>Today</option></SelectBox>
      </FilterBar>
      <div className="grid gap-5">
        <DashboardCard
          title="Active Today's Tasks"
          action={<Badge variant={workItems.some((item) => item.overdue) ? "danger" : "neutral"}>{workItems.length} Active</Badge>}
        >
          <div className="space-y-3">
            {workItems.length ? workItems.map((item) => (
              <div key={item.id} className={cn("grid gap-3 rounded-xl border px-3 py-3 lg:grid-cols-[auto_1fr_auto] lg:items-center", item.overdue ? "border-red-100 bg-red-50/70" : "border-slate-100 bg-slate-50")}>
                <span className={cn("mt-1 hidden h-4 w-4 items-center justify-center rounded border lg:flex", item.overdue ? "border-red-300 bg-white text-red-600" : "border-slate-300 bg-white text-blue-600")}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <EntityLink href={item.href} className="text-sm font-black text-slate-900">{item.title}</EntityLink>
                    <WorkSourceBadge item={item} />
                    {item.overdue ? <Badge variant="danger">Overdue</Badge> : null}
                    <StatusBadge value={item.priority} />
                    <StatusBadge value={item.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {item.date} {item.time}
                    {item.relatedTo !== "-" ? (
                      <>
                        {" - "}
                        <EntityLink href={item.href} className="text-xs font-semibold">{item.relatedTo}</EntityLink>
                      </>
                    ) : null}
                    {item.assignedTo !== "-" ? ` - ${item.assignedTo}` : ""}
                  </p>
                  {item.note !== "-" ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.note}</p> : null}
                </div>
                <TodayWorkAction item={item} onTaskComplete={completeTask} completingTaskId={completingTaskId} />
              </div>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No active tasks for today.</p>}
            {taskMessage ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{taskMessage}</p> : null}
          </div>
        </DashboardCard>
        <DashboardCard title="Completed Tasks">
          <div className="space-y-3">
            {completedTasks.length ? completedTasks.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <EntityLink href={item.href} className="text-sm font-black text-slate-900">{item.title}</EntityLink>
                  <WorkSourceBadge item={item} />
                  <StatusBadge value={item.status} />
                </div>
                <p className="text-xs font-semibold text-slate-500">{item.date} {item.time}</p>
                {item.note !== "-" ? <p className="text-xs text-slate-500">{item.note}</p> : null}
              </div>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No completed tasks for now.</p>}
          </div>
        </DashboardCard>
        {groups.map(([title, rows]) => (
          <DashboardCard key={title} title={title}>
            <div className="space-y-2">
              {rows.length ? rows.map((item: TodayPlanRow) => (
                <div key={item.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <input type="checkbox" className="h-4 w-4" defaultChecked={item.status === "COMPLETED"} />
                  <span className="min-w-0 text-sm font-semibold text-slate-800">
                    <EntityLink href={item.href} className="font-semibold">{item.title}</EntityLink>
                    {item.relatedTo !== "-" ? (
                      <span className="ml-2 text-xs font-bold text-slate-500">
                        (<EntityLink href={item.href} className="text-xs font-bold">{item.relatedTo}</EntityLink>)
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{item.time}</span>
                  <StatusBadge value={item.status} />
                </div>
              )) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No items.</p>}
            </div>
          </DashboardCard>
        ))}
      </div>
      <FormModal open={open} title="Add Today's Plan" onClose={() => setOpen(false)}>
        <ActionForm action={createTodayPlanAction} onDone={() => setOpen(false)} submitLabel="Save Plan">
          <TextField label="Plan Title" name="title" />
          <TextField label="Planned Time" name="plannedAt" type="datetime-local" />
          <SelectBox label="Related Company" name="companyId"><EntityOptions workspace={workspace} type="companies" /></SelectBox>
          <SelectBox label="Related Lead" name="leadId"><EntityOptions workspace={workspace} type="leads" /></SelectBox>
          <SelectBox label="Product / Service" name="productId"><EntityOptions workspace={workspace} type="products" /></SelectBox>
          <SelectBox label="Priority" name="priority"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></SelectBox>
          <TextAreaField label="Note" name="note" />
        </ActionForm>
      </FormModal>
      <TaskCompletionFollowUpModal
        draft={draftFollowUp}
        onClose={() => setDraftFollowUp(null)}
        onDone={() => {
          setDraftFollowUp(null);
          router.refresh();
        }}
      />
    </>
  );
}

export function TasksPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const [open, setOpen] = React.useState(false);
  const groups = [
    { label: "To Do", status: "TODO" },
    { label: "In Progress", status: "IN_PROGRESS" },
    { label: "Pending", status: "PENDING" },
    { label: "Completed", status: "COMPLETED" },
    { label: "Overdue", status: "OVERDUE" },
  ];

  return (
    <>
      <PageHeader title="Task Management" description="Create, assign, and monitor sales execution tasks." actions={pageActions([{ label: "New Task", icon: Plus, variant: "default", onClick: () => setOpen(true) }])} />
      <div className="grid gap-4 xl:grid-cols-5">
        {groups.map((group) => (
          <Card key={group.status} className="min-h-72 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-black text-slate-950">{group.label}</h3>
              <Badge variant="neutral">{workspace.tasks.filter((task) => task.status === group.status).length}</Badge>
            </div>
            <div className="space-y-3">
              {workspace.tasks.filter((task) => task.status === group.status).slice(0, 8).map((task) => (
                <TaskMiniCard key={task.id} task={task} />
              ))}
            </div>
          </Card>
        ))}
      </div>
      <FormModal open={open} title={role === "MARKETER" ? "Create Task" : "Create Task / Assign to Marketer"} onClose={() => setOpen(false)}>
        <TaskForm workspace={workspace} onDone={() => setOpen(false)} />
      </FormModal>
    </>
  );
}

function TaskMiniCard({ task }: { task: TaskRow }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-sm font-black text-slate-900">{task.title}</p>
      <p className="mt-1 text-xs text-slate-500">
        <EntityLink href={task.href} className="font-semibold">{task.relatedTo}</EntityLink>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge value={task.priority} />
        <StatusBadge value={task.status} />
      </div>
      <form action={updateTaskStatusAction} className="mt-3">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit" variant="outline" size="sm" className="w-full">Mark Completed</Button>
      </form>
    </div>
  );
}

export function FollowUpsPage({ workspace, followUpPage }: { workspace: CrmWorkspace; followUpPage: FollowUpPageData }) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<FollowUpRow | null>(null);
  const filters = followUpPage.filters;
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.dateFilter !== "all") params.set("dateFilter", filters.dateFilter);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("page", String(page));
    params.set("pageSize", String(followUpPage.pageSize));
    return `?${params.toString()}`;
  };
  const columns = ["Follow-up Date", "Company / Customer", "Lead", "Assigned Marketer", "Follow-up Note", "Last Communication", "Priority", "Status", "Next Action", "Created By", "Action"];

  return (
    <>
      <PageHeader title="Follow-up Center" description="Due today, overdue, upcoming, and completed follow-ups." actions={pageActions([{ label: "Add Follow-up", icon: Plus, variant: "default", onClick: () => setOpen(true) }])} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Due Today" value={String(workspace.followUpSummary.today)} helper="Need action" icon={CalendarClock} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Overdue" value={String(workspace.followUpSummary.overdue)} helper="Priority queue" icon={Phone} tone="bg-red-100 text-red-700" />
        <StatCard title="Upcoming" value={String(workspace.followUpSummary.upcoming)} helper="Scheduled" icon={CalendarClock} tone="bg-emerald-100 text-emerald-700" />
        <StatCard title="Completed" value={String(workspace.followUpSummary.completed)} helper="Finished" icon={Check} tone="bg-slate-100 text-slate-700" />
      </div>
      <Card className="p-4">
        <form method="get" className="grid gap-3 lg:grid-cols-[1.25fr_180px_160px_160px_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Search</span>
            <Input name="search" defaultValue={filters.search ?? ""} placeholder="Company, lead, phone, email..." />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Date Filter</span>
            <select name="dateFilter" defaultValue={filters.dateFilter} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
              <option value="all">All Follow-ups</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <TextField label="From" name="from" type="date" defaultValue={filters.from} />
          <TextField label="To" name="to" type="date" defaultValue={filters.to} />
          <div className="flex flex-wrap gap-2">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="pageSize" value={followUpPage.pageSize} />
            <Button type="submit" className="h-10">Apply</Button>
            <Link href="?" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Reset</Link>
          </div>
        </form>
      </Card>

      <Card className="hidden overflow-hidden 2xl:block">
        <div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>{columns.map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {followUpPage.rows.length ? followUpPage.rows.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer transition hover:bg-blue-50/50"
                  tabIndex={0}
                  onClick={() => setSelected(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setSelected(item);
                  }}
                >
                  <td className="px-4 py-3 font-bold text-slate-900">{item.followUpDate}</td>
                  <td className="px-4 py-3">
                    <EntityLink href={item.companyId ? `/customers/${item.companyId}` : item.href} className="font-bold" stopPropagation>{item.customer}</EntityLink>
                  </td>
                  <td className="px-4 py-3">
                    <EntityLink href={item.leadId ? `/leads/${item.leadId}` : undefined} className="font-semibold" stopPropagation>{item.lead}</EntityLink>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.assignedTo}</td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-600"><p className="line-clamp-2">{item.note}</p></td>
                  <td className="px-4 py-3"><StatusBadge value={item.lastCommunicationType} /></td>
                  <td className="px-4 py-3"><StatusBadge value={item.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge value={item.bucket} /></td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-600"><p className="line-clamp-2">{item.nextDiscussionPlan}</p></td>
                  <td className="px-4 py-3 text-slate-600">{item.createdBy}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelected(item)}>Open</Button>
                      {item.bucket !== "Completed" ? (
                        <form action={updateFollowUpStatusAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="COMPLETED" />
                          <Button type="submit" size="sm" variant="outline">Complete</Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={columns.length} className="px-4 py-10 text-center font-semibold text-slate-500">No follow-ups match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-3 2xl:hidden">
        {followUpPage.rows.length ? followUpPage.rows.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSelected(item);
            }}
            className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">
                  <EntityLink href={item.companyId ? `/customers/${item.companyId}` : item.href} className="font-black" stopPropagation>{item.customer}</EntityLink>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Lead: <EntityLink href={item.leadId ? `/leads/${item.leadId}` : undefined} className="text-xs font-semibold" stopPropagation>{item.lead}</EntityLink>
                </p>
              </div>
              <StatusBadge value={item.bucket} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{item.note}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span><b>Date:</b> {item.followUpDate}</span>
              <span><b>By:</b> {item.assignedTo}</span>
              <span><b>Type:</b> {item.lastCommunicationType}</span>
              <span><b>Priority:</b> {item.priority}</span>
            </div>
          </div>
        )) : <EmptyState title="No follow-ups found" description="Try a different search or date filter." />}
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>Showing {followUpPage.rows.length} of {followUpPage.total} follow-ups</span>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={followUpPage.page <= 1}
            className={cn("inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 font-semibold transition", followUpPage.page <= 1 ? "pointer-events-none bg-slate-100 text-slate-400" : "bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700")}
            href={pageHref(Math.max(1, followUpPage.page - 1))}
          >
            Previous
          </Link>
          <span className="font-semibold text-slate-700">Page {followUpPage.page} of {followUpPage.totalPages}</span>
          <Link
            aria-disabled={followUpPage.page >= followUpPage.totalPages}
            className={cn("inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 font-semibold transition", followUpPage.page >= followUpPage.totalPages ? "pointer-events-none bg-slate-100 text-slate-400" : "bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700")}
            href={pageHref(Math.min(followUpPage.totalPages, followUpPage.page + 1))}
          >
            Next
          </Link>
        </div>
      </div>

      <DetailsDrawer open={Boolean(selected)} title={selected ? `${selected.customer} follow-up` : "Follow-up detail"} onClose={() => setSelected(null)}>
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3">
              <InfoLine label="Follow-up Date" value={selected.followUpDate} />
              <InfoLine label="Company / Customer" value={<EntityLink href={selected.companyId ? `/customers/${selected.companyId}` : selected.href} className="font-bold">{selected.customer}</EntityLink>} />
              <InfoLine label="Lead" value={<EntityLink href={selected.leadId ? `/leads/${selected.leadId}` : undefined} className="font-bold">{selected.lead}</EntityLink>} />
              <InfoLine label="Assigned Marketer" value={selected.assignedTo} />
              <InfoLine label="Last Communication Type" value={selected.lastCommunicationType} />
              <InfoLine label="Created By" value={selected.createdBy} />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Follow-up Note</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{selected.note}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Next Action</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{selected.nextDiscussionPlan}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={selected.priority} />
              <StatusBadge value={selected.bucket} />
            </div>
            {selected.bucket !== "Completed" ? (
              <form action={updateFollowUpStatusAction}>
                <input type="hidden" name="id" value={selected.id} />
                <input type="hidden" name="status" value="COMPLETED" />
                <Button type="submit" className="w-full">Mark Completed</Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </DetailsDrawer>
      <FormModal open={open} title="Add Follow-up" onClose={() => setOpen(false)}>
        <FollowUpForm workspace={workspace} onDone={() => setOpen(false)} />
      </FormModal>
    </>
  );
}

function ProductVisual({ product }: { product: ProductRow }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 p-4">
      <div className="absolute right-4 top-4 h-16 w-12 rounded-xl bg-slate-950/75 shadow-xl" />
      <div className="absolute bottom-4 left-4 h-20 w-28 rounded-2xl border-4 border-slate-900 bg-white/85 shadow-xl">
        <div className="h-full rounded-xl bg-gradient-to-br from-white/20 to-slate-950/15" />
      </div>
      <p className="relative z-10 max-w-28 text-sm font-black text-white drop-shadow">{product.name}</p>
    </div>
  );
}

export function ProductsPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  return (
    <>
      <PageHeader title="Product / Services" description="Products and opportunity analytics by interested customers, follow-ups, sales, and conversion." actions={role === "ADMIN" ? pageActions([{ label: "Add Product", icon: Plus, variant: "default" }]) : undefined} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {workspace.products.map((product) => (
          <Link href={`/products/${product.id}`} key={product.id} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
            <ProductVisual product={product} />
            <div className="mt-4">
              <h3 className="text-base font-black text-slate-950">{product.name}</h3>
              <p className="text-sm text-slate-500">{product.category} / {product.brand}</p>
              <p className="mt-2 text-sm font-black text-slate-900">{formatCurrency(product.price)}</p>
              <div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">Interested Customers</span><span className="font-black text-slate-950">{product.interestedCustomers}</span></div>
              <div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-500">Conversion Rate</span><span className="font-black text-blue-700">{product.conversionRate}%</span></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function ProductDetailsPage({ role, workspace, product, productEngagement }: { role: Role; workspace: CrmWorkspace; product?: ProductRow; productEngagement?: ProductEngagementData }) {
  const active = product;
  if (!active) return <EmptyState title="Product not found" description="The requested product is not available." />;
  const opportunities = workspace.leads.filter((lead) => lead.productInterest === active.name).slice(0, 8);
  const engagement = productEngagement ?? {
    summary: {
      totalCompaniesContacted: 0,
      totalLeadsInterested: 0,
      totalCommunicationCount: 0,
      followUpCount: 0,
      quotationSentCount: 0,
      salesCount: 0,
      conversionRate: 0,
    },
    rows: [],
    filters: {},
    filterOptions: { communicationTypes: [], assignedUsers: [] },
  };

  return (
    <>
      <Link href={rolePath(role, "products")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <ProductVisual product={active} />
          <h1 className="mt-5 text-2xl font-black text-slate-950">{active.name}</h1>
          <p className="text-sm text-slate-500">{active.category} / {active.brand}</p>
          <p className="mt-3 text-xl font-black text-blue-700">{formatCurrency(active.price)}</p>
        </Card>
        <div className="grid gap-5">
          <DashboardCard title="Specification"><p className="text-sm leading-6 text-slate-600">{active.specification}</p></DashboardCard>
                  <div className="grid gap-5 xl:grid-cols-4">
            <StatCard title="Companies Contacted" value={String(engagement.summary.totalCompaniesContacted)} helper="Product conversations" icon={WalletCards} tone="bg-blue-100 text-blue-700" />
            <StatCard title="Total Communications" value={String(engagement.summary.totalCommunicationCount)} helper="Calls, meetings, emails, WhatsApp" icon={MessageSquare} tone="bg-indigo-100 text-indigo-700" />
            <StatCard title="Follow-up Count" value={String(engagement.summary.followUpCount)} helper="Open discussions" icon={CalendarClock} tone="bg-amber-100 text-amber-700" />
            <StatCard title="Conversion Rate" value={`${engagement.summary.conversionRate}%`} helper="Leads to sales" icon={Check} tone="bg-violet-100 text-violet-700" />
          </div>
          <Card className="p-5">
            <Tabs
              defaultValue="overview"
              tabs={[
                { label: "Overview", value: "overview" },
                { label: "Product Engagement", value: "engagement" },
              ]}
            >
              {(value) => value === "overview" ? (
                <div className="grid gap-5">
                  <ChartCard title="Product Opportunity Pipeline"><ProductBarChart data={workspace.productOpportunities.map((item) => ({ name: item.name, leads: item.interestedCustomers }))} /></ChartCard>
                  <DashboardCard title="Product-wise Opportunity">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>{["Customer", "Lead", "Status", "Probability"].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {opportunities.length ? opportunities.map((lead) => (
                            <tr key={lead.id}>
                              <td className="px-4 py-3">
                                <EntityLink href={lead.companyId ? `/customers/${lead.companyId}` : undefined} className="font-bold">{lead.company}</EntityLink>
                              </td>
                              <td className="px-4 py-3">
                                <EntityLink href={`/leads/${lead.id}`} className="font-bold">{lead.title}</EntityLink>
                              </td>
                              <td className="px-4 py-3"><StatusBadge value={lead.status} /></td>
                              <td className="px-4 py-3 font-bold text-slate-900">{lead.purchaseProbability}%</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={4} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">No saved opportunities for this product yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </DashboardCard>
                </div>
              ) : (
                <div className="grid gap-5">
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
                    <StatCard title="Companies Contacted" value={String(engagement.summary.totalCompaniesContacted)} helper="For this product" icon={WalletCards} tone="bg-blue-100 text-blue-700" />
                    <StatCard title="Leads Interested" value={String(engagement.summary.totalLeadsInterested)} helper="Product leads" icon={Target} tone="bg-emerald-100 text-emerald-700" />
                    <StatCard title="Total Communication Count" value={String(engagement.summary.totalCommunicationCount)} helper="Calls, meetings, emails, WhatsApp" icon={MessageSquare} tone="bg-indigo-100 text-indigo-700" />
                    <StatCard title="Follow-ups" value={String(engagement.summary.followUpCount)} helper="Related records" icon={CalendarClock} tone="bg-amber-100 text-amber-700" />
                    <StatCard title="Quotation Sent Count" value={String(engagement.summary.quotationSentCount)} helper="Non-draft quotes" icon={FileText} tone="bg-cyan-100 text-cyan-700" />
                    <StatCard title="Conversion" value={`${engagement.summary.conversionRate}%`} helper="Leads to sales" icon={Check} tone="bg-violet-100 text-violet-700" />
                  </div>

                  <form method="get" className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-6">
                    <TextField label="From" name="from" type="date" defaultValue={engagement.filters.from} />
                    <TextField label="To" name="to" type="date" defaultValue={engagement.filters.to} />
                    <SelectBox label="Status" name="status" defaultValue={engagement.filters.status ?? "all"}>
                      <option value="all">All Status</option>
                      <option value="Interested">Interested</option>
                      <option value="Negotiation">Negotiation</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </SelectBox>
                    <SelectBox label="Communication" name="communicationType" defaultValue={engagement.filters.communicationType ?? "all"}>
                      <option value="all">All Types</option>
                      {engagement.filterOptions.communicationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                    </SelectBox>
                    <SelectBox label="Assigned User" name="assignedUserId" defaultValue={engagement.filters.assignedUserId ?? "all"}>
                      <option value="all">All Users</option>
                      {engagement.filterOptions.assignedUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </SelectBox>
                    <div className="flex items-end gap-2">
                      <Button type="submit" className="h-10 flex-1">Filter</Button>
                      <Link href={`/products/${active.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-blue-50">Reset</Link>
                    </div>
                  </form>

                  <DashboardCard title="Product Engagement Table">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>{["Company Name", "Lead Name", "Communication Type", "Last Contact Date", "Status", "Assigned Marketer"].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {engagement.rows.length ? engagement.rows.map((row) => (
                            <tr key={row.id}>
                              <td className="px-4 py-3">
                                <EntityLink href={row.companyId ? `/customers/${row.companyId}` : undefined} className="font-bold">{row.companyName}</EntityLink>
                              </td>
                              <td className="px-4 py-3">
                                <EntityLink href={row.leadId ? `/leads/${row.leadId}` : undefined} className="font-bold">{row.leadName}</EntityLink>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-700">{row.communicationType}</td>
                              <td className="px-4 py-3 font-semibold text-slate-600">{row.lastContactDate}</td>
                              <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
                              <td className="px-4 py-3 font-semibold text-slate-700">{row.assignedMarketer}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={6} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">No product communication records match the selected filters.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </DashboardCard>
                </div>
              )}
            </Tabs>
          </Card>
        </div>
      </div>
    </>
  );
}

export function QuotationsPage({ workspace }: { workspace: CrmWorkspace }) {
  const columns = React.useMemo<ColumnDef<QuotationRow>[]>(
    () => [
      { accessorKey: "quoteNumber", header: "Quotation ID", cell: ({ row }) => <span className="font-mono font-black text-blue-700">{row.original.quoteNumber}</span> },
      { accessorKey: "customer", header: "Customer", cell: ({ row }) => <EntityLink href={row.original.companyId ? `/customers/${row.original.companyId}` : row.original.leadId ? `/leads/${row.original.leadId}` : undefined} className="font-semibold">{row.original.customer}</EntityLink> },
      { accessorKey: "product", header: "Product / Service" },
      { accessorKey: "amount", header: "Amount", cell: ({ row }) => formatCurrency(row.original.amount) },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { accessorKey: "createdBy", header: "Created By" },
      { accessorKey: "date", header: "Date" },
      { id: "Action", header: "Action", cell: ({ row }) => <RowActions detailHref={`/quotations/${row.original.id}`} /> },
    ],
    [],
  );

  return (
    <>
      <PageHeader title="Quotations" description="Create and manage quotation workflow from draft to sale conversion." actions={pageActions([{ label: "Create Quotation", icon: Plus, variant: "default" }])} />
      <DataTable data={workspace.quotations} columns={columns} searchPlaceholder="Search quotations..." />
    </>
  );
}

export function QuotationDetailsPage({ role, quotation }: { role: Role; quotation?: QuotationRow }) {
  const active = quotation;
  if (!active) return <EmptyState title="Quotation not found" description="The requested quotation is not available." />;

  return (
    <>
      <Link href={rolePath(role, "quotations")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to quotations
      </Link>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-100">Professional quotation preview</p>
              <h1 className="mt-2 text-3xl font-black">{active.quoteNumber}</h1>
              <p className="mt-1 text-blue-100">
                <EntityLink href={active.companyId ? `/customers/${active.companyId}` : active.leadId ? `/leads/${active.leadId}` : undefined} className="font-semibold text-white">{active.customer}</EntityLink>
              </p>
            </div>
            <StatusBadge value={active.status} />
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoLine label="Customer" value={<EntityLink href={active.companyId ? `/customers/${active.companyId}` : active.leadId ? `/leads/${active.leadId}` : undefined} className="font-bold">{active.customer}</EntityLink>} />
            <InfoLine label="Created By" value={active.createdBy} />
            <InfoLine label="Date" value={active.date} />
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>{["Product / Service", "Quantity", "Amount"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
              </thead>
              <tbody><tr><td className="px-4 py-4 font-bold text-slate-900">{active.product}</td><td className="px-4 py-4">1</td><td className="px-4 py-4 font-black text-slate-950">{formatCurrency(active.amount)}</td></tr></tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {(["Generate PDF", "Send Email", "Mark as Sent", "Convert to Sale"] as const).map((label) => (
              <Button key={label} type="button" variant={label === "Convert to Sale" ? "default" : "outline"}>
                {label === "Send Email" ? <Send className="h-4 w-4" /> : label === "Generate PDF" ? <FileDown className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}

export function CommunicationPage({ workspace }: { workspace: CrmWorkspace }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <PageHeader title="Communication / Activity Log" description="Log every customer touchpoint and keep the customer timeline complete." actions={pageActions([{ label: "Log Communication", icon: Plus, variant: "default", onClick: () => setOpen(true) }])} />
      <DashboardCard title="Activity Timeline"><Timeline rows={workspace.activities} /></DashboardCard>
      <FormModal open={open} title="Add Communication / Activity Log" onClose={() => setOpen(false)}>
        <CommunicationForm workspace={workspace} onDone={() => setOpen(false)} />
      </FormModal>
    </>
  );
}

export function NotificationsPage({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <>
      <PageHeader title="Notifications Center" description="Follow-up reminders, task assignments, overdue alerts, rewards, target alerts, and system notices." />
      <Card className="p-5">
        <div className="space-y-3">
          {workspace.notifications.map((item) => (
            <div key={item.id} className={cn("flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between", item.read ? "border-slate-100 bg-slate-50" : "border-blue-100 bg-blue-50/70")}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-950">
                    <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
                  </h3>
                  <StatusBadge value={item.type} />
                  {!item.read ? <Badge variant="danger">Unread</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">{item.time}</p>
              </div>
              {!item.read ? (
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" variant="outline" size="sm">Mark Read</Button>
                </form>
              ) : null}
            </div>
          ))}
          {!workspace.notifications.length ? <EmptyState title="No notifications" description="System reminders and CRM updates will appear here." /> : null}
        </div>
      </Card>
    </>
  );
}

export function RewardsPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const [rewardOpen, setRewardOpen] = React.useState(false);
  const [ruleOpen, setRuleOpen] = React.useState(false);

  if (role === "MARKETER") {
    const me = workspace.employees.find((item) => item.id === workspace.user.id) ?? workspace.employees[0];
    return (
      <>
        <PageHeader title="Rewards" description="Your reward points, rank, achievement history, and incentive timeline." />
        <div className="grid gap-5 xl:grid-cols-[300px_1fr_300px]">
          <StatCard title="Total Points" value={String(me?.rewardPoints ?? 0)} helper="Current score" icon={WalletCards} tone="bg-blue-100 text-blue-700" />
          <DashboardCard title="Reward Rules">
            <div className="space-y-3">{workspace.rewardRules.map((rule) => <div key={rule.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-bold text-slate-900">{rule.name}</span><StatusBadge value={`+${rule.points} pts`} /></div>)}</div>
          </DashboardCard>
          <Card className="flex flex-col items-center justify-center p-6 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Award className="h-8 w-8" /></div><p className="mt-4 text-3xl font-black text-slate-950">{me?.conversionRate ?? "0%"}</p><p className="text-sm text-slate-500">Conversion Rate</p></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Rewards & Incentives" description="Manage reward rules, manual incentives, reward history, and automation log." actions={pageActions([{ label: "Manual Reward", icon: Plus, variant: "default", onClick: () => setRewardOpen(true) }, { label: "Add Rule", icon: Plus, variant: "outline", onClick: () => setRuleOpen(true) }])} />
      <div className="grid gap-5 lg:grid-cols-3">
        <StatCard title="Total Reward Given" value={String(workspace.employees.reduce((sum, row) => sum + row.rewardPoints, 0))} helper="Visible users" icon={WalletCards} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Best Performer" value={workspace.employees[0]?.name ?? "-"} helper={`${workspace.employees[0]?.rewardPoints ?? 0} points`} icon={UserPlus} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Rules Active" value={String(workspace.rewardRules.filter((rule) => rule.active).length)} helper="Automation rules" icon={Check} tone="bg-emerald-100 text-emerald-700" />
      </div>
      <TeamManagementTable workspace={workspace} />
      <FormModal title="Manual Reward" open={rewardOpen} onClose={() => setRewardOpen(false)}>
        <ActionForm action={giveManualRewardAction} onDone={() => setRewardOpen(false)} submitLabel="Give Reward">
          <SelectBox label="Employee" name="userId"><EntityOptions workspace={workspace} type="users" /></SelectBox>
          <TextField label="Points" name="points" type="number" />
          <TextAreaField label="Reason" name="reason" />
        </ActionForm>
      </FormModal>
      <FormModal title="Reward Rule" open={ruleOpen} onClose={() => setRuleOpen(false)}>
        <ActionForm action={createRewardRuleAction} onDone={() => setRuleOpen(false)} submitLabel="Create Rule">
          <TextField label="Rule Name" name="name" />
          <SelectBox label="Trigger" name="trigger"><option value="LEAD_CREATED">Lead Added</option><option value="FOLLOW_UP_COMPLETED">Follow-up Completed</option><option value="WON_SALE">Sale Won</option></SelectBox>
          <TextField label="Points" name="points" type="number" />
        </ActionForm>
      </FormModal>
    </>
  );
}

export function ReportsPage({ workspace }: { workspace: CrmWorkspace }) {
  const reportCards = [
    ["Customer Communication Report", "CALL history and activity report", "CUSTOMER_COMMUNICATION"],
    ["Follow-up Report", "Due, overdue, upcoming and completed follow-ups", "FOLLOW_UP"],
    ["Employee Performance Report", "Team productivity and conversion analytics", "EMPLOYEE_PERFORMANCE"],
    ["Sales Report", "Revenue and quotation/sale report", "SALES"],
    ["Reward Report", "Reward point and incentive analytics", "REWARD"],
    ["Lead Conversion Report", "Pipeline conversion and status movement", "LEAD_CONVERSION"],
  ] as const;
  return (
    <>
      <PageHeader title="Reports Center" description="Generate and export customer, follow-up, employee, sales, reward, and conversion reports." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map(([title, description, type]) => (
          <Card key={title} className="p-5">
            <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FileText className="h-6 w-6" /></div><div><h3 className="font-black text-slate-950">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div></div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["PDF", "EXCEL", "CSV", "PRINT"] as const).map((format) => (
                <form key={format} action={createReportLogAction}>
                  <input type="hidden" name="reportType" value={type} />
                  <input type="hidden" name="format" value={format} />
                  <Button type="submit" variant="outline" size="sm" className="w-full">{format === "PRINT" ? <Printer className="h-4 w-4" /> : <Download className="h-4 w-4" />}{format}</Button>
                </form>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <DashboardCard title="Report Data Preview">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-900">Recent Leads</h3>
            <div className="mt-3 space-y-2">
              {workspace.leads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between gap-3 text-sm">
                  <EntityLink href={`/leads/${lead.id}`} className="truncate font-bold">{lead.title}</EntityLink>
                  <StatusBadge value={lead.status} />
                </div>
              ))}
              {!workspace.leads.length ? <p className="text-sm font-semibold text-slate-500">No saved leads yet.</p> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-900">Recent Customers</h3>
            <div className="mt-3 space-y-2">
              {workspace.companies.slice(0, 5).map((company) => (
                <div key={company.id} className="flex items-center justify-between gap-3 text-sm">
                  <EntityLink href={`/customers/${company.id}`} className="truncate font-bold">{company.name}</EntityLink>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{company.industry}</span>
                </div>
              ))}
              {!workspace.companies.length ? <p className="text-sm font-semibold text-slate-500">No saved customers yet.</p> : null}
            </div>
          </div>
        </div>
      </DashboardCard>
      <DataTable data={workspace.reportLogs} columns={React.useMemo<ColumnDef<(typeof workspace.reportLogs)[number]>[]>(() => [
        { accessorKey: "module", header: "Report" },
        { accessorKey: "format", header: "Format" },
        { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
        { accessorKey: "createdAt", header: "Created" },
      ], [])} searchPlaceholder="Search report logs..." />
    </>
  );
}

function TeamManagementTable({ workspace }: { workspace: CrmWorkspace }) {
  const columns = React.useMemo<ColumnDef<(typeof workspace.employees)[number]>[]>(
    () => [
      { accessorKey: "name", header: "Employee Name", cell: ({ row }) => <span className="font-bold text-slate-900">{row.original.name}</span> },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "leads", header: "Leads" },
      { accessorKey: "followUps", header: "Follow-ups" },
      { accessorKey: "sales", header: "Sales" },
      { accessorKey: "rewardPoints", header: "Reward Points" },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { id: "Action", header: "Action", cell: () => <RowActions /> },
    ],
    [],
  );

  return <DataTable data={workspace.employees} columns={columns} searchPlaceholder="Search employee..." />;
}

export function TeamPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  return (
    <>
      <PageHeader title="Team Management" description="Monitor employees, activity level, sales, and reward performance." actions={role === "ADMIN" ? pageActions([{ label: "Add Employee", icon: Plus, variant: "default", href: "/admin/users" }]) : undefined} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Employees" value={String(workspace.employees.length)} helper="Team users" icon={UserPlus} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Active Employees" value={String(workspace.employees.filter((item) => item.status === "Active").length)} helper="Currently active" icon={Check} tone="bg-emerald-100 text-emerald-700" />
        <StatCard title="Best Performer" value={workspace.employees[0]?.name ?? "-"} helper={`${workspace.employees[0]?.rewardPoints ?? 0} reward points`} icon={WalletCards} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Low Activity" value={String(workspace.employees.filter((item) => item.leads === 0).length)} helper="Needs coaching" icon={Settings} tone="bg-red-100 text-red-700" />
      </div>
      <Card className="p-5"><TeamManagementTable workspace={workspace} /></Card>
      <DetailsDrawer title="Employee Profile" open={drawerOpen} onClose={() => setDrawerOpen(false)}><p className="text-sm text-slate-500">Employee detail drawer is ready for selected employee context.</p></DetailsDrawer>
    </>
  );
}

export function UsersPage({ workspace }: { workspace: CrmWorkspace }) {
  const [open, setOpen] = React.useState(false);
  const columns = React.useMemo<ColumnDef<(typeof workspace.employees)[number]>[]>(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-bold text-slate-900">{row.original.name}</span> },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "mobile", header: "Mobile" },
      { accessorKey: "role", header: "Role", cell: ({ row }) => <StatusBadge value={row.original.role} /> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { id: "Action", header: "Action", cell: () => <RowActions /> },
    ],
    [],
  );

  return (
    <>
      <PageHeader title="Users & Roles" description="Create users, assign roles, and manage permission controls." actions={pageActions([{ label: "Create User", icon: Plus, variant: "default", onClick: () => setOpen(true) }])} />
      <Card className="p-5">
        <Tabs defaultValue="users" tabs={[{ label: "Users", value: "users" }, { label: "Roles", value: "roles" }, { label: "Permissions", value: "permissions" }]}>
          {(value) => value === "users" ? <DataTable data={workspace.employees} columns={columns} searchPlaceholder="Search user..." /> : <PermissionsPage workspace={workspace} embedded />}
        </Tabs>
      </Card>
      <FormModal title="Create User" open={open} onClose={() => setOpen(false)}>
        <ActionForm action={createUserAction} onDone={() => setOpen(false)} submitLabel="Create User">
          <TextField label="Full Name" name="name" />
          <TextField label="Email" name="email" type="email" />
          <TextField label="Mobile Number" name="mobile" />
          <TextField label="Designation" name="designation" />
          <SelectBox label="Role" name="role"><option value="MARKETER">Marketer</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Admin</option></SelectBox>
          <SelectBox label="Supervisor" name="supervisorId"><EntityOptions workspace={workspace} type="users" /></SelectBox>
        </ActionForm>
      </FormModal>
    </>
  );
}

export function PermissionsPage({ workspace, embedded = false }: { workspace: CrmWorkspace; embedded?: boolean }) {
  const content = (
    <Card className={embedded ? "border-0 shadow-none" : "p-5"}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Module</th>{["View", "Create", "Edit", "Delete", "Assign", "Reassign", "Import", "Export", "Download Report"].map((action) => <th key={action} className="px-4 py-3">{action}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {workspace.permissions.map((row) => (
              <tr key={row.module}><td className="px-4 py-3 font-bold text-slate-900">{row.module}</td>{["View", "Create", "Edit", "Delete", "Assign", "Reassign", "Import", "Export", "Download Report"].map((action) => <td key={action} className="px-4 py-3"><input type="checkbox" checked={Boolean(row.permissions[action])} readOnly className="h-4 w-4" /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
  if (embedded) return content;
  return <><PageHeader title="Role & Permission Management" description="Module and action-based permission matrix for CRM roles." />{content}</>;
}

export function ImportExportPage({ workspace }: { workspace: CrmWorkspace }) {
  const columns = React.useMemo<ColumnDef<(typeof workspace.importExportLogs)[number]>[]>(() => [
    { accessorKey: "type", header: "Type" },
    { accessorKey: "module", header: "Module" },
    { accessorKey: "format", header: "Format" },
    { accessorKey: "fileName", header: "File" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
    { accessorKey: "processedRows", header: "Processed" },
    { accessorKey: "failedRows", header: "Failed" },
    { accessorKey: "createdAt", header: "Created" },
  ], []);

  return (
    <>
      <PageHeader title="Import / Export" description="CSV and Excel customer, company, lead, and report movement log." />
      <Card className="p-5">
        <ActionForm action={createImportExportLogAction} submitLabel="Record Import / Export">
          <div className="grid gap-3 md:grid-cols-5">
            <SelectBox label="Type" name="type"><option value="IMPORT">Import</option><option value="EXPORT">Export</option></SelectBox>
            <SelectBox label="Module" name="module"><option value="CUSTOMERS">Customers</option><option value="LEADS">Leads</option><option value="PRODUCTS">Products</option><option value="REPORTS">Reports</option></SelectBox>
            <SelectBox label="Format" name="format"><option value="CSV">CSV</option><option value="EXCEL">Excel</option><option value="PDF">PDF</option></SelectBox>
            <TextField label="File Name" name="fileName" />
            <TextField label="Processed Rows" name="processedRows" type="number" defaultValue={0} />
          </div>
        </ActionForm>
      </Card>
      {workspace.leads.length || workspace.companies.length ? (
        <DashboardCard title="Saved Data Preview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-900">Saved Leads</h3>
              <div className="mt-3 space-y-2">
                {workspace.leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between gap-3 text-sm">
                    <EntityLink href={`/leads/${lead.id}`} className="truncate font-bold">{lead.title}</EntityLink>
                    <EntityLink href={lead.companyId ? `/customers/${lead.companyId}` : undefined} className="truncate text-xs font-semibold">{lead.company}</EntityLink>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-900">Saved Customers</h3>
              <div className="mt-3 space-y-2">
                {workspace.companies.slice(0, 5).map((company) => (
                  <div key={company.id} className="flex items-center justify-between gap-3 text-sm">
                    <EntityLink href={`/customers/${company.id}`} className="truncate font-bold">{company.name}</EntityLink>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">{company.totalLeads} leads</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DashboardCard>
      ) : null}
      <DataTable data={workspace.importExportLogs} columns={columns} searchPlaceholder="Search import/export logs..." />
    </>
  );
}

export function MyPerformancePage({ workspace }: { workspace: CrmWorkspace }) {
  const me = workspace.employees.find((item) => item.id === workspace.user.id) ?? workspace.employees[0];
  return (
    <>
      <PageHeader title="My Performance" description="Personal sales execution, points, conversion, and activity score." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Leads Added" value={String(me?.leads ?? 0)} helper="Assigned pipeline" icon={Target} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Follow-ups" value={String(me?.followUps ?? 0)} helper="Open and complete" icon={CalendarClock} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Sales" value={String(me?.sales ?? 0)} helper="Won leads" icon={Check} tone="bg-emerald-100 text-emerald-700" />
        <StatCard title="Reward Points" value={String(me?.rewardPoints ?? 0)} helper={me?.conversionRate ?? "0%"} icon={Award} tone="bg-violet-100 text-violet-700" />
      </div>
      <DashboardCard title="Recent Activity"><Timeline rows={workspace.activities} /></DashboardCard>
    </>
  );
}

export function CalendarPage({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <>
      <PageHeader title="Calendar" description="Daily task, plan, and follow-up schedule." />
      <div className="grid gap-5 xl:grid-cols-3">
        <DashboardCard title="Plans"><CompactSchedule rows={workspace.todayPlans.map((item) => ({ id: item.id, href: item.href, title: item.title, meta: `${item.time} - ${item.status}` }))} /></DashboardCard>
        <DashboardCard title="Tasks"><CompactSchedule rows={workspace.tasks.map((item) => ({ id: item.id, href: item.href, title: item.title, meta: `${item.dueDate} - ${item.status}` }))} /></DashboardCard>
        <DashboardCard title="Follow-ups"><CompactSchedule rows={workspace.followUps.map((item) => ({ id: item.id, href: item.href, title: item.customer, meta: `${item.followUpDate} - ${item.bucket}` }))} /></DashboardCard>
      </div>
    </>
  );
}

function CompactSchedule({ rows }: { rows: { id: string; title: string; meta: string; href?: string | null }[] }) {
  return <div className="space-y-2">{rows.slice(0, 10).map((row) => <div key={row.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold text-slate-900"><EntityLink href={row.href} className="font-bold">{row.title}</EntityLink></p><p className="text-xs text-slate-500">{row.meta}</p></div>)}</div>;
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Company settings, lead status, reward rules, targets, notifications, and import/export configuration." />
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <Card className="p-3">
          <nav className="space-y-1">{["Company Settings", "Lead Status Settings", "Product Category", "Reward Rules", "Target Rules", "Notification Settings", "Import / Export Settings", "System Configuration"].map((item, index) => <button key={item} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition", index === 0 ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50")} type="button">{item}</button>)}</nav>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-black text-slate-950">Company Settings</h2>
          <ActionForm action={saveSettingsAction} submitLabel="Save Changes">
            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_260px]">
              <div className="space-y-4"><TextField label="Company Name" name="company" defaultValue="Mugnee Solutions" /><TextField label="Email" name="email" defaultValue="info@mugnee.com" /><TextField label="Phone" name="phone" defaultValue="01712345678" /><TextField label="Address" name="address" defaultValue="House #12, Road #5, Dhanmondi, Dhaka-1205" /></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center"><div className="mx-auto flex h-24 w-32 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm"><span className="text-lg font-black">MUGNEE</span></div><Button className="mt-4" type="button" variant="outline">Change Logo</Button></div>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
