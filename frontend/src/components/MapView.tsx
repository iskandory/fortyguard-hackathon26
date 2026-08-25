import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type { IControl, StyleSpecification } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ColumnLayer, TextLayer } from '@deck.gl/layers';
import type { FacilitySummary } from '../types/facility';
import { headroomColor } from '../lib/colorScale';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre resolves its worker via `new URL(computedName, import.meta.url)`,
// which Rollup can't statically detect (only literal-string new URL() calls
// get copied as build assets) — so the production bundle silently ships with
// no worker script, and the map renders with no tiles at all. Importing the
// worker explicitly via Vite's `?url` forces it into the build output, and
// pointing MapLibre at that URL overrides its broken auto-detection.
setWorkerUrl(maplibreWorkerUrl);

interface MapViewProps {
  facilities: FacilitySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  forecastHour: number;
}

function hexToRgbArray(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Projects headroom forward using the summary's already-computed peak
// derating figure, so the map doesn't need the full per-hour forecast for
// every facility (that detail is fetched only for the selected facility,
// in FacilityPanel via useFacilityForecast).
function projectedHeadroom(f: FacilitySummary, forecastHour: number): number {
  const drift = f.peak_derating_next_12h_pct * (forecastHour / 11);
  return Math.max(0, f.headroom_score - drift);
}

function columnTopMeters(f: FacilitySummary, forecastHour: number): number {
  return (100 - projectedHeadroom(f, forecastHour)) * 40;
}

// Primary: Carto Dark Matter (vector). Fallback: OSM raster tiles on a
// different domain — survives ad-blockers/extension blocks on cartocdn.
const PRIMARY_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/**
 * Full-bleed 3D map — deck.gl ColumnLayer over a MapLibre basemap.
 * Columns are extruded by headroom loss and colored by the sequential
 * amber/copper ramp; scrubbing the forecast dial recolors/re-heights live.
 * Only the selected/hovered column gets a floating name label — labeling
 * every site at once collides into an unreadable pile wherever facilities
 * cluster tightly (e.g. Ashburn/Sterling).
 */
export function MapView({
  facilities,
  selectedId,
  onSelect,
  forecastHour,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const fallbackTriedRef = useRef(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: PRIMARY_STYLE,
      center: [-77.45, 39.0],
      zoom: 10,
      pitch: 45,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-left');

    map.on('error', () => {
      if (!fallbackTriedRef.current) {
        fallbackTriedRef.current = true;
        map.setStyle(FALLBACK_STYLE);
      } else {
        setBasemapFailed(true);
      }
    });

    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as unknown as IControl);
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current.setProps({
      layers: [
        new ColumnLayer<FacilitySummary>({
          id: 'facilities',
          data: facilities,
          diskResolution: 12,
          radius: 400,
          extruded: true,
          elevationScale: 40,
          getPosition: (f) => [f.lon, f.lat],
          getElevation: (f) => 100 - projectedHeadroom(f, forecastHour),
          getFillColor: (f) => [
            ...hexToRgbArray(headroomColor(projectedHeadroom(f, forecastHour))),
            f.id === selectedId ? 255 : 190,
          ],
          pickable: true,
          autoHighlight: true,
          highlightColor: [237, 238, 240, 60],
          onClick: (info) => {
            if (info.object) selectRef.current((info.object as FacilitySummary).id);
          },
          onHover: (info) => {
            setHoveredId(info.object ? (info.object as FacilitySummary).id : null);
          },
        }),
        new TextLayer<FacilitySummary>({
          id: 'facility-labels',
          // Only the selected/hovered facility is labeled — with ten sites,
          // labeling everyone at once collides into an unreadable pile
          // wherever facilities cluster (e.g. Ashburn/Sterling).
          data: facilities.filter((f) => f.id === selectedId || f.id === hoveredId),
          getPosition: (f) => [f.lon, f.lat, columnTopMeters(f, forecastHour) + 140],
          getText: (f) => f.name,
          getSize: 13,
          getColor: [237, 238, 240, 255],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'bottom',
          outlineWidth: 3,
          outlineColor: [20, 23, 28, 255],
          fontSettings: { sdf: true },
          pickable: false,
        }),
      ],
    });
  }, [facilities, selectedId, hoveredId, forecastHour]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-view" />
      {basemapFailed && (
        <div className="map-note" role="status">
          Basemap tiles blocked — facility positions and labels still live.
        </div>
      )}
    </div>
  );
}
