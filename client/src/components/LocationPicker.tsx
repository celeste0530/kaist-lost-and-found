import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { KAIST_CENTER, TILE_ATTRIBUTION, TILE_URL } from "../map";

export interface LatLng {
  lat: number;
  lng: number;
}

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

/** FR-03: the found location is chosen by clicking on the map. Clicking again moves the point. */
export default function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  return (
    <MapContainer center={value ? [value.lat, value.lng] : KAIST_CENTER} zoom={16} className="map map-picker">
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
      <ClickHandler onPick={onChange} />
      {value && <CircleMarker center={[value.lat, value.lng]} radius={8} pathOptions={{ color: "#d9480f" }} />}
    </MapContainer>
  );
}
