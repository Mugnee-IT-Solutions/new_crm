import { NextResponse } from "next/server";
import {
  createTaskEntry,
  parseTaskDateTimeInput,
  TaskInputError,
  type TaskPriorityFilter,
} from "@/lib/task-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateTaskBody = {
  title?: string;
  companyId?: string;
  companyName?: string;
  description?: string;
  priority?: TaskPriorityFilter;
  taskDateTime?: string;
  taskDate?: string;
  assignedToId?: string;
};

function parsePriority(value: unknown): TaskPriorityFilter {
  if (value === "IMPORTANT" || value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }
  return "MEDIUM";
}

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const body = (await request.json()) as CreateTaskBody;
    const title = body.title?.trim();
    const companyId = body.companyId?.trim();
    const companyName = body.companyName?.trim();
    const description = body.description?.trim();
    const assignedToId = body.assignedToId?.trim();
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

    const row = await createTaskEntry(
      {
        id: auth.user.id,
        role: auth.user.role,
        name: auth.user.name,
      },
      {
        title,
        companyId,
        companyName,
        description,
        priority,
        taskDateTime,
        assignedToId,
      },
    );

    return NextResponse.json({ success: true, row });
  } catch (error) {
    const status = error instanceof TaskInputError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Task creation failed.",
      },
      { status },
    );
  }
}
