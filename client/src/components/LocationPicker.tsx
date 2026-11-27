import { CircleMarker, MapContainer, useMapEvents } from "react-leaflet";
import { KAIST_CENTER } from "../util";
import BaseTiles from "./BaseTiles";

export interface LatLng {
  lat: number;
  lng: number;
}

// Zoom range of the slider.
const MIN_ZOOM = 13;
const MAX_ZOOM = 18;
const INITIAL_ZOOM = 16;
// Leaflet snaps the zoom to whole levels by default, which makes the selected area jump in big steps.
// With 0.1 the area can be adjusted smoothly with the slider, the mouse wheel and the +/- buttons.
const ZOOM_STEP = 0.1;
const WHEEL_PX_PER_ZOOM_LEVEL = 300;

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      // wrap(): keeps the longitude inside -180..180 when the map was panned around the world.
      const p = e.latlng.wrap();
      onPick({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
    },
  });
  return null;
}

/** Click the map to choose a location (FR-03: "the found location shall be chosen by the user on the map"). */
export default function LocationPicker({
  value,
  onChange,
  color = "#d9480f",
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  color?: string;
}) {
  return (
    <div>
      <MapContainer
        center={KAIST_CENTER}
        zoom={INITIAL_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomSnap={ZOOM_STEP}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={WHEEL_PX_PER_ZOOM_LEVEL}
        className="map map-small"
      >
        <BaseTiles />
        <ClickHandler onPick={onChange} />
        {value && <CircleMarker center={[value.lat, value.lng]} radius={9} pathOptions={{ color }} />}
      </MapContainer>
      <p className="muted">
        {value
          ? `Selected: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)} (click the map to change)`
          : "Click the map to choose the location."}
      </p>
    </div>
  );
}
