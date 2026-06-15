import { NextResponse } from "next/server";
import { createTaskEntry, parseTaskDateInput, TaskInputError, type TaskPriorityFilter } from "@/lib/task-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const body = (await request.json()) as {
      title?: string;
      companyName?: string;
      description?: string;
      priority?: TaskPriorityFilter;
      taskDate?: string;
      assignedToId?: string;
    };

    const title = body.title?.trim();
    const companyName = body.companyName?.trim();
    const description = body.description?.trim();
    const assignedToId = body.assignedToId?.trim();
    const taskDate = body.taskDate ? parseTaskDateInput(body.taskDate) : null;
    const priority = body.priority === "IMPORTANT" || body.priority === "HIGH" || body.priority === "MEDIUM" || body.priority === "LOW"
      ? body.priority
      : "MEDIUM";

    if (!title) {
      return NextResponse.json({ success: false, message: "Task title is required." }, { status: 400 });
    }

    if (!companyName) {
      return NextResponse.json({ success: false, message: "Company name is required." }, { status: 400 });
    }

    if (!taskDate) {
      return NextResponse.json({ success: false, message: "Task date is required." }, { status: 400 });
    }

    const row = await createTaskEntry(
      {
        id: auth.user.id,
        role: auth.user.role,
        name: auth.user.name,
      },
      {
        title,
        companyName,
        description,
        priority,
        taskDate,
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
