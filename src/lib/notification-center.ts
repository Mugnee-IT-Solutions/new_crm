import { format, isBefore, startOfDay } from "date-fns";
import type { NotificationType } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/utils";

type RequestUser = {
  id: string;
  role: Role;
  name?: string | null;
};

export type HeaderNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  href: string;
  read: boolean;
  createdAt: string;
};

function rolePath(role: Role, section: string) {
  const prefix = role === "ADMIN" ? "admin" : role === "SUPERVISOR" ? "supervisor" : "marketer";
  return `/${prefix}/${section}`;
}

function notificationFallbackHref(role: Role) {
  return role === "ADMIN" ? rolePath(role, "notifications") : rolePath(role, "communication");
}

function notificationHref(user: RequestUser, input: {
  entity?: string | null;
  entityId?: string | null;
  followUpLeadId?: string | null;
  followUpCompanyId?: string | null;
}) {
  if (input.followUpLeadId) return `/leads/${input.followUpLeadId}`;
  if (input.followUpCompanyId) return `/customers/${input.followUpCompanyId}`;
  if (input.entity === "Task") return rolePath(user.role, "tasks");
  if (input.entity === "FollowUp") return rolePath(user.role, "follow-ups");
  return notificationFallbackHref(user.role);
}

function formatNotificationType(type: string) {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function taskDueAt(task: { taskTime: Date | null; dueDate: Date | null; taskDate: Date }) {
  return task.taskTime ?? task.dueDate ?? task.taskDate;
}

async function syncDueNotifications(user: RequestUser) {
  const prisma = getPrisma();
  const now = new Date();
  const today = startOfDay(now);

  const [dueFollowUps, overdueTasks] = await Promise.all([
    prisma.followUp.findMany({
      where: {
        assignedToId: user.id,
        status: { not: "COMPLETED" },
        followUpDate: { lte: now },
      },
      select: {
        id: true,
        note: true,
        method: true,
        status: true,
        followUpDate: true,
      },
      take: 100,
    }),
    prisma.task.findMany({
      where: {
        assignedToId: user.id,
        status: { not: "COMPLETED" },
      },
      select: {
        id: true,
        title: true,
        taskDate: true,
        dueDate: true,
        taskTime: true,
      },
      take: 100,
    }),
  ]);

  const overdueTaskRows = overdueTasks.filter((task) => isBefore(taskDueAt(task), now));
  const existing = await prisma.notification.findMany({
    where: {
      recipientId: user.id,
      OR: [
        ...(dueFollowUps.length
          ? [
              {
                type: { in: ["FOLLOW_UP_REMINDER", "FOLLOW_UP_OVERDUE"] as NotificationType[] },
                followUpId: { in: dueFollowUps.map((item) => item.id) },
              },
            ]
          : []),
        ...(overdueTaskRows.length
          ? [
              {
                type: "SYSTEM_ALERT" as NotificationType,
                entity: "Task",
                entityId: { in: overdueTaskRows.map((item) => item.id) },
              },
            ]
          : []),
      ],
    },
    select: {
      type: true,
      followUpId: true,
      entityId: true,
    },
  });

  const existingFollowUpKeys = new Set(
    existing
      .filter((item) => item.followUpId)
      .map((item) => `${item.type}:${item.followUpId}`),
  );
  const existingTaskKeys = new Set(
    existing
      .filter((item) => item.entityId)
      .map((item) => `${item.type}:${item.entityId}`),
  );

  const notificationsToCreate = [
    ...dueFollowUps.flatMap((followUp) => {
      const type: NotificationType = isBefore(followUp.followUpDate, today) ? "FOLLOW_UP_OVERDUE" : "FOLLOW_UP_REMINDER";
      const key = `${type}:${followUp.id}`;
      if (existingFollowUpKeys.has(key)) return [];
      return [{
        recipientId: user.id,
        title: type === "FOLLOW_UP_OVERDUE" ? "Overdue Follow-up" : "Follow-up Due",
        message: followUp.note?.trim() || `${followUp.method} follow-up is due.`,
        type,
        entity: "FollowUp",
        entityId: followUp.id,
        followUpId: followUp.id,
      }];
    }),
    ...overdueTaskRows.flatMap((task) => {
      const key = `SYSTEM_ALERT:${task.id}`;
      if (existingTaskKeys.has(key)) return [];
      return [{
        recipientId: user.id,
        title: "Overdue Task",
        message: task.title,
        type: "SYSTEM_ALERT" as const,
        entity: "Task",
        entityId: task.id,
      }];
    }),
  ];

  if (notificationsToCreate.length) {
    await Promise.all(
      notificationsToCreate.map((notification) =>
        prisma.notification.create({
          data: notification,
        }),
      ),
    );
  }
}

export async function getHeaderNotifications(user: RequestUser) {
  const prisma = getPrisma();
  await syncDueNotifications(user);

  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id },
    include: {
      followUp: {
        select: {
          leadId: true,
          companyId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const rows: HeaderNotificationItem[] = notifications.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    type: formatNotificationType(item.type),
    href: notificationHref(user, {
      entity: item.entity,
      entityId: item.entityId,
      followUpLeadId: item.followUp?.leadId,
      followUpCompanyId: item.followUp?.companyId,
    }),
    read: Boolean(item.readAt),
    createdAt: format(item.createdAt, "dd MMM, hh:mm a"),
  }));

  return {
    rows,
    unreadCount: rows.filter((item) => !item.read).length,
  };
}

export async function markNotificationRead(user: RequestUser, id: string) {
  const prisma = getPrisma();
  const notification = await prisma.notification.findFirst({
    where: { id, recipientId: user.id },
    select: { id: true },
  });
  if (!notification) return false;

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  return true;
}

export async function markAllNotificationsRead(user: RequestUser) {
  const prisma = getPrisma();
  await prisma.notification.updateMany({
    where: {
      recipientId: user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}
