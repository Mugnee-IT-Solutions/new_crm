"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  ChevronDown,
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
  Trash2,
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
  createProductAction,
  createReportLogAction,
  createRewardRuleAction,
  createTaskAction,
  createUserAction,
  giveManualRewardAction,
  markNotificationReadAction,
  saveSettingsAction,
  updateFollowUpStatusAction,
} from "@/lib/crm-actions";
import type {
  CompanyRow,
  CrmWorkspace,
  CustomerHistory,
  CommunicationHistoryRow,
  FollowUpPageData,
  FollowUpRow,
  LeadRow,
  ProductEngagementData,
  ProductRow,
  QuotationRow,
  TaskRow,
} from "@/lib/crm-data";
import { cn, formatCurrency, rolePath, type Role } from "@/lib/utils";

type ServerAction = (formData: FormData) => Promise<{ ok?: boolean; message?: string } | unknown>;

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

function SelectBox({ label, name, children, defaultValue, compact = false }: { label: string; name?: string; children: React.ReactNode; defaultValue?: string; compact?: boolean }) {
  return (
    <label className={cn("space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-xs font-bold uppercase text-slate-500", compact && "text-[11px] leading-4")}>{label}</span>
      <select name={name} defaultValue={defaultValue} className={cn("h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100", compact && "h-9 px-2.5 text-[13px]")}>
        {children}
      </select>
    </label>
  );
}

type SearchableOption = {
  value: string;
  label: string;
};

type SearchableScope = "companies" | "leads";

type SearchableRow = { value?: string; label?: string; id?: string } & Record<string, unknown>;

type CompanyListRow = {
  id: string;
  companyName: string;
  contactPerson?: string | null;
  phone?: string | null;
};

type LeadListRow = {
  id: string;
  name: string;
  phone?: string | null;
  companyName?: string | null;
};

function buildSearchLabel(scope: SearchableScope, raw: SearchableRow) {
  const fallbackLabel = "name" in raw && typeof raw.name === "string" ? raw.name.trim() : "";
  if (scope === "companies") {
    const name = typeof raw.companyName === "string" && raw.companyName.trim() ? raw.companyName : "";
    return name || fallbackLabel || "Unnamed company";
  }

  const base = typeof raw.name === "string" && raw.name.trim() ? raw.name : fallbackLabel || "";
  const company = typeof raw.companyName === "string" && raw.companyName.trim() ? raw.companyName : "";
  return base && company ? `${base} (${company})` : base || company || "Unnamed lead";
}

function mapSearchRows(scope: SearchableScope, rows: unknown[]) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows
    .map((raw) => {
      const row = raw as SearchableRow & CompanyListRow & LeadListRow;
      const value = typeof row.value === "string" && row.value.trim() ? row.value : typeof row.id === "string" && row.id.trim() ? row.id : "";
      if (!value) return null;

      return { value, label: buildSearchLabel(scope, row) };
    })
    .filter((item): item is SearchableOption => Boolean(item));
}

function SearchableEntitySelect({
  label,
  name,
  options,
  defaultValue = "",
  defaultLabel,
  searchScope,
  required = false,
  placeholder,
  compact = false,
}: {
  label: string;
  name: string;
  options: SearchableOption[];
  defaultValue?: string;
  defaultLabel?: string;
  searchScope?: SearchableScope;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [selectedValue, setSelectedValue] = React.useState(defaultValue);
  const [remoteOptions, setRemoteOptions] = React.useState<SearchableOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const sourceOptions = React.useMemo(
    () => (searchScope ? remoteOptions : options).filter((item) => item.label.trim()),
    [options, remoteOptions, searchScope],
  );

  const normalizedQuery = query.trim();
  const filteredOptions = React.useMemo(() => {
    if (searchScope) return sourceOptions;
    const keyword = normalizedQuery.toLowerCase();
    return sourceOptions.filter((item) => item.label.toLowerCase().includes(keyword));
  }, [normalizedQuery, searchScope, sourceOptions]);

  React.useEffect(() => {
    if (defaultValue) {
      const baseLabel = sourceOptions.find((item) => item.value === defaultValue)?.label ?? defaultLabel ?? "";
      setSelectedValue(defaultValue);
      setQuery(baseLabel);
      return;
    }

    setSelectedValue("");
    setQuery("");
  }, [defaultValue, defaultLabel, sourceOptions]);

  React.useEffect(() => {
    if (!searchScope) {
      setRemoteOptions([]);
      setIsLoading(false);
      return;
    }

    if (!open && !defaultValue) return;

    const endpoint = searchScope === "companies" ? "/api/customers/list" : "/api/leads/list";
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (normalizedQuery) {
        params.set("search", normalizedQuery);
      }
      params.set("limit", "20");

      try {
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load matches.");
        }

        const payload = await response.json();
        const rows = mapSearchRows(searchScope, Array.isArray(payload?.rows) ? payload.rows : []);
        if (!controller.signal.aborted) {
          setRemoteOptions(rows);
        }
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.error(error);
          setRemoteOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, normalizedQuery, searchScope, defaultValue]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [open, filteredOptions.length, query]);

  React.useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!wrapperRef.current || !(event.target instanceof Node)) return;
      if (!wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectOption = React.useCallback((option: SearchableOption) => {
    setSelectedValue(option.value);
    setQuery(option.label);
    setOpen(false);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setOpen(true);

    const exactMatch = sourceOptions.find((option) => option.label.toLowerCase() === nextQuery.trim().toLowerCase());
    setSelectedValue(exactMatch ? exactMatch.value : "");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filteredOptions.length && event.key !== "Escape") return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.min(filteredOptions.length - 1, prev + 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }

    if (event.key === "Enter" && open && filteredOptions.length) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex] ?? filteredOptions[0]!);
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <label className={cn("block space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-sm font-semibold text-slate-700", compact && "text-xs leading-4")}>{label}</span>
      <div className="relative" ref={wrapperRef}>
        <input
          required={required}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Search..."}
          className={cn("h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100", compact && "h-9 px-2.5 text-[13px]")}
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-500"
          aria-label="Toggle options"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {isLoading ? (
              <p className="px-3 py-2 text-sm font-semibold text-slate-500">Searching...</p>
            ) : filteredOptions.length ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 transition",
                    index === activeIndex ? "bg-blue-600 text-white" : "hover:bg-slate-100",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-slate-500">No results found</p>
            )}
          </div>
        ) : null}
      </div>
      <input type="hidden" name={name} value={selectedValue} />
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
  readOnly = false,
  compact = false,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  compact?: boolean;
}) {
  return (
    <label className={cn("block space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-sm font-semibold text-slate-700", compact && "text-xs leading-4")}>{label}</span>
      <Input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn(
          compact ? "h-9 px-2.5 text-[13px]" : undefined,
          readOnly ? "bg-slate-100 text-slate-500" : undefined,
        )}
      />
    </label>
  );
}

