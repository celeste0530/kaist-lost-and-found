import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, Tooltip } from "react-leaflet";
import { Link } from "react-router-dom";
import { api } from "../api";
import BaseTiles from "../components/BaseTiles";
import type { Center, Item } from "../types";
import { KAIST_CENTER } from "../util";

// Items found at (almost) the same place share one marker. 4 decimals of latitude is about 11 m.
const groupKey = (item: Item) => `${item.foundLat.toFixed(4)},${item.foundLng.toFixed(4)}`;

// FR-07: Available items are drawn at their found location, centers in another color.
// Several items at the same or nearby locations become one numbered marker whose popup lists every item,
// so they can be told apart (FR-07: "users should be able to distinguish them").
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

  const groups = useMemo(() => {
    const byKey = new Map<string, Item[]>();
    for (const item of items) {
      const key = groupKey(item);
      byKey.set(key, [...(byKey.get(key) ?? []), item]);
    }
    return [...byKey.entries()];
  }, [items]);

  return (
    <section>
      <h1>Lost Item Map</h1>
      {error && <p className="error">{error}</p>}
      <p className="muted">
        <span style={{ color: "#d9480f" }}>●</span> found location of an item &nbsp;
        <span style={{ color: "#1c5fd4" }}>●</span> lost-and-found center &nbsp;
        A number means several items were found at about the same place: click it to see all of them.
      </p>
      <MapContainer center={KAIST_CENTER} zoom={16} className="map">
        <BaseTiles />
        {centers.map((c) => (
          <CircleMarker key={`c${c.id}`} center={[c.lat, c.lng]} radius={9} pathOptions={{ color: "#1c5fd4" }}>
            <Popup>
              <Link to={`/centers/${c.id}`}>{c.name}</Link>
              <br />
              {c.operatingHours}
            </Popup>
          </CircleMarker>
        ))}
        {groups.map(([key, group]) => (
          <CircleMarker
            key={key}
            center={[group[0].foundLat, group[0].foundLng]}
            radius={group.length > 1 ? 12 : 7}
            pathOptions={{ color: "#d9480f", fillColor: "#d9480f", fillOpacity: group.length > 1 ? 0.85 : 0.4 }}
          >
            {group.length > 1 && (
              <Tooltip permanent direction="center" className="marker-count">
                {group.length}
              </Tooltip>
            )}
            <Popup>
              <ul className="popup-list">
                {group.map((item) => (
                  <li key={item.id}>
                    <Link to={`/items/${item.id}`}>{item.name}</Link>
                    <br />
                    <span className="muted">
                      {item.category} · stored at <Link to={`/centers/${item.centerId}`}>{item.centerName}</Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </section>
  );
}
