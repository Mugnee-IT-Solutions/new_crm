import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-normal text-slate-950">{value}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{helper}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export function DashboardMetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
  iconTone,
  className,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
  iconTone?: string;
  className?: string;
}) {
  return (
    <Card className={cn("relative h-full overflow-hidden rounded-[22px] border-0 p-0 shadow-[0_18px_36px_rgba(15,23,42,0.14)]", tone, className)}>
      <div className="relative flex h-full min-h-[164px] flex-col justify-between p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <p className="max-w-[12rem] text-[10px] font-black uppercase tracking-[0.18em] text-white/78">{title}</p>
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/12 text-white shadow-sm backdrop-blur-sm", iconTone)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-8">
          <p className="text-[2rem] font-black leading-none tracking-[-0.04em] text-white">{value}</p>
          <p className="mt-2 text-sm text-white/78">{helper}</p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />
    </Card>
  );
}
