import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import StatusBadge from "../components/StatusBadge";
import { ITEM_STATUSES, type Center, type Item, type ItemStatus } from "../types";

type ActionKey = "return" | "remove" | "dispose";

// FR-08 / FR-09. The confirmation text says what the status means, because it cannot be undone.
const ACTIONS: Record<ActionKey, { label: string; done: string; confirm: (name: string) => string }> = {
  return: {
    label: "Mark returned",
    done: "Returned",
    confirm: (n) =>
      `Mark "${n}" as Returned?\n\nDo this only after you verified the owner and handed the item over. This cannot be undone.`,
  },
  remove: {
    label: "Remove",
    done: "Removed",
    confirm: (n) =>
      `Mark "${n}" as Removed?\n\nUse this when the record was created by mistake or is a duplicate. This cannot be undone.`,
  },
  dispose: {
    label: "Dispose",
    done: "Disposed",
    confirm: (n) =>
      `Mark "${n}" as Disposed?\n\nUse this when the item was registered correctly but is no longer stored by the center. This cannot be undone.`,
  },
};

// Center Inventory Management (route /staff/inventory).
// Staff see the items of their own center. Administrators can look at every center (FR-10).
export default function CenterInventory({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrator";

  const [centers, setCenters] = useState<Center[]>([]);
  const [centersLoaded, setCentersLoaded] = useState(false);
  const [centerFilter, setCenterFilter] = useState(""); // administrators only; "" = all centers
  const [status, setStatus] = useState<ItemStatus>("Available");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api<Center[]>("/centers")
      .then(setCenters)
      .catch(() => setCenters([]))
      .finally(() => setCentersLoaded(true));
  }, []);

  const centerId = isAdmin ? centerFilter : user?.centerId != null ? String(user.centerId) : "";
  const ownCenter = user?.centerId != null ? centers.find((c) => c.id === user.centerId) : undefined;

  const load = useCallback(() => {
    // A staff member without a center would otherwise see every center's items.
    if (!isAdmin && !centerId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ status });
    if (centerId) params.set("centerId", centerId);
    if (appliedQ) params.set("q", appliedQ);
    setLoading(true);
    api<Item[]>(`/items?${params}`)
      .then((rows) => {
        setItems(rows);
        setError("");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isAdmin, centerId, status, appliedQ]);

  useEffect(load, [load, reloadKey]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setAppliedQ(q.trim());
  };

  const act = async (item: Item, key: ActionKey) => {
    if (!window.confirm(ACTIONS[key].confirm(item.name))) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      await api<Item>(`/items/${item.id}/${key}`, { method: "POST" });
      setNotice(`"${item.name}" is now ${ACTIONS[key].done}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
      setReloadKey((k) => k + 1); // reload either way: another person may have changed the item
    }
  };

  const Heading = embedded ? "h2" : "h1";

  return (
    <section>
      <Heading>{isAdmin ? "All Items" : "Center Inventory"}</Heading>

      {!isAdmin && (
        <p>
          {centersLoaded && !ownCenter ? (
            <span className="error">Your assigned center was deleted. Ask an administrator to assign you to another center.</span>
          ) : (
            <>
              Center: <strong>{ownCenter?.name ?? "…"}</strong>
            </>
          )}
        </p>
      )}
      {isAdmin && (
        <p className="muted">
          Administrators can edit items and change their status at any center. Items are registered by center staff.
        </p>
      )}

      <div className="row">
        {user?.centerId != null && (
          <Link to="/staff/items/new" className="button primary">
            Register a new item
          </Link>
        )}
        {isAdmin && (
          <label className="inline">
            Center
            <select value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)}>
              <option value="">All centers</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="tabs" role="tablist">
        {ITEM_STATUSES.map((s) => (
          <button key={s} role="tab" aria-selected={s === status} className={s === status ? "tab active" : "tab"} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      <form className="search" onSubmit={onSearch}>
        <input type="search" placeholder="Search by name or description" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit">Search</button>
      </form>

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p>Loading…</p>}
      {!loading && !error && items.length === 0 && <p>No {status} items{appliedQ ? " match your search" : ""}.</p>}

      <ul className="cards">
        {items.map((item) => (
          <li key={item.id} className="card">
            <div className="card-head">
              <h3>
                <Link to={`/items/${item.id}`}>{item.name}</Link>
              </h3>
              <StatusBadge status={item.status} />
            </div>
            <div className="muted">
              {item.category} · found {item.foundDate} · registered {item.registrationDate}
              {isAdmin && <> · {item.centerName}</>}
            </div>
            {item.status === "Available" && (
              <div className="row actions">
                <Link to={`/staff/items/${item.id}/edit`} className="button">
                  Edit
                </Link>
                {(Object.keys(ACTIONS) as ActionKey[]).map((key) => (
                  <button key={key} disabled={busyId === item.id} onClick={() => void act(item, key)}>
                    {ACTIONS[key].label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
