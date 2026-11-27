import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, useMap } from "react-leaflet";
import BaseTiles from "./BaseTiles";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

function FitPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [30, 30], maxZoom: 17 });
  }, [map, points]);
  return null;
}

/** Small read-only map with one or more labelled points (item details, center details). */
export default function PointMap({ points }: { points: MapPoint[] }) {
  if (points.length === 0) return null;
  const first = points[0];
  return (
    <MapContainer center={[first.lat, first.lng]} zoom={17} className="map map-small">
      <BaseTiles />
      <FitPoints points={points} />
      {points.map((p) => (
        <CircleMarker key={`${p.label}-${p.lat}-${p.lng}`} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: p.color }}>
          <Popup>{p.label}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
