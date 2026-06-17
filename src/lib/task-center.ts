import { Priority, TaskStatus } from "@prisma/client";
import { format } from "date-fns";
import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/utils";

export type TaskActor = {
  id: string;
  role: Role;
  name?: string;
};

export type TaskPriorityFilter = "ALL" | "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";

export type TaskFilters = {
  priority?: TaskPriorityFilter;
  company?: string;
};

export type TaskListItem = {
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

const taskQueryInclude = {
  company: true,
  assignedTo: true,
  assignedBy: true,
  completedBy: true,
} as const;

type TaskQueryRecord = {
  id: string;
  title: string;
  companyName: string | null;
  description: string | null;
  companyId: string | null;
  taskTime: Date | null;
  assignedToId: string | null;
  assignedById: string | null;
  completedById: string | null;
  priority: Priority;
  status: TaskStatus;
  taskDate: Date;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isPrevious: boolean;
  company: { name: string } | null;
  assignedTo: { name: string; role: string | null } | null;
  assignedBy: { name: string; role: string | null } | null;
  completedBy: { name: string } | null;
};

export class TaskInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TaskInputError";
    this.status = status;
  }
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfTomorrow() {
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function formatDate(date: Date | null | undefined) {
  return date ? format(date, "dd MMM yyyy") : "-";
}

function formatDateTime(date: Date | null | undefined) {
  return date ? format(date, "dd MMM yyyy hh:mm a") : "-";
}

function formatTime(date: Date | null | undefined) {
  if (!date) return "All day";
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
    return "All day";
  }
  return format(date, "hh:mm a");
}

function toPriorityLabel(priority: Priority): TaskListItem["priority"] {
  if (priority === "URGENT") return "Important";
  if (priority === "HIGH") return "High";
  if (priority === "LOW") return "Low";
  return "Medium";
}

function toPriorityKey(priority: Priority): TaskListItem["priorityKey"] {
  if (priority === "URGENT") return "IMPORTANT";
  return priority;
}

function toPrismaPriority(priority: TaskPriorityFilter | undefined) {
  if (!priority || priority === "ALL") return undefined;
  if (priority === "IMPORTANT") return "URGENT" as const;
  return priority;
}

function taskDisplayStatus(status: TaskStatus): TaskListItem["status"] {
  return status === "COMPLETED" ? "Completed" : "Pending";
}

function taskStatusKey(status: TaskStatus): TaskListItem["statusKey"] {
  return status === "COMPLETED" ? "COMPLETED" : "PENDING";
}

function effectiveTaskDate(task: Pick<TaskQueryRecord, "taskDate" | "dueDate" | "createdAt">) {
  return task.taskDate ?? task.dueDate ?? task.createdAt;
}

function companyDisplayName(task: TaskQueryRecord) {
  return task.company?.name ?? task.companyName ?? "Unknown Company";
}

