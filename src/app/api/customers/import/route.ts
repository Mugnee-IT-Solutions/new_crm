import { NextResponse } from "next/server";
import { CUSTOMER_IMPORT_MAX_BYTES, importCustomersFromFile } from "@/lib/customer-transfer";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "Excel or CSV file is required." }, { status: 400 });
    }

    const fileName = file.name || "customers-import.xlsx";
    const lowerName = fileName.toLowerCase();
    const isSupportedFile = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
    if (!isSupportedFile) {
      return NextResponse.json({ success: false, message: "Only .xlsx, .xls, and .csv files are supported." }, { status: 400 });
    }

    if (file.size > CUSTOMER_IMPORT_MAX_BYTES) {
      return NextResponse.json({ success: false, message: "File size exceeds the 10MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importCustomersFromFile(buffer, fileName, {
      id: auth.user.id,
      role: auth.user.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer import failed.",
      },
      { status: 500 },
    );
  }
}
