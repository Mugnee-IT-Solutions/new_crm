import { NextResponse } from "next/server";
import {
  deleteTaskEntry,
  parseTaskDateTimeInput,
  TaskInputError,
  type TaskPriorityFilter,
  updateTaskEntry,
} from "@/lib/task-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateTaskBody = {
  title?: string;
  companyId?: string;
  companyName?: string;
  description?: string;
  notes?: string;
  priority?: TaskPriorityFilter;
  taskDateTime?: string;
  taskDate?: string;
  assignedToId?: string;
  productId?: string;
};

function parsePriority(value: unknown): TaskPriorityFilter {
  if (value === "IMPORTANT" || value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }
  return "MEDIUM";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = (await request.json()) as UpdateTaskBody;
    const title = body.title?.trim();
    const companyId = body.companyId?.trim();
    const companyName = body.companyName?.trim();
    const description = body.description?.trim();
    const notes = body.notes?.trim();
    const assignedToId = body.assignedToId?.trim();
    const productId = body.productId?.trim();
    const priority = parsePriority(body.priority);
    const dateInput = body.taskDateTime?.trim() || body.taskDate?.trim() || "";
    const taskDateTime = dateInput ? parseTaskDateTimeInput(dateInput) : null;

    if (!title) {
      return NextResponse.json({ success: false, message: "Task title is required." }, { status: 400 });
    }

    if (!companyId && !companyName) {
      return NextResponse.json({ success: false, message: "Company name is required." }, { status: 400 });
    }

    if (!taskDateTime) {
      return NextResponse.json({ success: false, message: "Task date and time are required." }, { status: 400 });
    }

    const row = await updateTaskEntry(
      { id: auth.user.id, role: auth.user.role, name: auth.user.name },
      id,
      {
        title,
        companyId,
        companyName,
        description,
        notes,
        priority,
        taskDateTime,
        assignedToId,
        productId,
      },
    );

    return NextResponse.json({ success: true, row });
  } catch (error) {
    const status = error instanceof TaskInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Task update failed." },
      { status },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const deleted = await deleteTaskEntry(
      { id: auth.user.id, role: auth.user.role, name: auth.user.name },
      id,
    );

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    const status = error instanceof TaskInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Task delete failed." },
      { status },
    );
  }
}
