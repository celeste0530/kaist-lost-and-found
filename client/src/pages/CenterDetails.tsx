import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { Center } from "../types";

// SRS 3.1: name, location, operating hours, closure information, contact information (if provided).
export default function CenterDetails() {
  const { id } = useParams();
  const [center, setCenter] = useState<Center | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Center>(`/centers/${id}`)
      .then(setCenter)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!center) return <p>Loading…</p>;

  return (
    <section>
      <h1>{center.name}</h1>
      <dl>
        <dt>Location</dt>
        <dd>
          {center.lat.toFixed(5)}, {center.lng.toFixed(5)} (see the <Link to="/map">map</Link>)
        </dd>
        <dt>Operating hours</dt>
        <dd>{center.operatingHours}</dd>
        {center.closureInformation && (
          <>
            <dt>Closures</dt>
            <dd>{center.closureInformation}</dd>
          </>
        )}
        {center.phone && (
          <>
            <dt>Phone</dt>
            <dd>{center.phone}</dd>
          </>
        )}
        {center.email && (
          <>
            <dt>Email</dt>
            <dd>{center.email}</dd>
          </>
        )}
      </dl>
      <p>
        <Link to="/">Browse items</Link> and filter by this center (TODO: center filter on the item list).
      </p>
    </section>
  );
}
