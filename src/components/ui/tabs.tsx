"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  defaultValue,
  children,
}: {
  tabs: { label: string; value: string }[];
  defaultValue: string;
  children: (value: string) => React.ReactNode;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-semibold transition",
              value === tab.value
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900",
            )}
            onClick={() => setValue(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{children(value)}</div>
    </div>
  );
}
