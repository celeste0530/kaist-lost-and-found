import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { Center, Item } from "../types";

// FR-06: item details + how to claim it (visit / contact the storage center).
export default function ItemDetails() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [center, setCenter] = useState<Center | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Item>(`/items/${id}`)
      .then(async (it) => {
        setItem(it);
        setCenter(await api<Center>(`/centers/${it.centerId}`).catch(() => null));
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!item) return <p>Loading…</p>;

  return (
    <section>
      <h1>{item.name}</h1>
      {item.imageUrl && <img className="item-image" src={`/uploads/${item.imageUrl}`} alt={item.name} />}
      <dl>
        <dt>Category</dt>
        <dd>{item.category}</dd>
        <dt>Found date</dt>
        <dd>{item.foundDate}</dd>
        <dt>Found location</dt>
        <dd>
          {item.foundLat.toFixed(5)}, {item.foundLng.toFixed(5)} (see the <Link to="/map">map</Link>)
        </dd>
        <dt>Description</dt>
        <dd>{item.description}</dd>
        <dt>Status</dt>
        <dd>{item.status}</dd>
        <dt>Registered</dt>
        <dd>{item.registrationDate}</dd>
        <dt>Storage center</dt>
        <dd>
          <Link to={`/centers/${item.centerId}`}>{item.centerName}</Link>
          {center && (
            <div className="muted">
              {center.operatingHours}
              {center.phone && ` · ${center.phone}`}
              {center.email && ` · ${center.email}`}
            </div>
          )}
        </dd>
      </dl>
      <p className="card">
        This site does not verify ownership. If this item is yours, visit or contact the storage center above and follow
        their verification procedure.
      </p>
    </section>
  );
}
