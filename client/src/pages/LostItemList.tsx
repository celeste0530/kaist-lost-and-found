import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import AreaFilterMap from "../components/AreaFilterMap";
import { CATEGORIES, type Center, type Item } from "../types";

interface Filters {
  q: string;
  category: string;
  foundDateFrom: string;
  foundDateTo: string;
  centerId: string;
  bbox: string; // found-location area: "minLng,minLat,maxLng,maxLat"
}

const EMPTY: Filters = { q: "", category: "", foundDateFrom: "", foundDateTo: "", centerId: "", bbox: "" };

// FR-05: keyword search, filters (category, found date, found location, storage center) and the result list.
// "/?centerId=3" opens the list already filtered by that center (used by the center details page).
export default function LostItemList() {
  const [searchParams] = useSearchParams();
  const centerParam = searchParams.get("centerId") ?? "";

  const [form, setForm] = useState<Filters>({ ...EMPTY, centerId: centerParam });
  const [applied, setApplied] = useState<Filters>({ ...EMPTY, centerId: centerParam });
  const [centers, setCenters] = useState<Center[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    api<Center[]>("/centers")
      .then(setCenters)
      .catch(() => setCenters([]));
  }, []);

  // Arriving from another page with a different ?centerId= while this page is already open.
  useEffect(() => {
    setForm((f) => ({ ...f, centerId: centerParam }));
    setApplied((f) => ({ ...f, centerId: centerParam }));
  }, [centerParam]);

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(applied)) if (value) params.set(key, value);
    setLoading(true);
    setError("");
    api<Item[]>(`/items?${params}`)
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applied]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.foundDateFrom && form.foundDateTo && form.foundDateFrom > form.foundDateTo) {
      setFormError("The first found date must not be later than the last found date.");
      return;
    }
    setFormError("");
    setApplied({ ...form, q: form.q.trim() });
  };

  const onReset = () => {
    setForm(EMPTY);
    setApplied(EMPTY);
    setFormError("");
  };

  return (
    <section>
      <h1>Lost Items</h1>
      <form className="filters" onSubmit={onSubmit}>
        <div className="search">
          <input
            type="search"
            placeholder="Search by name or description"
            value={form.q}
            onChange={(e) => set("q", e.target.value)}
          />
          <button type="submit" className="primary">
            Search
          </button>
        </div>

        <div className="filter-grid">
          <label>
            Category
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Storage center
            <select value={form.centerId} onChange={(e) => set("centerId", e.target.value)}>
              <option value="">All centers</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Found from
            <input type="date" value={form.foundDateFrom} onChange={(e) => set("foundDateFrom", e.target.value)} />
          </label>
          <label>
            Found until
            <input type="date" value={form.foundDateTo} onChange={(e) => set("foundDateTo", e.target.value)} />
          </label>
        </div>

        <AreaFilterMap value={form.bbox} onChange={(bbox) => set("bbox", bbox)} />

        {formError && <p className="error" role="alert">{formError}</p>}
        <div className="row">
          <button type="button" onClick={onReset}>
            Reset filters
          </button>
        </div>
      </form>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No items match your search.</p>}
      {!loading && !error && items.length > 0 && <p className="muted">{items.length} item(s), newest first</p>}

      <ul className="cards">
        {items.map((item) => (
          <li key={item.id} className="card item-card">
            {item.imageUrl && <img className="thumb" src={`/uploads/${item.imageUrl}`} alt="" loading="lazy" />}
            <div>
              <h3>
                <Link to={`/items/${item.id}`}>{item.name}</Link>
              </h3>
              <div className="muted">
                {item.category} · found {item.foundDate} · stored at <Link to={`/centers/${item.centerId}`}>{item.centerName}</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
