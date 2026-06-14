import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950 md:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

