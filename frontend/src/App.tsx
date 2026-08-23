import { useState } from 'react';
import { useFacilities } from './hooks/useFacilities';
import { useFacilityForecast } from './hooks/useFacilityForecast';
import { MapView } from './components/MapView';
import { RankingList } from './components/RankingList';
import { FacilityPanel } from './components/FacilityPanel';
import { ForecastDial } from './components/ForecastDial';
import { Legend } from './components/Legend';

export default function App() {
  const { facilities, loading, error, source } = useFacilities();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forecastHour, setForecastHour] = useState(0);

  // Default to the most at-risk facility so judges land on a populated readout.
  const selected =
    facilities.find((f) => f.id === selectedId) ??
    [...facilities].sort((a, b) => a.headroom_score - b.headroom_score)[0] ??
    null;

  const { forecast } = useFacilityForecast(selected?.id ?? null);

  if (loading) {
    return <div className="app-loading">Loading facilities…</div>;
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Thermal Siting Console</h1>
        <span className="app__subtitle">
          Northern Virginia · AI-factory cooling headroom
        </span>
        <span className={`source-pill source-pill--${source}`}>
          {source === 'live' ? 'Live data' : 'Cached demo data'}
        </span>
      </header>

      <main className="app__map">
        <MapView
          facilities={facilities}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          forecastHour={forecastHour}
        />
        <Legend />
        {error && (
          <div className="app__banner" role="status">
            Live data unavailable — showing cached demo data.
          </div>
        )}
        <div className="app__dial">
          <ForecastDial hour={forecastHour} onChange={setForecastHour} />
        </div>
      </main>

      <aside className="app__rail">
        <section className="rail-section" aria-label="Ranked facilities">
          <h3 className="rail-section__title">Ranked by headroom lost</h3>
          <RankingList
            facilities={facilities}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        </section>
        <section className="rail-section" aria-label="Selected facility readout">
          <h3 className="rail-section__title">Site readout</h3>
          <FacilityPanel facility={selected} forecast={forecast} />
        </section>
      </aside>
    </div>
  );
}