function TextAreaField({ label, name, placeholder, required = false, compact = false }: { label: string; name: string; placeholder?: string; required?: boolean; compact?: boolean }) {
  return (
    <label className={cn("block space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-sm font-semibold text-slate-700", compact && "text-xs leading-4")}>{label}</span>
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        className={cn("min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100", compact && "min-h-16 px-2.5 py-1.5 text-[13px]")}
      />
    </label>
  );
}

function ActionForm({
  action,
  children,
  onDone,
  submitLabel = "Save",
  className,
  bodyClassName,
  footerClassName,
}: {
  action: ServerAction;
  children: React.ReactNode;
  onDone?: () => void;
  submitLabel?: string;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");
  const router = useRouter();

  return (
    <form
      className={cn("space-y-4", className)}
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
            router.refresh();
            onDone?.();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed.");
          }
        });
      }}
    >
      <div className={cn("space-y-4", bodyClassName)}>{children}</div>
      {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
      <div className={footerClassName}>
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
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

function EntityOptions({ workspace, type }: { workspace: CrmWorkspace; type: "users" | "marketers" | "supervisors" | "companies" | "leads" | "products" }) {
  const rows =
    type === "users" ? workspace.employees.map((item) => [item.id, item.name])
      : type === "marketers" ? workspace.employees.filter((item) => item.role === "Marketer").map((item) => [item.id, item.name])
        : type === "supervisors" ? workspace.employees.filter((item) => item.role === "Supervisor").map((item) => [item.id, item.name])
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

function readRawValue(raw: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text && text !== "-") return text;
  }

  const normalizeKey = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, " / ").toLowerCase();
  const normalized = new Map<string, unknown>();
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    normalized.set(normalizeKey(rawKey), rawValue);
  }

  for (const key of candidates) {
    const found = normalized.get(normalizeKey(key));
    if (found === undefined || found === null) continue;
    const text = String(found).trim();
    if (text && text !== "-") return text;
  }

  return undefined;
}

function readTemplateField(raw: Record<string, unknown>, candidates: string[]) {
  return readRawValue(raw, candidates) || "";
}

function toDisplayValue(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized && normalized !== "-" ? normalized : "";
}

