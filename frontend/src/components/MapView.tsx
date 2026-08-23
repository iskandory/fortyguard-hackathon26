import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import type { IControl, StyleSpecification } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ColumnLayer, TextLayer } from '@deck.gl/layers';
import type { FacilitySummary } from '../types/facility';
import { headroomColor } from '../lib/colorScale';
import 'maplibre-gl/dist/maplibre-gl.css';

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
 * Name labels ride above each column so sites stay identifiable even if
 * the basemap tiles are blocked.
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
        }),
        new TextLayer<FacilitySummary>({
          id: 'facility-labels',
          data: facilities,
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
  }, [facilities, selectedId, forecastHour]);

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
