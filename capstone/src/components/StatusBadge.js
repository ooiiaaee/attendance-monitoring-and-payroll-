import { Check, Clock, X, ShieldCheck } from "lucide-react";

// Shared status badge config used across pages
const STATUS_CONFIG = {
  present: { label: "Present", icon: Check, tone: "present" },
  late: { label: "Late", icon: Clock, tone: "late" },
  absent: { label: "Absent", icon: X, tone: "absent" },
  excused: { label: "Excused", icon: ShieldCheck, tone: "excused" },
  pending: { label: "Pending", icon: Clock, tone: "pending" },
  approved: { label: "Approved", icon: Check, tone: "approved" },
  rejected: { label: "Rejected", icon: X, tone: "rejected" },
};

export default function StatusBadge({ status, fallbackLabel }) {
  const config = STATUS_CONFIG[status];

  if (!config) {
    return <span className="status-badge tone-pending">{fallbackLabel || "Unknown"}</span>;
  }

  const Icon = config.icon;
  return (
    <span className={`status-badge tone-${config.tone}`}>
      <Icon size={12} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
