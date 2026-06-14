"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ConfirmDialog({
  title = "Confirm action",
  description = "This action will be applied to the selected CRM record.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" type="button">
        Review
      </Button>
    </Card>
  );
}

