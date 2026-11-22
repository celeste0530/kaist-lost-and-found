import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { CATEGORIES, type Item } from "../types";

// FR-05: keyword search + filters. TODO: found date, found location and storage center filters.
export default function LostItemList() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [applied, setApplied] = useState({ q: "", category: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (applied.q) params.set("q", applied.q);
    if (applied.category) params.set("category", applied.category);
    setLoading(true);
    setError("");
    api<Item[]>(`/items?${params}`)
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applied]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setApplied({ q, category });
  };

  return (
    <section>
      <h1>Lost Items</h1>
      <form className="search" onSubmit={onSubmit}>
        <input type="search" placeholder="Search by name or description" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No items match your search.</p>}

      <ul className="cards">
        {items.map((item) => (
          <li key={item.id} className="card">
            <h3>
              <Link to={`/items/${item.id}`}>{item.name}</Link>
            </h3>
            <div className="muted">
              {item.category} · found {item.foundDate} · stored at <Link to={`/centers/${item.centerId}`}>{item.centerName}</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
