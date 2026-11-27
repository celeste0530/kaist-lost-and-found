import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { Link } from "react-router-dom";
import { api } from "../api";
import { KAIST_CENTER, TILE_ATTRIBUTION, TILE_URL } from "../map";
import type { Center, Item } from "../types";

// FR-07: Available items are drawn at their found location; centers are drawn in another color.
// TODO: make overlapping / nearby markers distinguishable (clustering or spiderfy).
export default function LostItemMap() {
  const [items, setItems] = useState<Item[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Item[]>("/items"), api<Center[]>("/centers")])
      .then(([i, c]) => {
        setItems(i);
        setCenters(c);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section>
      <h1>Lost Item Map</h1>
      {error && <p className="error">{error}</p>}
      <p className="muted">
        <span style={{ color: "#d9480f" }}>●</span> found location of an item &nbsp;
        <span style={{ color: "#1c5fd4" }}>●</span> lost-and-found center
      </p>
      <MapContainer center={KAIST_CENTER} zoom={16} className="map">
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        {centers.map((c) => (
          <CircleMarker key={`c${c.id}`} center={[c.lat, c.lng]} radius={9} pathOptions={{ color: "#1c5fd4" }}>
            <Popup>
              <Link to={`/centers/${c.id}`}>{c.name}</Link>
              <br />
              {c.operatingHours}
            </Popup>
          </CircleMarker>
        ))}
        {items.map((item) => (
          <CircleMarker key={`i${item.id}`} center={[item.foundLat, item.foundLng]} radius={7} pathOptions={{ color: "#d9480f" }}>
            <Popup>
              <Link to={`/items/${item.id}`}>{item.name}</Link>
              <br />
              Stored at {item.centerName}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </section>
  );
}
