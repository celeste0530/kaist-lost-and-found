import type { ItemStatus } from "../types";

export default function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}
