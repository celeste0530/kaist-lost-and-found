import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import PointMap from "../components/PointMap";
import StatusBadge from "../components/StatusBadge";
import type { Center, Item } from "../types";

// FR-06: item details + how to claim it (visit / contact the storage center).
export default function ItemDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [center, setCenter] = useState<Center | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setItem(null);
    setCenter(null);
    setError("");
    api<Item>(`/items/${id}`)
      .then(async (it) => {
        setItem(it);
        setCenter(await api<Center>(`/centers/${it.centerId}`).catch(() => null));
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!item) return <p>Loading…</p>;

  // Same rule as the server (FR-04): Available items only; staff at their own center, administrators anywhere.
  const canEdit =
    !!user && item.status === "Available" && (user.role === "Administrator" || user.centerId === item.centerId);

  const points = [{ lat: item.foundLat, lng: item.foundLng, label: `Found here: ${item.name}`, color: "#d9480f" }];
  if (center) points.push({ lat: center.lat, lng: center.lng, label: `Stored at ${center.name}`, color: "#1c5fd4" });

  return (
    <section>
      <div className="card-head">
        <h1>{item.name}</h1>
        <StatusBadge status={item.status} />
      </div>
      {canEdit && (
        <p>
          <Link to={`/staff/items/${item.id}/edit`} className="button">
            Edit this item
          </Link>
        </p>
      )}
      {item.imageUrl && <img className="item-image" src={`/uploads/${item.imageUrl}`} alt={item.name} />}
      <dl>
        <dt>Category</dt>
        <dd>{item.category}</dd>
        <dt>Found date</dt>
        <dd>{item.foundDate}</dd>
        <dt>Description</dt>
        <dd>{item.description}</dd>
        <dt>Registered</dt>
        <dd>{item.registrationDate}</dd>
        <dt>Storage center</dt>
        <dd>
          <Link to={`/centers/${item.centerId}`}>{item.centerName}</Link>
          {center && (
            <div className="muted">
              {center.operatingHours}
              {center.closureInformation && ` · ${center.closureInformation}`}
              {center.phone && ` · ${center.phone}`}
              {center.email && ` · ${center.email}`}
            </div>
          )}
        </dd>
        <dt>Found location</dt>
        <dd>
          {item.foundLat.toFixed(5)}, {item.foundLng.toFixed(5)}{" "}
          <span className="muted">(orange: where it was found, blue: where it is stored)</span>
        </dd>
      </dl>
      <PointMap points={points} />
      <p className="card">
        This site does not verify ownership. If this item is yours, visit or contact the storage center above and follow
        their verification procedure.
      </p>
    </section>
  );
}
