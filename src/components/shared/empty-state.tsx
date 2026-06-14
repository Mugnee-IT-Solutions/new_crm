import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  icon: Icon = Search,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
    </Card>
  );
}

