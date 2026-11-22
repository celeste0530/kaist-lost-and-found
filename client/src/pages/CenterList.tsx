import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Center } from "../types";

export default function CenterList() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Center[]>("/centers")
      .then(setCenters)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h1>Lost-and-Found Centers</h1>
      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      <ul className="cards">
        {centers.map((c) => (
          <li key={c.id} className="card">
            <h3>
              <Link to={`/centers/${c.id}`}>{c.name}</Link>
            </h3>
            <div className="muted">{c.operatingHours}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
