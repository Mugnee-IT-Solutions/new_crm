import "server-only";

import { getPrisma } from "@/lib/prisma";
import type * as Prisma from "@prisma/client";
import type { Role } from "@/lib/utils";

export type CustomerOwnerActor = {
  id: string;
  role: Role;
};

export type MarketerScopedActor = CustomerOwnerActor;

async function getSupervisorFallbackMarketers(
  prisma: ReturnType<typeof getPrisma>,
) {
  return prisma.user.findMany({
    where: {
      supervisorId: null,
      role: "MARKETER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function getMarketerScopeUserIds(
  prisma: ReturnType<typeof getPrisma>,
  actor: MarketerScopedActor,
) {
  if (actor.role === "ADMIN") return undefined;
  if (actor.role === "MARKETER") return [actor.id];

  const teamMembers = await prisma.user.findMany({
    where: {
      supervisorId: actor.id,
      role: "MARKETER",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (teamMembers.length) {
    return [actor.id, ...teamMembers.map((member) => member.id)];
  }

  const fallbackMarketers = await getSupervisorFallbackMarketers(prisma);
  return [actor.id, ...fallbackMarketers.map((member) => member.id)];
}

export async function getAssignableMarketerOwners(
  prisma: ReturnType<typeof getPrisma>,
  actor: MarketerScopedActor,
  options?: {
    allowSupervisorSelfFallback?: boolean;
  },
) {
  if (actor.role === "MARKETER") {
    const self = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, name: true, role: true },
    });
    return self ? [self] : [];
  }

  if (actor.role === "SUPERVISOR") {
    const team = await prisma.user.findMany({
      where: {
        supervisorId: actor.id,
        role: "MARKETER",
        status: "ACTIVE",
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });

    if (team.length) return team;

    const fallbackMarketers = await getSupervisorFallbackMarketers(prisma);
    if (fallbackMarketers.length) return fallbackMarketers;

    if (options?.allowSupervisorSelfFallback) {
      const self = await prisma.user.findUnique({
        where: { id: actor.id },
        select: { id: true, name: true, role: true },
      });
      return self ? [self] : [];
    }

    return [];
  }

  return prisma.user.findMany({
    where: {
      role: "MARKETER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function resolveScopedMarketerOwnerId(
  prisma: ReturnType<typeof getPrisma>,
  actor: MarketerScopedActor,
  requestedAssignedToId?: string | null,
  options?: {
    requireSelectionForElevated?: boolean;
    allowSupervisorSelfFallback?: boolean;
    adminMissingSelectionMessage?: string;
    supervisorMissingSelectionMessage?: string;
    adminInvalidSelectionMessage?: string;
    supervisorInvalidSelectionMessage?: string;
  },
) {
  const requestedId = requestedAssignedToId?.trim() || "";
  if (actor.role === "MARKETER") {
    return actor.id;
  }

  const requireSelection = options?.requireSelectionForElevated ?? true;
  const assignableOwners = await getAssignableMarketerOwners(prisma, actor, {
    allowSupervisorSelfFallback: options?.allowSupervisorSelfFallback,
  });

  if (!requestedId) {
    if (actor.role === "SUPERVISOR" && assignableOwners.length === 1 && assignableOwners[0]?.id === actor.id) {
      return actor.id;
    }

    if (requireSelection) {
      throw new Error(
        actor.role === "ADMIN"
          ? options?.adminMissingSelectionMessage ?? "Select a marketer."
          : options?.supervisorMissingSelectionMessage ?? "Select a marketer from your team.",
      );
    }

    return undefined;
  }

  const matchedOwner = assignableOwners.find((owner) => owner.id === requestedId);
  if (!matchedOwner) {
    throw new Error(
      actor.role === "ADMIN"
        ? options?.adminInvalidSelectionMessage ?? "Selected marketer was not found."
        : options?.supervisorInvalidSelectionMessage ?? "Selected marketer must belong to your team.",
    );
  }

  return matchedOwner.id;
}

export async function getCustomerScopeUserIds(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
) {
  return getMarketerScopeUserIds(prisma, actor);
}

export async function getCustomerAssignableOwners(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
) {
  return getAssignableMarketerOwners(prisma, actor, {
    allowSupervisorSelfFallback: true,
  });
}

export async function resolveCustomerOwnerId(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
  requestedAssignedToId?: string | null,
  options?: {
    requireSelectionForElevated?: boolean;
  },
) {
  return resolveScopedMarketerOwnerId(prisma, actor, requestedAssignedToId, {
    requireSelectionForElevated: options?.requireSelectionForElevated,
    allowSupervisorSelfFallback: true,
    adminMissingSelectionMessage: "Select a marketer for this customer.",
    supervisorMissingSelectionMessage: "Select a marketer from your team for this customer.",
    adminInvalidSelectionMessage: "Selected marketer was not found.",
    supervisorInvalidSelectionMessage: "Selected marketer must belong to your team.",
  });
}

export async function buildCustomerScopeWhere(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
  filters?: {
    search?: string;
    city?: string;
    industry?: string;
    assignedToId?: string;
    customerId?: string;
  },
) {
  const scopeIds = await getMarketerScopeUserIds(prisma, actor);
  const conditions: Prisma.Prisma.CustomerCompanyWhereInput[] = [];

  if (scopeIds) {
    conditions.push({ assignedToId: { in: scopeIds } });
  }

  if (filters?.customerId?.trim()) {
    conditions.push({ id: filters.customerId.trim() });
  }

  if (filters?.assignedToId?.trim() && filters.assignedToId !== "all") {
    const assignedToId = filters.assignedToId.trim();
    if (!scopeIds || scopeIds.includes(assignedToId)) {
      conditions.push({ assignedToId });
    } else {
      conditions.push({ id: "__forbidden__" });
    }
  }

  if (filters?.search?.trim()) {
    const search = filters.search.trim();
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { phone2: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { industry: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { website: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (filters?.city?.trim()) {
    conditions.push({ city: { contains: filters.city.trim(), mode: "insensitive" } });
  }

  if (filters?.industry?.trim()) {
    conditions.push({ industry: { contains: filters.industry.trim(), mode: "insensitive" } });
  }

  return conditions.length ? { AND: conditions } : {};
}

export async function hasCustomerAccess(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
  customerId: string,
) {
  const where = await buildCustomerScopeWhere(prisma, actor, { customerId });
  const record = await prisma.customerCompany.findFirst({
    where,
    select: { id: true },
  });

  return Boolean(record);
}
