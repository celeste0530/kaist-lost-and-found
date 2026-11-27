import { useState } from "react";
import CenterInventory from "./CenterInventory";
import CentersPanel from "./admin/CentersPanel";
import StaffPanel from "./admin/StaffPanel";

type Tab = "centers" | "staff" | "items";

const TABS: { key: Tab; label: string }[] = [
  { key: "centers", label: "Centers" },
  { key: "staff", label: "Staff accounts" },
  { key: "items", label: "All items" },
];

// Administrator Page (route /admin): FR-02 centers, FR-10 staff accounts and item records.
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("centers");

  return (
    <section>
      <h1>Administrator</h1>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={t.key === tab} className={t.key === tab ? "tab active" : "tab"} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "centers" && <CentersPanel />}
      {tab === "staff" && <StaffPanel />}
      {tab === "items" && <CenterInventory embedded />}
    </section>
  );
}