function parseTemplateRawData(rawData: CompanyRow["rawData"] | string | unknown) {
  if (!rawData) return {};
  if (typeof rawData === "string") {
    try {
      const parsed = JSON.parse(rawData) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  if (typeof rawData === "object" && !Array.isArray(rawData)) {
    return rawData as Record<string, unknown>;
  }

  return {};
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

function TaskHistoryList({ rows }: { rows: TaskRow[] }) {
  return rows.length ? (
    <div className="space-y-3">
      {rows.map((task) => (
        <div key={task.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <EntityLink href={task.href} className="text-sm font-black text-slate-900">{task.title}</EntityLink>
            <StatusBadge value={task.status} />
            <StatusBadge value={task.priority} />
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{task.dueDate} {task.time} - Assigned by {task.assignedBy}</p>
          {task.description !== "-" ? <p className="mt-1 text-xs text-slate-500">{task.description}</p> : null}
        </div>
      ))}
    </div>
  ) : <EmptyState title="No task history" description="Customer-related task history will appear here." />;
}

function FollowUpHistoryList({ rows }: { rows: FollowUpRow[] }) {
  return rows.length ? (
    <div className="space-y-3">
      {rows.map((followUp) => (
        <div key={followUp.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <EntityLink href={followUp.href} className="text-sm font-black text-slate-900">{followUp.customer}</EntityLink>
            <StatusBadge value={followUp.status} />
            <StatusBadge value={followUp.priority} />
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{followUp.followUpDate} - {followUp.method} - {followUp.assignedTo}</p>
          {followUp.note !== "-" ? <p className="mt-1 text-xs text-slate-500">{followUp.note}</p> : null}
          {followUp.nextDiscussionPlan !== "-" ? <p className="mt-1 text-[11px] font-semibold text-slate-500">Next: {followUp.nextDiscussionPlan}</p> : null}
        </div>
      ))}
    </div>
  ) : <EmptyState title="No follow-up history" description="Customer follow-up records will appear here." />;
}

function CommunicationHistoryList({ rows }: { rows: CommunicationHistoryRow[] }) {
  return rows.length ? (
    <div className="space-y-3">
      {rows.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <EntityLink href={item.href} className="text-sm font-black text-slate-900">{item.method}</EntityLink>
            <StatusBadge value={item.outcome} />
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{item.time} - {item.createdBy}</p>
          <p className="mt-1 text-xs text-slate-500">{item.summary}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
            {item.discussionTopic !== "-" ? <span>Topic: {item.discussionTopic}</span> : null}
            {item.productDiscussed !== "-" ? <span>Product: {item.productDiscussed}</span> : null}
            {item.rating !== "-" ? <span>Rating: {item.rating}</span> : null}
            {item.nextFollowUpDate !== "-" ? <span>Next Follow-up: {item.nextFollowUpDate}</span> : null}
          </div>
          {item.notes !== "-" ? <p className="mt-2 text-[11px] text-slate-500">Notes: {item.notes}</p> : null}
        </div>
      ))}
    </div>
  ) : <EmptyState title="No communication history" description="Task and customer conversation logs will appear here." />;
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
      <SelectBox label="Assigned Marketer" name="assignedToId"><EntityOptions workspace={workspace} type="marketers" /></SelectBox>
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
    <ActionForm
      action={createTaskAction}
      onDone={onDone}
      submitLabel="Save Task"
      className="flex h-full flex-col"
      bodyClassName="space-y-3"
      footerClassName="mt-auto border-t border-slate-100 pt-3"
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField label="Task Title" name="title" compact />
        <SelectBox label="Assign To" name="assignedToId" compact><EntityOptions workspace={workspace} type="marketers" /></SelectBox>
        <TextField label="Company Name" name="companyName" compact />
        <TextField label="Lead Name" name="leadName" compact />
        <SelectBox label="Related Product" name="productId" compact><EntityOptions workspace={workspace} type="products" /></SelectBox>
        <SelectBox label="Priority" name="priority" compact><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></SelectBox>
        <TextField label="Due Date" name="dueDate" type="date" compact />
        <SelectBox label="Status" name="status" compact><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option></SelectBox>
        <TextField label="Time" name="taskTime" type="datetime-local" compact />
        <TextField label="Reminder" name="reminder" placeholder="1 hour before" compact />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextAreaField label="Task Description" name="description" compact />
        <TextAreaField label="Notes" name="notes" compact />
      </div>
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
        <SearchableEntitySelect
          label="Customer / Company"
          name="companyId"
          options={[]}
          searchScope="companies"
          placeholder="Search customer"
        />
        <SearchableEntitySelect
          label="Lead"
          name="leadId"
          options={[]}
          searchScope="leads"
          placeholder="Search lead"
        />
        <SelectBox label="Assigned To" name="assignedToId"><EntityOptions workspace={workspace} type="marketers" /></SelectBox>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Industry" name="industry" />
        <TextField label="Company Name" name="companyName" required />
        <TextField label="City / Zilla" name="cityOrZilla" />
        <TextAreaField label="Address" name="address" />
        <TextField label="Primary Phone" name="primaryPhone" />
        <TextField label="Phone 2" name="phone2" />
        <TextField label="Phone 3" name="phone3" />
        <TextField label="Primary Email" name="primaryEmail" type="email" />
        <TextField label="Email 2" name="email2" />
        <TextField label="Website" name="website" />
        <TextAreaField label="Note" name="note" />
        <TextField label="Contact Person 1 Name" name="contactPerson1Name" />
        <TextField label="Designation" name="designation1" />
        <TextField label="Department" name="department1" />
        <TextField label="Phone 1" name="cp1Phone1" />
        <TextField label="Phone 2" name="cp1Phone2" />
        <TextField label="Email 1" name="cp1Email1" />
        <TextField label="Email 2" name="cp1Email2" />
        <TextField label="Contact Person 2 Name" name="contactPerson2Name" />
        <TextField label="Designation" name="designation2" />
        <TextField label="Department" name="department2" />
        <TextField label="Phone 1" name="cp2Phone1" />
        <TextField label="Phone 2" name="cp2Phone2" />
        <TextField label="Email 1" name="cp2Email1" />
        <TextField label="Email 2" name="cp2Email2" />
        <TextField label="Lead Source" name="leadSource" />
      </div>
      <SelectBox label="Assigned Marketer" name="assignedToId"><EntityOptions workspace={workspace} type="marketers" /></SelectBox>
    </ActionForm>
  );
}

type CustomerTemplateEditValues = {
  industry: string;
  companyName: string;
  cityOrZilla: string;
  address: string;
  primaryPhone: string;
  phone2: string;
  phone3: string;
  primaryEmail: string;
  email2: string;
  website: string;
  note: string;
  contactPerson1Name: string;
  designation1: string;
  department1: string;
  cp1Phone1: string;
  cp1Phone2: string;
  cp1Email1: string;
  cp1Email2: string;
  contactPerson2Name: string;
  designation2: string;
  department2: string;
  cp2Phone1: string;
  cp2Phone2: string;
  cp2Email1: string;
  cp2Email2: string;
  leadSource: string;
};

const EMPTY_CUSTOMER_TEMPLATE_VALUES: CustomerTemplateEditValues = {
  industry: "",
  companyName: "",
  cityOrZilla: "",
  address: "",
  primaryPhone: "",
  phone2: "",
  phone3: "",
  primaryEmail: "",
  email2: "",
  website: "",
  note: "",
  contactPerson1Name: "",
  designation1: "",
  department1: "",
  cp1Phone1: "",
  cp1Phone2: "",
  cp1Email1: "",
  cp1Email2: "",
  contactPerson2Name: "",
  designation2: "",
  department2: "",
  cp2Phone1: "",
  cp2Phone2: "",
  cp2Email1: "",
  cp2Email2: "",
  leadSource: "",
};

function buildCustomerTemplateValues(customer: CompanyRow): CustomerTemplateEditValues {
  const raw = parseTemplateRawData(customer.rawData) as Record<string, unknown>;

  return {
    industry: toDisplayValue(readTemplateField(raw, ["Industry", "Business Type", "Sector"])) || toDisplayValue(customer.industry),
    companyName: customer.name || "",
    cityOrZilla: toDisplayValue(readTemplateField(raw, ["City / Zilla", "City/Zilla", "City", "Zilla"])) || toDisplayValue(customer.cityOrZilla),
    address: toDisplayValue(readTemplateField(raw, ["Address", "Company Address"])) || toDisplayValue(customer.address),
    primaryPhone: toDisplayValue(readTemplateField(raw, ["Primary Phone", "Phone", "Phone 1", "Main Phone", "Mobile"])) || toDisplayValue(customer.phone),
    phone2: toDisplayValue(readTemplateField(raw, ["Phone 2", "Secondary Phone", "Phone 2 ", "Second Phone"])) || toDisplayValue(customer.phone2),
    phone3: toDisplayValue(readTemplateField(raw, ["Phone 3", "Phone 3 ", "Tertiary Phone"])),
    primaryEmail: toDisplayValue(readTemplateField(raw, ["Primary Email", "Email", "Email 1", "Primary Email Address", "Email Address"])) || toDisplayValue(customer.email),
    email2: toDisplayValue(readTemplateField(raw, ["Email 2", "Secondary Email", "Email 2 Address"])),
    website: toDisplayValue(readTemplateField(raw, ["Website", "Web", "Web Site"])) || toDisplayValue(customer.website),
    note: toDisplayValue(readTemplateField(raw, ["Note", "Notes", "Remarks"])) || toDisplayValue(customer.notes),
    contactPerson1Name: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Name", "Contact Person Name", "Primary Contact", "Contact Person"])) || toDisplayValue(customer.contactPerson),
    designation1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Designation", "Designation", "Contact Person Designation", "Designation 1"])),
    department1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Department", "Department", "Department 1", "Contact Person Department"])),
    cp1Phone1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Phone 1", "Contact Person 1 Phone", "Contact Person 1 Mobile", "Contact Person 1 Tel", "Phone 1"])),
    cp1Phone2: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Phone 2", "Contact Person 1 Mobile 2", "Phone 2"])),
    cp1Email1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Email 1", "Contact Person 1 Email", "Email 1", "Email"])),
    cp1Email2: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Email 2", "Contact Person 1 Mail", "Email 2"])),
    contactPerson2Name: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Name", "Contact Person 2"])),
    designation2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Designation", "Designation 2"])),
    department2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Department", "Department 2"])),
    cp2Phone1: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Phone 1", "Contact Person 2 Phone", "Contact Person 2 Mobile", "Phone 1 (2)", "Secondary Phone 1"])),
    cp2Phone2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Phone 2", "Secondary Phone 2", "Phone 2 (2)"])),
    cp2Email1: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Email 1", "Contact Person 2 Email", "Email 1 (2)", "Secondary Email 1"])),
    cp2Email2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Email 2", "Contact Person 2 Mail", "Email 2 (2)", "Secondary Email 2"])),
    leadSource: toDisplayValue(readTemplateField(raw, ["Lead Source", "Source"])),
  };
}

function CustomerRowActions({
  customer,
  onView,
  onEdit,
  onDelete,
}: {
  customer: CompanyRow;
  onView: (customer: CompanyRow) => void;
  onEdit: (customer: CompanyRow) => void;
  onDelete: (customer: CompanyRow) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onView(customer)}
        title="View"
        aria-label="View"
        className="h-8 w-8 text-slate-500 transition duration-150 hover:scale-110 hover:bg-blue-50 hover:text-blue-700"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onEdit(customer)}
        title="Edit"
        aria-label="Edit"
        className="h-8 w-8 text-slate-500 transition duration-150 hover:scale-110 hover:bg-slate-100 hover:text-slate-900"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDelete(customer)}
        title="Delete"
        aria-label="Delete"
        className="h-8 w-8 text-red-600 transition duration-150 hover:scale-110 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CustomerViewModal({
  customer,
  open,
  onClose,
}: {
  customer: CompanyRow | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!customer) return null;

  return (
    <FormModal open={open} title="Customer Details" onClose={onClose} panelClassName="max-w-2xl">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <InfoLine label="Company Name" value={customer.name} />
        <InfoLine label="Contact Person" value={customer.contactPerson || "-"} />
        <InfoLine label="Phone" value={customer.phone || "-"} />
        <InfoLine label="WhatsApp" value={customer.whatsapp || "-"} />
        <InfoLine label="Industry" value={customer.industry || "-"} />
        <InfoLine label="Email" value={customer.email || "-"} />
        <InfoLine label="Website" value={customer.website || "-"} />
        <InfoLine label="Address" value={customer.address || "-"} />
        <InfoLine label="Assigned User" value={customer.assignedTo || "-"} />
        <InfoLine label="Lead Count" value={customer.totalLeads} />
        <InfoLine label="Last Communication" value={customer.lastCommunication || "-"} />
        <InfoLine label="Status" value={customer.status || "-"} />
        <InfoLine label="Notes" value={customer.notes || "-"} />
      </div>
      <div className="pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </div>
    </FormModal>
  );
}

