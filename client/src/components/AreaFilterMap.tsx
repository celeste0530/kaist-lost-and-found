import { useEffect, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { MapContainer, Rectangle } from "react-leaflet";
import { KAIST_CENTER } from "../util";
import BaseTiles from "./BaseTiles";

const clampLng = (n: number) => Math.min(180, Math.max(-180, n));
const clampLat = (n: number) => Math.min(90, Math.max(-90, n));

// Zoom range of the slider.
const MIN_ZOOM = 13;
const MAX_ZOOM = 18;
const INITIAL_ZOOM = 16;
// Leaflet snaps the zoom to whole levels by default, which makes the selected area jump in big steps.
// With 0.1 the area can be adjusted smoothly with the slider, the mouse wheel and the +/- buttons.
const ZOOM_STEP = 0.1;
const WHEEL_PX_PER_ZOOM_LEVEL = 300;

function parseBbox(value: string): [[number, number], [number, number]] | null {
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * FR-05 "filter by found location": the visitor pans / zooms the map to the area of interest and
 * presses "Use this map area". The value is the server's bbox format "minLng,minLat,maxLng,maxLat".
 */
export default function AreaFilterMap({ value, onChange }: { value: string; onChange: (bbox: string) => void }) {
  const [open, setOpen] = useState(true);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const rect = parseBbox(value);

  // Keep the slider in step when the zoom changes any other way (wheel, pinch, +/- buttons).
  useEffect(() => {
    if (!map) return;
    const sync = () => setZoom(map.getZoom());
    map.on("zoom", sync);
    sync();
    return () => {
      map.off("zoom", sync);
    };
  }, [map]);

  const useVisibleArea = () => {
    if (!map) return;
    const b = map.getBounds();
    onChange(
      [clampLng(b.getWest()), clampLat(b.getSouth()), clampLng(b.getEast()), clampLat(b.getNorth())]
        .map((n) => n.toFixed(6))
        .join(","),
    );
  };

  return (
    <div className="area-filter">
      <div className="row">
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide map" : "Show map"}
        </button>
        {value && (
          <>
            <span className="muted">Found-location filter is on.</span>
            <button type="button" onClick={() => onChange("")}>
              Clear area
            </button>
          </>
        )}
      </div>
      {open && (
        <>
          <MapContainer
            center={KAIST_CENTER}
            zoom={INITIAL_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            zoomSnap={ZOOM_STEP}
            zoomDelta={0.5}
            wheelPxPerZoomLevel={WHEEL_PX_PER_ZOOM_LEVEL}
            className="map map-small"
            ref={setMap}
          >
            <BaseTiles />
            {rect && <Rectangle bounds={rect} pathOptions={{ color: "#d9480f", fill: false }} />}
          </MapContainer>
          <div className="row zoom-slider">
            <label className="inline">
              Zoom
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                value={zoom}
                onChange={(e) => map?.setZoom(Number(e.target.value))}
                aria-label="Map zoom"
              />
            </label>
            <span className="muted">wide area ← → small area</span>
          </div>
          <div className="row">
            <button type="button" onClick={useVisibleArea}>
              Use this map area
            </button>
            <span className="muted">Pan and zoom to the area where the item was lost, then press the button and Search.</span>
          </div>
        </>
      )}
    </div>
  );
}