function roleLabel(role: string | null | undefined) {
  if (!role) return "-";
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapTaskRecord(task: TaskQueryRecord): TaskListItem {
  const today = startOfToday();
  const baseDate = effectiveTaskDate(task);
  const isPrevious = task.status !== "COMPLETED" && (task.isPrevious || baseDate < today);

  return {
    id: task.id,
    title: task.title,
    companyName: companyDisplayName(task),
    companyId: task.companyId,
    companyHref: task.companyId ? `/customers/${task.companyId}` : null,
    description: task.description ?? "-",
    assignedToId: task.assignedToId ?? "",
    assignedTo: task.assignedTo?.name ?? "-",
    assignedById: task.assignedById ?? "",
    assignedBy: task.assignedBy?.name ?? "-",
    assignedByRole: roleLabel(task.assignedBy?.role),
    assignedAtIso: task.createdAt.toISOString(),
    assignedAtLabel: formatDateTime(task.createdAt),
    priority: toPriorityLabel(task.priority),
    priorityKey: toPriorityKey(task.priority),
    status: taskDisplayStatus(task.status),
    statusKey: taskStatusKey(task.status),
    taskDateIso: baseDate.toISOString(),
    taskDateLabel: formatDate(baseDate),
    timeLabel: formatTime(task.taskTime ?? baseDate),
    isPrevious,
    completedAtIso: task.updatedAt.toISOString(),
    completedAtLabel: formatDateTime(task.updatedAt),
    completedBy: task.completedBy?.name ?? "-",
  };
}

function parseCompanyFilter(company?: string) {
  const value = company?.trim();
  if (!value) return undefined;

  return {
    OR: [
      { companyName: { contains: value, mode: "insensitive" as const } },
      { company: { is: { name: { contains: value, mode: "insensitive" as const } } } },
    ],
  } as Record<string, unknown>;
}

export function parseTaskDateInput(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getTaskScopeUserIds(prisma: ReturnType<typeof getPrisma>, actor: TaskActor) {
  if (actor.role === "ADMIN") return undefined;
  if (actor.role === "MARKETER") return [actor.id];

  const team = await prisma.user.findMany({
    where: { supervisorId: actor.id, status: "ACTIVE" },
    select: { id: true },
  });

  return [actor.id, ...team.map((member) => member.id)];
}

async function scopedTaskWhere(prisma: ReturnType<typeof getPrisma>, actor: TaskActor) {
  if (actor.role === "ADMIN") return {};
  if (actor.role === "MARKETER") return { assignedToId: actor.id };

  const scopedIds = await getTaskScopeUserIds(prisma, actor);
    return {
      OR: [
        { assignedToId: { in: scopedIds } },
        { assignedById: actor.id },
      ],
    };
}

async function resolveAssignedMarketer(prisma: ReturnType<typeof getPrisma>, actor: TaskActor, assignedToId?: string) {
  if (actor.role === "MARKETER") {
    return actor.id;
  }

  if (!assignedToId) {
    throw new TaskInputError("Assigned marketer is required.");
  }

  const assignee = await prisma.user.findFirst({
    where: {
      id: assignedToId,
      role: "MARKETER",
      status: "ACTIVE",
      ...(actor.role === "SUPERVISOR" ? { supervisorId: actor.id } : {}),
    },
    select: { id: true },
  });

  if (!assignee) {
    throw new TaskInputError(
      actor.role === "SUPERVISOR" ? "Selected marketer is not in your team." : "Selected marketer was not found.",
      403,
    );
  }

  return assignee.id;
}

async function addTaskActivity(prisma: ReturnType<typeof getPrisma>, input: {
  userId: string;
  taskId: string;
  companyId?: string | null;
  title: string;
  description: string;
}) {
  await prisma.activityTimeline.create({
    data: {
      title: input.title,
      description: input.description,
      entity: "Task",
      entityId: input.taskId,
      userId: input.userId,
      taskId: input.taskId,
      companyId: input.companyId ?? undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: input.title,
      entity: "Task",
      entityId: input.taskId,
    },
  });
}

export async function syncPreviousTaskFlags() {
  const prisma = getPrisma();
  const today = startOfToday();

  await prisma.task.updateMany({
    where: {
      status: { not: "COMPLETED" },
      taskDate: { lt: today },
      isPrevious: false,
    },
    data: {
      isPrevious: true,
    },
  });

  await prisma.task.updateMany({
    where: {
      isPrevious: true,
      OR: [
        { status: "COMPLETED" },
        { taskDate: { gte: today } },
      ],
    },
    data: {
      isPrevious: false,
    },
  });
}

export async function getTodayTasks(actor: TaskActor, filters: TaskFilters = {}) {
  const prisma = getPrisma();
  await syncPreviousTaskFlags();

  const tomorrow = startOfTomorrow();
    const where: Record<string, unknown> = {
    AND: [
      await scopedTaskWhere(prisma, actor),
      { status: "PENDING" },
      { taskDate: { lt: tomorrow } },
      ...(toPrismaPriority(filters.priority) ? [{ priority: toPrismaPriority(filters.priority) }] : []),
      ...(parseCompanyFilter(filters.company) ? [parseCompanyFilter(filters.company)!] : []),
    ],
  };

  const tasks = await prisma.task.findMany({
    where,
    include: taskQueryInclude,
    orderBy: [
      { isPrevious: "desc" },
      { taskDate: "asc" },
      { updatedAt: "desc" },
    ],
  });

  return tasks.map(mapTaskRecord);
}

export async function getCompletedTasks(actor: TaskActor, filters: TaskFilters = {}) {
  const prisma = getPrisma();
  await syncPreviousTaskFlags();

  const where: Record<string, unknown> = {
    AND: [
      await scopedTaskWhere(prisma, actor),
      { status: "COMPLETED" },
      ...(toPrismaPriority(filters.priority) ? [{ priority: toPrismaPriority(filters.priority) }] : []),
      ...(parseCompanyFilter(filters.company) ? [parseCompanyFilter(filters.company)!] : []),
    ],
  };

  const tasks = await prisma.task.findMany({
    where,
    include: taskQueryInclude,
    orderBy: [
      { completedAt: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return tasks.map(mapTaskRecord);
}

export async function createTaskEntry(actor: TaskActor, input: {
  title: string;
  companyName: string;
  description?: string;
  priority: TaskPriorityFilter;
  taskDate: Date;
  assignedToId?: string;
}) {
  const prisma = getPrisma();
  const today = startOfToday();
  const normalizedTitle = normalizeText(input.title);
  const normalizedCompany = normalizeText(input.companyName);
  const taskDate = new Date(input.taskDate);
  taskDate.setHours(0, 0, 0, 0);
  const assignedToId = await resolveAssignedMarketer(prisma, actor, input.assignedToId);

  const matchedCompany = await prisma.customerCompany.findFirst({
    where: { name: { equals: normalizedCompany, mode: "insensitive" } },
    select: { id: true },
  });

  const task = await prisma.task.create({
    data: {
      title: normalizedTitle,
      description: input.description ? normalizeText(input.description) : undefined,
      companyName: normalizedCompany,
      priority: toPrismaPriority(input.priority) ?? "MEDIUM",
      status: "PENDING",
      taskDate,
      dueDate: taskDate,
      isPrevious: taskDate < today,
      assignedBy: { connect: { id: actor.id } },
      assignedTo: { connect: { id: assignedToId } },
      ...(matchedCompany ? { company: { connect: { id: matchedCompany.id } } } : {}),
    },
    include: taskQueryInclude,
  });

  await addTaskActivity(prisma, {
    userId: actor.id,
    taskId: task.id,
    companyId: task.companyId,
    title: "Task Created",
    description: `${task.title} assigned to ${task.assignedTo?.name ?? "marketer"}`,
  });

  if (assignedToId !== actor.id) {
    await prisma.notification.create({
      data: {
        recipientId: assignedToId,
        title: "Task Assigned",
        message: task.title,
        type: "TASK_ASSIGNED",
        entity: "Task",
        entityId: task.id,
      },
    });
  }

  return mapTaskRecord(task);
}

export async function completeTaskEntry(actor: TaskActor, taskId: string) {
  const prisma = getPrisma();
  await syncPreviousTaskFlags();

  const task = await prisma.task.findFirst({
    where: {
      AND: [
        await scopedTaskWhere(prisma, actor),
        { id: taskId },
      ],
    },
    include: taskQueryInclude,
  });

  if (!task) {
    throw new Error("Task not found or you do not have access.");
  }

  if (task.status === "COMPLETED") {
    throw new Error("This task is already completed.");
  }

  const completedAt = new Date();
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt,
      completedById: actor.id,
      isPrevious: false,
    },
    include: taskQueryInclude,
  });

  await addTaskActivity(prisma, {
    userId: actor.id,
    taskId: updated.id,
    companyId: updated.companyId,
    title: "Task Completed",
    description: `${updated.title} marked completed`,
  });

  if (updated.assignedById) {
    await prisma.notification.create({
      data: {
        recipientId: updated.assignedById,
        title: "Task Completed",
        message: updated.title,
        type: "TASK_COMPLETED",
        entity: "Task",
        entityId: updated.id,
      },
    });
  }

  return mapTaskRecord(updated);
}