function CustomerEditModal({
  customer,
  open,
  onDone,
  onClose,
}: {
  customer: CompanyRow | null;
  open: boolean;
  onDone: (customer: CompanyRow | null) => void;
  onClose: () => void;
}) {
  const [values, setValues] = React.useState<CustomerTemplateEditValues>(EMPTY_CUSTOMER_TEMPLATE_VALUES);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [pendingMessage, setPendingMessage] = React.useState("");

  React.useEffect(() => {
    setValues(customer ? buildCustomerTemplateValues(customer) : EMPTY_CUSTOMER_TEMPLATE_VALUES);
    setMessage("");
    setPendingMessage("");
    setPending(false);
  }, [customer]);

  const updateField = React.useCallback((field: keyof CustomerTemplateEditValues, nextValue: string) => {
    setValues((state) => ({ ...state, [field]: nextValue }));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;

    const normalizedName = values.companyName.trim();
    if (!normalizedName) {
      setMessage("Company Name is required.");
      return;
    }

    setPending(true);
    setMessage("");
    setPendingMessage("Saving...");

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: normalizedName,
          industry: values.industry.trim(),
          cityOrZilla: values.cityOrZilla.trim(),
          address: values.address.trim(),
          primaryPhone: values.primaryPhone.trim(),
          phone2: values.phone2.trim(),
          phone3: values.phone3.trim(),
          primaryEmail: values.primaryEmail.trim(),
          email2: values.email2.trim(),
          website: values.website.trim(),
          note: values.note.trim(),
          contactPerson: values.contactPerson1Name.trim(),
          contactPerson1Name: values.contactPerson1Name.trim(),
          designation1: values.designation1.trim(),
          department1: values.department1.trim(),
          cp1Phone1: values.cp1Phone1.trim(),
          cp1Phone2: values.cp1Phone2.trim(),
          cp1Email1: values.cp1Email1.trim(),
          cp1Email2: values.cp1Email2.trim(),
          contactPerson2Name: values.contactPerson2Name.trim(),
          designation2: values.designation2.trim(),
          department2: values.department2.trim(),
          cp2Phone1: values.cp2Phone1.trim(),
          cp2Phone2: values.cp2Phone2.trim(),
          cp2Email1: values.cp2Email1.trim(),
          cp2Email2: values.cp2Email2.trim(),
          leadSource: values.leadSource.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Customer update failed.");
      }

      const payload = result.customer as Partial<CompanyRow> | undefined;
      onDone({
        ...customer,
        ...payload,
      });
      setPendingMessage("");
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer update failed.");
      setPendingMessage("");
    } finally {
      setPending(false);
    }
  };

  if (!customer) return null;

  return (
    <FormModal open={open} title="Edit Customer" onClose={onClose} panelClassName="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Industry</span>
            <Input
              name="industry"
              value={values.industry}
              onChange={(event) => updateField("industry", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Company Name</span>
            <Input
              name="companyName"
              required
              value={values.companyName}
              onChange={(event) => updateField("companyName", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">City / Zilla</span>
            <Input
              name="cityOrZilla"
              value={values.cityOrZilla}
              onChange={(event) => updateField("cityOrZilla", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Address</span>
            <Input
              name="address"
              value={values.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Primary Phone</span>
            <Input
              name="primaryPhone"
              value={values.primaryPhone}
              onChange={(event) => updateField("primaryPhone", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 2</span>
            <Input
              name="phone2"
              value={values.phone2}
              onChange={(event) => updateField("phone2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 3</span>
            <Input
              name="phone3"
              value={values.phone3}
              onChange={(event) => updateField("phone3", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Primary Email</span>
            <Input
              type="email"
              name="primaryEmail"
              value={values.primaryEmail}
              onChange={(event) => updateField("primaryEmail", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 2</span>
            <Input
              name="email2"
              value={values.email2}
              onChange={(event) => updateField("email2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Website</span>
            <Input
              name="website"
              value={values.website}
              onChange={(event) => updateField("website", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Note</span>
            <textarea
              name="note"
              value={values.note}
              onChange={(event) => updateField("note", event.target.value)}
              className="min-h-16 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Contact Person 1 Name</span>
            <Input
              name="contactPerson1Name"
              value={values.contactPerson1Name}
              onChange={(event) => updateField("contactPerson1Name", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Designation</span>
            <Input
              name="designation1"
              value={values.designation1}
              onChange={(event) => updateField("designation1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Department</span>
            <Input
              name="department1"
              value={values.department1}
              onChange={(event) => updateField("department1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 1</span>
            <Input
              name="cp1Phone1"
              value={values.cp1Phone1}
              onChange={(event) => updateField("cp1Phone1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 2</span>
            <Input
              name="cp1Phone2"
              value={values.cp1Phone2}
              onChange={(event) => updateField("cp1Phone2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 1</span>
            <Input
              name="cp1Email1"
              value={values.cp1Email1}
              onChange={(event) => updateField("cp1Email1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 2</span>
            <Input
              name="cp1Email2"
              value={values.cp1Email2}
              onChange={(event) => updateField("cp1Email2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Contact Person 2 Name</span>
            <Input
              name="contactPerson2Name"
              value={values.contactPerson2Name}
              onChange={(event) => updateField("contactPerson2Name", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Designation</span>
            <Input
              name="designation2"
              value={values.designation2}
              onChange={(event) => updateField("designation2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Department</span>
            <Input
              name="department2"
              value={values.department2}
              onChange={(event) => updateField("department2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 1</span>
            <Input
              name="cp2Phone1"
              value={values.cp2Phone1}
              onChange={(event) => updateField("cp2Phone1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 2</span>
            <Input
              name="cp2Phone2"
              value={values.cp2Phone2}
              onChange={(event) => updateField("cp2Phone2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 1</span>
            <Input
              name="cp2Email1"
              value={values.cp2Email1}
              onChange={(event) => updateField("cp2Email1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 2</span>
            <Input
              name="cp2Email2"
              value={values.cp2Email2}
              onChange={(event) => updateField("cp2Email2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Lead Source</span>
            <Input
              name="leadSource"
              value={values.leadSource}
              onChange={(event) => updateField("leadSource", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
        </div>
        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        {pendingMessage ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">{pendingMessage}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

function ProductForm({ onDone }: { onDone: () => void }) {
  return (
    <ActionForm action={createProductAction} onDone={onDone} submitLabel="Save Product">
      <TextField label="Product / Service Name" name="name" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Category" name="category" required />
        <TextField label="Brand" name="brand" />
        <TextField label="Price" name="price" type="number" defaultValue={0} required />
        <TextField label="Image URL" name="imageUrl" />
      </div>
      <TextAreaField label="Description" name="description" />
      <TextAreaField label="Specification" name="specification" />
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
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<CompanyRow[]>(() => workspace.companies);
  const [viewCustomer, setViewCustomer] = React.useState<CompanyRow | null>(null);
  const [editCustomer, setEditCustomer] = React.useState<CompanyRow | null>(null);
  const [deleteCustomer, setDeleteCustomer] = React.useState<CompanyRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<"xlsx" | "csv" | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  const handleViewCustomer = React.useCallback((customer: CompanyRow) => {
    setViewCustomer(customer);
  }, []);

  const handleEditCustomer = React.useCallback((customer: CompanyRow) => {
    setEditCustomer(customer);
  }, []);

  const handleDeleteCustomer = React.useCallback((customer: CompanyRow) => {
    setDeleteError("");
    setDeleteCustomer(customer);
  }, []);

  const columns = React.useMemo<ColumnDef<CompanyRow>[]>(
    () => [
      { accessorKey: "name", header: "Company Name", cell: ({ row }) => <EntityLink href={`/customers/${row.original.id}`} className="font-bold">{row.original.name}</EntityLink> },
      { accessorKey: "contactPerson", header: "Contact Person" },
      { accessorKey: "phone", header: "Primary Phone" },
      { accessorKey: "phone2", header: "Phone 2" },
      { accessorKey: "email", header: "Primary Email" },
      { accessorKey: "cityOrZilla", header: "City / Zilla" },
      { accessorKey: "address", header: "Address" },
      { accessorKey: "industry", header: "Industry" },
      { accessorKey: "assignedTo", header: "Assigned" },
      {
        id: "Action",
        header: "Action",
        cell: ({ row }) => (
          <CustomerRowActions
            customer={row.original}
            onView={handleViewCustomer}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
          />
        ),
      },
    ],
    [handleViewCustomer, handleDeleteCustomer, handleEditCustomer],
  );

  React.useEffect(() => {
    setCustomers(workspace.companies);
  }, [workspace.companies]);

  React.useEffect(() => {
    if (!feedback) return undefined;

    const timeout = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleImportClick = () => {
    if (importing) return;
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const supportedFile = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
    if (!supportedFile) {
      setFeedback({
        type: "error",
        title: "Import failed",
        message: "Please choose a valid Excel or CSV file.",
      });
      return;
    }

    setImporting(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Customer import failed.");
      }

      setFeedback({
        type: "success",
        title: "Import complete",
        message: `${result.inserted} inserted, ${result.updated} updated, ${result.failed.length} failed.${result.failed.length ? ` First issue: row ${result.failed[0].row} - ${result.failed[0].reason}` : ""}`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        title: "Import failed",
        message: error instanceof Error ? error.message : "Customer import failed.",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (format: "xlsx" | "csv") => {
    setExportMenuOpen(false);
    setExportingFormat(format);
    setFeedback(null);

    try {
      const response = await fetch(`/api/export/all${format === "csv" ? "?format=csv" : ""}`);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message ?? "Full export failed.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const fallbackFileName = `crm_full_export_${new Date().toISOString().slice(0, 10)}.${format === "csv" ? "csv" : "xlsx"}`;
      const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
      const fileName = match?.[1] || fallbackFileName;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        title: "Export ready",
        message: `Full ${format.toUpperCase()} export downloaded successfully.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        title: "Export failed",
        message: error instanceof Error ? error.message : "Customer export failed.",
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCustomer) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/customers/${deleteCustomer.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Customer delete failed.");
      }

      setCustomers((prev) => prev.filter((customer) => customer.id !== deleteCustomer.id));
      setDeleteCustomer(null);
      setFeedback({
        type: "success",
        title: "Customer removed",
        message: "Customer deleted successfully.",
      });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Customer delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditDone = (updatedCustomer: CompanyRow | null) => {
    setEditCustomer(null);
    router.refresh();
    if (updatedCustomer?.id) {
      setCustomers((prev) => prev.map((customer) => customer.id === updatedCustomer.id ? updatedCustomer : customer));
    }
    setFeedback({
      type: "success",
      title: "Customer updated",
      message: "Customer details updated successfully.",
    });
  };

  const handleCreateDone = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title="Customer / Companies"
        description="Central customer records, contacts, industries, assignment, and communication history."
        actions={(
          <>
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleImportClick} disabled={importing}>
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import Excel/CSV"}
            </Button>
            <div ref={exportMenuRef} className="relative">
              <Button type="button" size="sm" variant="outline" disabled={Boolean(exportingFormat)} onClick={() => setExportMenuOpen((open) => !open)}>
                <Download className="h-4 w-4" />
                {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export"}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {exportMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <button type="button" className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" onClick={() => handleExport("xlsx")}>
                    Excel (.xlsx)
                  </button>
                  <button type="button" className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" onClick={() => handleExport("csv")}>
                    CSV
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      />
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
      <AnimatePresence>
        {feedback ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "fixed right-6 top-24 z-40 max-w-sm rounded-2xl border px-4 py-3 shadow-xl",
              feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900",
            )}
          >
            <p className="text-sm font-black">{feedback.title}</p>
            <p className="mt-1 text-xs font-semibold">{feedback.message}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <DataTable data={customers} columns={columns} searchPlaceholder="Search customer..." />
      <FormModal open={open} title="Create Customer / Company" onClose={() => setOpen(false)}>
        <CustomerForm workspace={workspace} onDone={handleCreateDone} />
      </FormModal>
      <CustomerViewModal open={Boolean(viewCustomer)} customer={viewCustomer} onClose={() => setViewCustomer(null)} />
      <CustomerEditModal customer={editCustomer} open={Boolean(editCustomer)} onDone={handleEditDone} onClose={() => setEditCustomer(null)} />
      <FormModal open={Boolean(deleteCustomer)} title="Delete Customer" onClose={() => !deleting && setDeleteCustomer(null)} panelClassName="max-w-md">
        {deleteCustomer ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete this customer?
            </p>
            <p className="text-sm font-black text-slate-900">{deleteCustomer.name}</p>
            {deleteError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{deleteError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteCustomer(null)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </FormModal>
    </>
  );
}

export function CustomerProfilePage({ role, workspace, customer, history }: { role: Role; workspace: CrmWorkspace; customer?: CompanyRow; history: CustomerHistory }) {
  const active = customer;
  const rawData = React.useMemo<Record<string, unknown>>(() => {
    if (active?.rawData && typeof active.rawData === "object" && !Array.isArray(active.rawData)) {
      return active.rawData as Record<string, unknown>;
    }

    return {};
  }, [active?.rawData]);
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
        <StatCard title="Communication" value={String(history.communications.length)} helper="Company activity log" icon={MessageSquare} tone="bg-indigo-100 text-indigo-700" />
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
          {(value) => {
            if (value === "overview") {
              return (
                <div className="grid gap-4">
                  <Card className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Company Information</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <InfoLine label="SL" value={readRawValue(rawData, ["SL", "Serial", "Serial Number"]) || "-"} />
                      <InfoLine label="Company Name" value={active.name} />
                      <InfoLine label="Industry" value={readRawValue(rawData, ["Industry"]) || active.industry || "-"} />
                      <InfoLine label="City/Zilla" value={readRawValue(rawData, ["City / Zilla", "City/Zilla", "City", "Zilla"]) || "-"} />
                      <InfoLine label="Address" value={readRawValue(rawData, ["Address"]) || active.address || "-"} />
                      <InfoLine label="Website" value={readRawValue(rawData, ["Website"]) || active.website || "-"} />
                      <InfoLine label="Note" value={readRawValue(rawData, ["Note", "Notes"]) || active.notes || "-"} />
                    </div>
                  </Card>
                  <Card className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Primary Contacts</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <InfoLine label="Primary Phone" value={active.phone || readRawValue(rawData, ["Primary Phone", "Phone", "Phone 1"]) || "-"} />
                      <InfoLine label="Phone 2" value={readRawValue(rawData, ["Phone 2"]) || "-"} />
                      <InfoLine label="Phone 3" value={readRawValue(rawData, ["Phone 3"]) || "-"} />
                      <InfoLine label="Primary Email" value={active.email || readRawValue(rawData, ["Primary Email", "Email 1", "Email"]) || "-"} />
                      <InfoLine label="Email 2" value={readRawValue(rawData, ["Email 2"]) || "-"} />
                    </div>
                  </Card>
                  <Card className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Contact Person 1</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <InfoLine label="Name" value={readRawValue(rawData, ["Contact Person 1 Name"]) || active.contactPerson || "-"} />
                      <InfoLine label="Designation" value={readRawValue(rawData, ["Contact Person 1 Designation", "Designation"]) || "-"} />
                      <InfoLine label="Department" value={readRawValue(rawData, ["Contact Person 1 Department", "Department"]) || "-"} />
                      <InfoLine label="Phones" value={readRawValue(rawData, ["Contact Person 1 Phone", "Contact Person 1 Mobile", "Contact Person 1 Phone No"]) || "-"} />
                      <InfoLine label="Emails" value={readRawValue(rawData, ["Contact Person 1 Email", "Contact Person 1 Mail"]) || "-"} />
                    </div>
                  </Card>
                  <Card className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Contact Person 2</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <InfoLine label="Name" value={readRawValue(rawData, ["Contact Person 2 Name"]) || "-"} />
                      <InfoLine label="Designation" value={readRawValue(rawData, ["Contact Person 2 Designation"]) || "-"} />
                      <InfoLine label="Department" value={readRawValue(rawData, ["Contact Person 2 Department"]) || "-"} />
                      <InfoLine label="Phones" value={readRawValue(rawData, ["Contact Person 2 Phone", "Contact Person 2 Mobile"]) || "-"} />
                      <InfoLine label="Emails" value={readRawValue(rawData, ["Contact Person 2 Email", "Contact Person 2 Mail"]) || "-"} />
                    </div>
                  </Card>
                  <Card className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Lead Information</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <InfoLine label="Lead Source" value={readRawValue(rawData, ["Lead Source"]) || "-"} />
                    </div>
                  </Card>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoLine label="Total Leads" value={active.totalLeads} />
                    <InfoLine label="Task History" value={history.tasks.length} />
                    <InfoLine label="Follow-up Records" value={history.followUps.length} />
                    <InfoLine label="Timeline Activity" value={history.activities.length} />
                  </div>
                  <DashboardCard title="Task History">
                    <TaskHistoryList rows={history.tasks} />
                  </DashboardCard>
                  <DashboardCard title="Follow-up History">
                    <FollowUpHistoryList rows={history.followUps} />
                  </DashboardCard>
                </div>
              );
            }

            if (value === "timeline") {
              return <Timeline rows={history.activities} />;
            }

            if (value === "communication") {
              return <CommunicationHistoryList rows={history.communications} />;
            }

            if (value === "followups") {
              return <FollowUpHistoryList rows={history.followUps} />;
            }

            return <Timeline rows={history.activities} />;
          }}
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

export function TodaysPlanPage({ workspace }: { workspace: CrmWorkspace }) {
  return <TodayTasksExecutionView role="MARKETER" workspace={workspace} />;
}

type TodayTaskPriorityFilter = "ALL" | "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";

type TodayTaskApiRow = {
  id: string;
  title: string;
  companyName: string;
  companyId?: string | null;
  companyHref?: string | null;
  description: string;
  assignedToId: string;
  assignedTo: string;
  assignedById: string;
  assignedBy: string;
  assignedByRole: string;
  assignedAtIso: string;
  assignedAtLabel: string;
  priority: "Important" | "High" | "Medium" | "Low";
  priorityKey: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  status: "Pending" | "Completed";
  statusKey: "PENDING" | "COMPLETED";
  taskDateIso: string;
  taskDateLabel: string;
  timeLabel: string;
  isPrevious: boolean;
  completedAtIso?: string | null;
  completedAtLabel: string;
  completedBy: string;
};

function todayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeLocalValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function taskPriorityTone(priority: TodayTaskApiRow["priorityKey"]) {
  if (priority === "IMPORTANT") return "border-orange-200 bg-orange-50 text-orange-700";
  if (priority === "HIGH") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "LOW") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function sortActiveTasks(rows: TodayTaskApiRow[]) {
  return [...rows].sort((left, right) => {
    if (left.isPrevious !== right.isPrevious) return left.isPrevious ? -1 : 1;
    return new Date(left.taskDateIso).getTime() - new Date(right.taskDateIso).getTime();
  });
}

function sortCompletedTasks(rows: TodayTaskApiRow[]) {
  return [...rows].sort((left, right) => {
    const leftTime = left.completedAtIso ? new Date(left.completedAtIso).getTime() : 0;
    const rightTime = right.completedAtIso ? new Date(right.completedAtIso).getTime() : 0;
    return rightTime - leftTime;
  });
}

function TaskPriorityBadge({ priority }: { priority: TodayTaskApiRow["priorityKey"] }) {
  const label = priority === "IMPORTANT" ? "Important" : priority === "HIGH" ? "High" : priority === "LOW" ? "Low" : "Medium";
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black", taskPriorityTone(priority))}>{label}</span>;
}

function TaskCreateModal({
  open,
  onClose,
  onCreated,
  role,
  workspace,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (row: TodayTaskApiRow) => void;
  role: Role;
  workspace: CrmWorkspace;
}) {
  const [title, setTitle] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState("");
  const [priority, setPriority] = React.useState<TodayTaskPriorityFilter>("MEDIUM");
  const [taskDate, setTaskDate] = React.useState(todayDateValue());
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const canAssign = role === "ADMIN" || role === "SUPERVISOR";
  const marketerOptions = React.useMemo(() => workspace.employees.filter((item) => item.role === "Marketer"), [workspace.employees]);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setCompanyName("");
    setDescription("");
    setAssignedToId("");
    setPriority("MEDIUM");
    setTaskDate(todayDateValue());
    setMessage("");
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, companyName, description, assignedToId: canAssign ? assignedToId : undefined, priority, taskDate }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Task creation failed.");
      }

      onCreated(result.row as TodayTaskApiRow);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Task creation failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <FormModal open={open} title="Add Task" onClose={onClose} panelClassName="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Task Title</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Call Prime Academy" required />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Company Name</span>
          <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Prime Academy" required />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Task Details</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should the marketer do?"
            className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {canAssign ? (
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Assign To Marketer</span>
              <select
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                required
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select marketer</option>
                {marketerOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TodayTaskPriorityFilter)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Date</span>
            <Input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} required />
          </label>
        </div>
        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Task"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

function TaskCompleteConfirmModal({
  task,
  pending,
  message,
  onClose,
  onConfirm,
}: {
  task: TodayTaskApiRow | null;
  pending: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <FormModal open={Boolean(task)} title="Complete Task" onClose={onClose} panelClassName="max-w-md">
      {task ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">{task.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{task.companyName}</p>
          </div>
          <p className="text-sm text-slate-600">Are you sure to complete this task?</p>
          {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onConfirm} disabled={pending}>
              {pending ? <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Completing...</span> : "Complete Task"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </FormModal>
  );
}

function TaskFollowUpModal({
  task,
  workspace,
  onClose,
  onSaved,
}: {
  task: TodayTaskApiRow | null;
  workspace: CrmWorkspace;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <FormModal open={Boolean(task)} title="Add Follow-up" onClose={onClose} panelClassName="max-w-xl">
      {task ? (
        <ActionForm action={createFollowUpAction} onDone={onSaved} submitLabel="Save Follow-up">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-900">{task.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{task.companyName}</p>
          </div>
          <input type="hidden" name="taskId" value={task.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableEntitySelect
              label="Customer / Company"
              name="companyId"
              options={[]}
              searchScope="companies"
              defaultValue={task.companyId ?? ""}
              defaultLabel={task.companyName}
              placeholder="Search customer"
            />
            <SearchableEntitySelect
              label="Lead"
              name="leadId"
              options={[]}
              searchScope="leads"
              placeholder="Search lead"
            />
            <SelectBox label="Assigned To" name="assignedToId">
              <EntityOptions workspace={workspace} type="users" />
            </SelectBox>
            <SelectBox label="Method" name="method">
              <option>Phone Call</option>
              <option>WhatsApp</option>
              <option>Email</option>
              <option>Physical Visit</option>
              <option>Meeting</option>
            </SelectBox>
          </div>
          <TextField label="Follow-up Date" name="followUpDate" type="datetime-local" defaultValue={dateTimeLocalValue()} />
          <TextAreaField label="Follow-up Note" name="note" required />
          <TextAreaField label="Next Discussion Plan" name="nextDiscussionPlan" />
        </ActionForm>
      ) : null}
    </FormModal>
  );
}

function TodayTasksExecutionView({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [pendingComplete, setPendingComplete] = React.useState(false);
  const [activeTasks, setActiveTasks] = React.useState<TodayTaskApiRow[]>([]);
  const [completedTasks, setCompletedTasks] = React.useState<TodayTaskApiRow[]>([]);
  const [confirmTask, setConfirmTask] = React.useState<TodayTaskApiRow | null>(null);
  const [followUpTask, setFollowUpTask] = React.useState<TodayTaskApiRow | null>(null);

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [todayResponse, completedResponse] = await Promise.all([
        fetch("/api/tasks/today", { cache: "no-store" }),
        fetch("/api/tasks/completed", { cache: "no-store" }),
      ]);

      const [todayResult, completedResult] = await Promise.all([
        todayResponse.json(),
        completedResponse.json(),
      ]);

      if (!todayResponse.ok) {
        throw new Error(typeof todayResult.message === "string" ? todayResult.message : "Failed to load today tasks.");
      }

      if (!completedResponse.ok) {
        throw new Error(typeof completedResult.message === "string" ? completedResult.message : "Failed to load completed tasks.");
      }

      setActiveTasks(sortActiveTasks(todayResult.rows as TodayTaskApiRow[]));
      setCompletedTasks(sortCompletedTasks(completedResult.rows as TodayTaskApiRow[]));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleCreated = (row: TodayTaskApiRow) => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const visibleToday = new Date(row.taskDateIso) <= endOfToday;

    if (visibleToday) {
      setActiveTasks((prev) => sortActiveTasks([row, ...prev.filter((item) => item.id !== row.id)]));
    }

    void loadTasks();
  };

  const handleConfirmComplete = async () => {
    if (!confirmTask) return;

    const task = confirmTask;
    const optimisticCompleted: TodayTaskApiRow = {
      ...task,
      status: "Completed",
      statusKey: "COMPLETED",
      isPrevious: false,
      completedAtIso: new Date().toISOString(),
      completedAtLabel: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      completedBy: "You",
    };

    const previousActive = activeTasks;
    const previousCompleted = completedTasks;

    setPendingComplete(true);
    setActionError("");
    setActiveTasks((prev) => prev.filter((item) => item.id !== task.id));
    setCompletedTasks((prev) => sortCompletedTasks([optimisticCompleted, ...prev.filter((item) => item.id !== task.id)]));

    try {
      const response = await fetch(`/api/tasks/complete/${task.id}`, {
        method: "PATCH",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Task completion failed.");
      }

      const completedRow = result.row as TodayTaskApiRow;
      setCompletedTasks((prev) => sortCompletedTasks([completedRow, ...prev.filter((item) => item.id !== completedRow.id)]));
      setConfirmTask(null);
      setFollowUpTask(completedRow);
    } catch (error) {
      setActiveTasks(previousActive);
      setCompletedTasks(previousCompleted);
      setActionError(error instanceof Error ? error.message : "Task completion failed.");
    } finally {
      setPendingComplete(false);
    }
  };

  const pendingCount = activeTasks.length;
  const completedCount = completedTasks.length;

  return (
    <>
      <PageHeader
        title="Today's Tasks"
        description="All assigned tasks, follow-ups and overdue work in one view."
        actions={pageActions([{ label: "Add Task", icon: Plus, variant: "default", onClick: () => setOpen(true) }])}
      />

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {actionError ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</p> : null}

      <DashboardCard
        title="Today's Tasks"
        action={<Badge variant={activeTasks.some((task) => task.isPrevious) ? "warning" : "neutral"}>{pendingCount} Pending</Badge>}
      >
        <div className="space-y-3">
          {loading ? (
            <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              Loading tasks...
            </p>
          ) : activeTasks.length ? (
            <AnimatePresence initial={false}>
              {activeTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "grid gap-3 rounded-xl border px-4 py-3 lg:grid-cols-[minmax(0,1fr)_140px_260px] lg:items-center",
                    task.isPrevious ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {
                        setActionError("");
                        setConfirmTask(task);
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Complete ${task.title}`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                        {task.isPrevious ? (
                          <>
                            <Badge variant="danger">Overdue</Badge>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-red-700 ring-1 ring-red-100">
                              Previous Task
                            </span>
                          </>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        <EntityLink href={task.companyHref} className="text-xs font-semibold">{task.companyName}</EntityLink>
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        Assigned by {task.assignedBy} ({task.assignedByRole}) - {task.assignedAtLabel}
                      </p>
                      {task.description !== "-" ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p> : null}
                    </div>
                  </div>
                  <div className="lg:justify-self-start">
                    <TaskPriorityBadge priority={task.priorityKey} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                    <p className="text-sm font-bold text-slate-700">
                      {task.taskDateLabel}
                      <span className="ml-2 text-xs font-black text-slate-500">{task.timeLabel}</span>
                    </p>
                    <Button type="button" size="sm" disabled={pendingComplete && confirmTask?.id === task.id} onClick={() => { setActionError(""); setConfirmTask(task); }}>
                      Complete
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No pending tasks match this view.</p>
          )}
        </div>
      </DashboardCard>

      <DashboardCard title="Completed Tasks" action={<Badge variant="neutral">{completedCount} Completed</Badge>}>
        <div className="space-y-3">
          {loading ? (
            <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              Loading completed tasks...
            </p>
          ) : completedTasks.length ? completedTasks.map((task) => (
            <div key={task.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  <EntityLink href={task.companyHref} className="text-xs font-semibold">{task.companyName}</EntityLink>
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Assigned by {task.assignedBy} ({task.assignedByRole}) - {task.assignedAtLabel}
                </p>
                {task.description !== "-" ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p> : null}
              </div>
              <p className="text-xs font-bold text-slate-500 md:text-right">{task.completedAtLabel}</p>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setFollowUpTask(task)}>
                <Plus className="h-3.5 w-3.5" />
                Add Follow-up
              </Button>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-4 w-4" />
              </span>
            </div>
          )) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No completed tasks yet.</p>
          )}
        </div>
      </DashboardCard>

      <TaskCreateModal open={open} onClose={() => setOpen(false)} onCreated={handleCreated} role={role} workspace={workspace} />
      <TaskCompleteConfirmModal
        task={confirmTask}
        pending={pendingComplete}
        message={actionError}
        onClose={() => {
          if (pendingComplete) return;
          setConfirmTask(null);
          setActionError("");
        }}
        onConfirm={handleConfirmComplete}
      />
      <TaskFollowUpModal
        task={followUpTask}
        workspace={workspace}
        onClose={() => setFollowUpTask(null)}
        onSaved={() => setFollowUpTask(null)}
      />
    </>
  );
}

export function TasksPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  return <TodayTasksExecutionView role={role} workspace={workspace} />;
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
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <PageHeader title="Product / Services" description="Products and opportunity analytics by interested customers, follow-ups, sales, and conversion." actions={role === "ADMIN" ? pageActions([{ label: "Add Product", icon: Plus, variant: "default", onClick: () => setOpen(true) }]) : undefined} />
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
      {!workspace.products.length ? <EmptyState title="No products yet" description="Create your real product or service catalog to start tracking opportunities." /> : null}
      <FormModal title="Create Product / Service" open={open} onClose={() => setOpen(false)}>
        <ProductForm onDone={() => setOpen(false)} />
      </FormModal>
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
  const [createOpen, setCreateOpen] = React.useState(false);
  const headerActions = role === "ADMIN"
    ? pageActions([{ label: "Add Employee", icon: Plus, variant: "default", href: "/admin/users" }])
    : role === "SUPERVISOR"
      ? pageActions([{ label: "Create Marketer", icon: Plus, variant: "default", onClick: () => setCreateOpen(true) }])
      : undefined;

  return (
    <>
      <PageHeader title="Team Management" description="Monitor employees, activity level, sales, and reward performance." actions={headerActions} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Employees" value={String(workspace.employees.length)} helper="Team users" icon={UserPlus} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Active Employees" value={String(workspace.employees.filter((item) => item.status === "Active").length)} helper="Currently active" icon={Check} tone="bg-emerald-100 text-emerald-700" />
        <StatCard title="Best Performer" value={workspace.employees[0]?.name ?? "-"} helper={`${workspace.employees[0]?.rewardPoints ?? 0} reward points`} icon={WalletCards} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Low Activity" value={String(workspace.employees.filter((item) => item.leads === 0).length)} helper="Needs coaching" icon={Settings} tone="bg-red-100 text-red-700" />
      </div>
      <Card className="p-5"><TeamManagementTable workspace={workspace} /></Card>
      <DetailsDrawer title="Employee Profile" open={drawerOpen} onClose={() => setDrawerOpen(false)}><p className="text-sm text-slate-500">Employee detail drawer is ready for selected employee context.</p></DetailsDrawer>
      <FormModal title="Create Marketer" open={createOpen} onClose={() => setCreateOpen(false)}>
        <ActionForm action={createUserAction} onDone={() => setCreateOpen(false)} submitLabel="Create Marketer">
          <input type="hidden" name="role" value="MARKETER" />
          <TextField label="Full Name" name="name" required />
          <TextField label="Email" name="email" type="email" required />
          <TextField label="Mobile Number (Optional)" name="mobile" />
          <TextField label="Designation" name="designation" defaultValue="Sales Marketer" />
        </ActionForm>
      </FormModal>
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
          <TextField label="Email" name="email" type="email" required />
          <TextField label="Mobile Number (Optional)" name="mobile" />
          <TextField label="Designation" name="designation" />
          <SelectBox label="Role" name="role" defaultValue="MARKETER"><option value="MARKETER">Marketer</option><option value="SUPERVISOR">Supervisor</option></SelectBox>
          <SelectBox label="Supervisor" name="supervisorId"><EntityOptions workspace={workspace} type="supervisors" /></SelectBox>
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
