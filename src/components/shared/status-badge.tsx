import { Badge } from "@/components/ui/badge";

const success = ["Active", "Completed", "Approved", "Won Sale", "WON_SALE", "Converted to Sale", "Negotiation"];
const warning = ["Pending", "Today", "Upcoming", "Draft", "Sent", "Medium", "MEDIUM", "QUOTATION_SENT"];
const danger = ["Overdue", "Rejected", "Lost Sale", "LOST_SALE", "Inactive", "URGENT", "High", "HIGH"];

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.replace(/_/g, " ");
  const variant = success.includes(value)
    ? "success"
    : warning.includes(value)
      ? "warning"
      : danger.includes(value)
        ? "danger"
        : "default";

  return <Badge variant={variant}>{normalized}</Badge>;
}

