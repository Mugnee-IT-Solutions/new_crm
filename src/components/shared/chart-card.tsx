import type { ReactNode } from "react";
import { DashboardCard } from "@/components/shared/dashboard-card";

export function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashboardCard title={title} className={className}>
      <div className="h-72">{children}</div>
    </DashboardCard>
  );
}

