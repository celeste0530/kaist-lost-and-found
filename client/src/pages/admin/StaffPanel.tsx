import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
import type { Center, StaffAccount } from "../../types";

// FR-10: administrators create staff accounts, assign each one to a center, and deactivate them.
// Only administrators see this page, so staff cannot change their own center.

type Draft = { email: string; password: string; displayName: string; centerId: string };
const EMPTY_DRAFT: Draft = { email: "", password: "", displayName: "", centerId: "" };

function CenterSelect({ centers, value, onChange }: { centers: Center[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a center…</option>
      {centers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export default function StaffPanel() {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [edit, setEdit] = useState({ displayName: "", centerId: "", password: "" });

  const load = useCallback(() => {
    Promise.all([api<StaffAccount[]>("/staff"), api<Center[]>("/centers")])
      .then(([s, c]) => {
        setStaff(s);
        setCenters(c);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const centerName = (centerId: number | null) => {
    if (centerId === null) return "—";
    return centers.find((c) => c.id === centerId)?.name ?? "(deleted center)";
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!draft.email.trim()) return setError("Enter the email address.");
    if (draft.password.length < 8) return setError("The password must be at least 8 characters.");
    if (!draft.displayName.trim()) return setError("Enter the display name.");
    if (!draft.centerId) return setError("Choose the center this staff member works at.");
    try {
      await api<StaffAccount>("/staff", {
        method: "POST",
        body: JSON.stringify({
          email: draft.email.trim(),
          password: draft.password,
          displayName: draft.displayName.trim(),
          centerId: Number(draft.centerId),
        }),
      });
      setNotice(`Account ${draft.email.trim()} was created.`);
      setDraft(EMPTY_DRAFT);
      setCreating(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEdit = (s: StaffAccount) => {
    setNotice("");
    setError("");
    setEditing(s);
    // A deleted center is not in the list, so the select starts empty and a new one must be chosen.
    setEdit({
      displayName: s.displayName,
      centerId: s.centerId !== null && centers.some((c) => c.id === s.centerId) ? String(s.centerId) : "",
      password: "",
    });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError("");
    if (!edit.displayName.trim()) return setError("Enter the display name.");
    if (!edit.centerId) return setError("Choose the center this staff member works at.");
    if (edit.password && edit.password.length < 8) return setError("The new password must be at least 8 characters.");
    try {
      await api<StaffAccount>(`/staff/${editing.id}`, {
        method: "PUT",
        // No password field = keep the current password.
        body: JSON.stringify({
          displayName: edit.displayName.trim(),
          centerId: Number(edit.centerId),
          ...(edit.password ? { password: edit.password } : {}),
        }),
      });
      setNotice(`Account ${editing.email} was updated.`);
      setEditing(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setActive = async (s: StaffAccount, active: boolean) => {
    if (!active && !window.confirm(`Deactivate ${s.email}?\n\nThis person can no longer log in. Their records are kept.`)) return;
    setError("");
    setNotice("");
    try {
      await api<StaffAccount>(`/staff/${s.id}/${active ? "activate" : "deactivate"}`, { method: "POST" });
      setNotice(`Account ${s.email} was ${active ? "reactivated" : "deactivated"}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      load();
    }
  };

  return (
    <div>
      <div className="row">
        <h2>Staff accounts</h2>
        {!creating && (
          <button className="primary" onClick={() => { setCreating(true); setNotice(""); }}>
            Add staff account
          </button>
        )}
      </div>

      {creating && (
        <form className="form form-wide card" onSubmit={create} noValidate>
          <h3>New staff account</h3>
          <label>
            Email *
            <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} maxLength={255} />
          </label>
          <label>
            Password * (8–72 characters)
            <input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} maxLength={72} autoComplete="new-password" />
          </label>
          <label>
            Display name *
            <input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} maxLength={100} />
          </label>
          <label>
            Center *
            <CenterSelect centers={centers} value={draft.centerId} onChange={(v) => setDraft({ ...draft, centerId: v })} />
          </label>
          <div className="row">
            <button type="submit" className="primary">Create account</button>
            <button type="button" onClick={() => { setCreating(false); setDraft(EMPTY_DRAFT); }}>Cancel</button>
          </div>
        </form>
      )}

      {editing && (
        <form className="form form-wide card" onSubmit={saveEdit} noValidate>
          <h3>Edit {editing.email}</h3>
          <label>
            Display name *
            <input value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} maxLength={100} />
          </label>
          <label>
            Center *
            <CenterSelect centers={centers} value={edit.centerId} onChange={(v) => setEdit({ ...edit, centerId: v })} />
          </label>
          <p className="muted">Moving a staff member does not move the items they already registered.</p>
          <label>
            New password (leave empty to keep the current one)
            <input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} maxLength={72} autoComplete="new-password" />
          </label>
          <div className="row">
            <button type="submit" className="primary">Save</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p>Loading…</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Center</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.displayName}</td>
                <td>{s.email}</td>
                <td>{s.role}</td>
                <td>{centerName(s.centerId)}</td>
                <td>{s.deactivatedAt ? <span className="badge badge-removed">Deactivated</span> : <span className="badge badge-available">Active</span>}</td>
                <td className="actions">
                  {s.role === "Staff" && (
                    <>
                      <button onClick={() => startEdit(s)}>Edit</button>{" "}
                      {s.deactivatedAt ? (
                        <button onClick={() => void setActive(s, true)}>Reactivate</button>
                      ) : (
                        <button onClick={() => void setActive(s, false)}>Deactivate</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
