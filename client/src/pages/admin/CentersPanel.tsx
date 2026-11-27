import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import LocationPicker, { type LatLng } from "../../components/LocationPicker";
import type { Center } from "../../types";
import { emptyToNull } from "../../util";

// FR-02 / FR-10: administrators create, edit and delete centers.

function CenterForm({ initial, onSaved, onCancel }: { initial: Center | null; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [operatingHours, setOperatingHours] = useState(initial?.operatingHours ?? "");
  const [closureInformation, setClosureInformation] = useState(initial?.closureInformation ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [location, setLocation] = useState<LatLng | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter the center name.");
    if (!location) return setError("Choose the center's location on the map.");
    if (!operatingHours.trim()) return setError("Enter the operating hours.");

    // The server clears optional fields that are missing (PUT replaces the whole record),
    // so every field is always sent; empty optional fields are sent as null.
    const body = {
      name: name.trim(),
      lat: location.lat,
      lng: location.lng,
      operatingHours: operatingHours.trim(),
      phone: emptyToNull(phone),
      email: emptyToNull(email),
      closureInformation: emptyToNull(closureInformation),
    };
    setSaving(true);
    try {
      await api<Center>(initial ? `/centers/${initial.id}` : "/centers", {
        method: initial ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form className="form form-wide card" onSubmit={onSubmit} noValidate>
      <h3>{initial ? `Edit ${initial.name}` : "New center"}</h3>
      <label>
        Name *
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
      </label>
      <div>
        <div className="label-text">Location * (click the map)</div>
        <LocationPicker value={location} onChange={setLocation} color="#1c5fd4" />
      </div>
      <label>
        Operating hours *
        <input value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)} maxLength={255} placeholder="e.g. Weekdays 09:00-18:00" />
      </label>
      <label>
        Closure information
        <textarea value={closureInformation} onChange={(e) => setClosureInformation(e.target.value)} rows={2} placeholder="Weekends, public holidays, regular closures" />
      </label>
      <label>
        Contact phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={255} />
      </label>
      <label>
        Contact email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : "Save center"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CentersPanel() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Center | "new" | null>(null);

  const load = useCallback(() => {
    api<Center[]>("/centers")
      .then(setCenters)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const remove = async (c: Center) => {
    if (!window.confirm(`Delete "${c.name}"?\n\nIts item records are kept, but the center will no longer appear and cannot take new items.`)) return;
    setError("");
    setNotice("");
    try {
      await api<void>(`/centers/${c.id}`, { method: "DELETE" });
      setNotice(`"${c.name}" was deleted.`); // a center that still has Available items is rejected (409) below
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saved = () => {
    setEditing(null);
    setNotice("Center saved.");
    load();
  };

  return (
    <div>
      <div className="row">
        <h2>Centers</h2>
        {editing === null && (
          <button className="primary" onClick={() => setEditing("new")}>
            Add center
          </button>
        )}
      </div>

      {editing !== null && (
        <CenterForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      )}

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p>Loading…</p>}

      <ul className="cards">
        {centers.map((c) => (
          <li key={c.id} className="card">
            <h3>
              <Link to={`/centers/${c.id}`}>{c.name}</Link>
            </h3>
            <div className="muted">
              {c.operatingHours}
              {c.phone && ` · ${c.phone}`}
              {c.email && ` · ${c.email}`}
            </div>
            <div className="row actions">
              <button onClick={() => { setNotice(""); setEditing(c); }}>Edit</button>
              <button onClick={() => void remove(c)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
