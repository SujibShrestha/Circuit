import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/api';
import Navbar from '../components/Navbar';
import './Explore.css';

type Category = 'hackathon' | 'workshop' | 'seminar' | 'meetup';
type Accent = 'primary' | 'secondary' | 'tertiary' | 'variant';
type LocationStatus = 'idle' | 'locating' | 'found' | 'denied' | 'unavailable';
type RadiusKm = 5 | 10 | 25 | 50;

type ApiEvent = {
  id: string;
  organizer_id: string;
  name: string;
  description?: string | null;
  category: Category;
  venue: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  start_time: string;
  end_time: string;
  capacity: number;
  allow_teams: boolean;
  max_team_size: number;
  status: string;
  distance_km?: number | null;
};

type LocatedEvent = ApiEvent & {
  latitude: number;
  longitude: number;
};

type MappedEvent = LocatedEvent & {
  position: [number, number];
};

const FALLBACK_CENTER: [number, number] = [37.4277, -122.1701];
const RADIUS_OPTIONS: RadiusKm[] = [5, 10, 25, 50];
const CARTO_BASEMAP_KEY = (import.meta as ImportMeta & { env: { VITE_CARTO_BASEMAP_KEY?: string } }).env.VITE_CARTO_BASEMAP_KEY?.trim();
const CARTO_POSITRON_URL = CARTO_BASEMAP_KEY
  ? `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?api_key=${encodeURIComponent(CARTO_BASEMAP_KEY)}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const OPENSTREETMAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAP_ATTRIBUTION = CARTO_BASEMAP_KEY ? CARTO_ATTRIBUTION : OPENSTREETMAP_ATTRIBUTION;
const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180;

const CATEGORY_META: Record<Category, { label: string; icon: string; accent: Accent }> = {
  hackathon: { label: 'Hackathon', icon: 'terminal', accent: 'primary' },
  workshop: { label: 'Workshop', icon: 'memory', accent: 'secondary' },
  seminar: { label: 'Seminar', icon: 'forum', accent: 'variant' },
  meetup: { label: 'Meetup', icon: 'groups', accent: 'tertiary' },
};

const currentLocationIcon = L.divIcon({
  className: 'current-location-marker-shell',
  html: `
    <div class="current-location-marker">
      <span class="current-location-ping"></span>
      <span class="current-location-dot"></span>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

function isLatLng(position: [number, number] | null): position is [number, number] {
  return Boolean(position && Number.isFinite(position[0]) && Number.isFinite(position[1]));
}

function eventPosition(event: ApiEvent): [number, number] | null {
  const latitude = Number(event.latitude);
  const longitude = Number(event.longitude);
  const position: [number, number] = [latitude, longitude];

  return isLatLng(position) ? position : null;
}

function distanceBetweenKm(from: [number, number], to: [number, number]) {
  const fromLat = DEG_TO_RAD * from[0];
  const toLat = DEG_TO_RAD * to[0];
  const deltaLat = DEG_TO_RAD * (to[0] - from[0]);
  const deltaLng = DEG_TO_RAD * (to[1] - from[1]);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function searchAreaBounds(center: [number, number], radiusKm: number) {
  return L.latLng(center[0], center[1]).toBounds(radiusKm * 1000);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDistance(distanceKm?: number | null) {
  if (distanceKm == null) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}

function markerIcon(event: MappedEvent, selected: boolean) {
  const meta = CATEGORY_META[event.category];

  return L.divIcon({
    className: 'circuit-marker-shell',
    html: `
      <div class="circuit-marker ${selected ? 'is-selected' : ''} circuit-marker-${meta.accent}">
        ${selected ? '<span class="circuit-marker-ping"></span>' : ''}
        <span class="circuit-marker-core">
          <span class="material-symbols-outlined circuit-marker-icon">${meta.icon}</span>
        </span>
        <span class="circuit-marker-copy">
          <span class="circuit-marker-label">${event.name}</span>
          <span class="circuit-marker-venue">${event.venue}</span>
        </span>
      </div>
    `,
    iconSize: selected ? [250, 58] : [230, 54],
    iconAnchor: [18, 48],
    popupAnchor: [92, -46],
  });
}

function EventCard({ event }: { event: MappedEvent }) {
  const meta = CATEGORY_META[event.category];
  const distance = formatDistance(event.distance_km);

  return (
    <article className="w-[min(22rem,calc(100vw-3rem))] bg-white text-[#141b2b]">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border-2 border-[#141b2b] bg-[#57dffe] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase leading-3 text-[#006172] shadow-[1.5px_1.5px_0_#141b2b]">
          {meta.label}
        </span>
        <span className="rounded-full border-2 border-[#141b2b] bg-[#ffddb8] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase leading-3 text-[#2a1700] shadow-[1.5px_1.5px_0_#141b2b]">
          {event.status}
        </span>
        {distance && (
          <span className="rounded-full border-2 border-[#141b2b] bg-[#1d4ed8] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase leading-3 text-white shadow-[1.5px_1.5px_0_#141b2b]">
            {distance}
          </span>
        )}
      </div>

      <h2 className="text-lg font-semibold leading-6 tracking-normal">{event.name}</h2>

      {event.description && <p className="mt-2 line-clamp-3 text-sm leading-5 text-[#434655]">{event.description}</p>}

      <div className="mt-3 space-y-2 border-b border-[#dce2f7] pb-3">
        <p className="flex min-w-0 items-center gap-2 font-['Space_Grotesk'] text-xs font-semibold leading-4 tracking-normal">
          <Icon name="calendar_today" className="text-base text-[#0037b0]" />
          <span>{formatDateTime(event.start_time)}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2 font-['Space_Grotesk'] text-xs leading-4 tracking-normal text-[#434655]">
          <Icon name="pin_drop" className="text-base text-[#00687a]" />
          <span className="truncate">{event.venue}</span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 font-['Space_Grotesk'] text-[10px] font-bold uppercase leading-3 tracking-normal text-[#434655]">
        <div className="rounded border-2 border-[#141b2b] bg-[#f1f3ff] p-2 shadow-[2px_2px_0_#141b2b]">
          <span className="block text-[#747686]">Capacity</span>
          <strong className="mt-1 block text-xs text-[#141b2b]">{event.capacity}</strong>
        </div>
        <div className="rounded border-2 border-[#141b2b] bg-[#f1f3ff] p-2 shadow-[2px_2px_0_#141b2b]">
          <span className="block text-[#747686]">Team Size</span>
          <strong className="mt-1 block text-xs text-[#141b2b]">{event.allow_teams ? event.max_team_size : 'Solo'}</strong>
        </div>
      </div>
    </article>
  );
}

function locationLabel(status: LocationStatus, mappedCount: number, radiusKm: RadiusKm, searchCenter: [number, number] | null) {
  if (searchCenter) return `${mappedCount} event${mappedCount === 1 ? '' : 's'} within ${radiusKm} km`;
  if (status === 'found') return 'Showing your location';
  if (status === 'locating') return 'Finding your location';
  if (status === 'denied') return 'Location permission denied';
  if (mappedCount > 0) return `${mappedCount} mapped event${mappedCount === 1 ? '' : 's'}`;
  return 'No mapped events';
}

export default function Explore() {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Category>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(10);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const mapRef = useRef<LeafletMap | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const request = new AbortController();

    async function loadEvents() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<ApiEvent[]>('/events/', {
          signal: request.signal,
          params: {
            ...(filter !== 'all' ? { category: filter } : {}),
            ...(searchCenter ? { lat: searchCenter[0], lng: searchCenter[1], radius_km: radiusKm } : {}),
            limit: 200,
            offset: 0,
          },
        });
        if (alive) {
          setEvents(response.data);
        }
      } catch (caught) {
        if (request.signal.aborted) return;

        const status = typeof caught === 'object' && caught !== null && 'response' in caught
          ? (caught as { response?: { status?: number } }).response?.status
          : undefined;

        if (alive) {
          if (status === 404) {
            setEvents([]);
          } else {
            setError('Could not load events from the server.');
          }
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      alive = false;
      request.abort();
    };
  }, [filter, radiusKm, searchCenter]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filters = useMemo(
    () => [
      { id: 'all' as const, label: 'All Events', icon: 'grid_view', count: events.length },
      ...Object.entries(CATEGORY_META).map(([id, meta]) => ({
        id: id as Category,
        label: meta.label,
        icon: meta.icon,
        count: events.filter((event) => event.category === id).length,
      })),
    ],
    [events],
  );

  const visibleEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter(
      (event) =>
        (filter === 'all' || event.category === filter) &&
        (!needle ||
          event.name.toLowerCase().includes(needle) ||
          event.venue.toLowerCase().includes(needle) ||
          CATEGORY_META[event.category].label.toLowerCase().includes(needle) ||
          event.status.toLowerCase().includes(needle)),
    );
  }, [events, filter, query]);

  const mappedEvents = useMemo(
    () =>
      visibleEvents.flatMap((event) => {
          const position = eventPosition(event);

          if (!position) return [];

          const apiDistance = event.distance_km == null ? null : Number(event.distance_km);
          const distanceKm = searchCenter
            ? Number.isFinite(apiDistance)
              ? apiDistance
              : distanceBetweenKm(searchCenter, position)
            : event.distance_km;

          const mappedEvent: MappedEvent = {
            ...event,
            distance_km: distanceKm,
            latitude: position[0],
            longitude: position[1],
            position,
          };

          return [mappedEvent];
        })
        .filter((event) => !searchCenter || Number(event.distance_km) <= radiusKm + 0.0001),
    [radiusKm, searchCenter, visibleEvents],
  );
  const selected = selectedId ? mappedEvents.find((event) => event.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!searchCenter || !mapRef.current) {
      return;
    }

    const bounds = searchAreaBounds(searchCenter, radiusKm);
    mapRef.current.fitBounds(bounds, {
      animate: true,
      duration: 0.7,
      maxZoom: 15,
      padding: [70, 70],
    });
  }, [radiusKm, searchCenter]);

  useEffect(() => {
    if (selectedId || searchCenter || !mapRef.current) {
      return;
    }

    const eventPositions = mappedEvents.map((event) => event.position);

    if (eventPositions.length > 1) {
      mapRef.current.fitBounds(eventPositions, {
        animate: true,
        duration: 0.7,
        maxZoom: 16,
        padding: [80, 80],
      });
      return;
    }

    if (eventPositions.length === 1) {
      mapRef.current.flyTo(eventPositions[0], 16, { duration: 0.7 });
      return;
    }

    if (currentPosition) {
      mapRef.current.flyTo(currentPosition, 16, { duration: 0.7 });
    }
  }, [currentPosition, mappedEvents, searchCenter, selectedId]);

  useEffect(() => {
    if (!selected || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo(selected.position, Math.max(mapRef.current.getZoom(), 16), {
      duration: 0.6,
    });
  }, [selected]);

  function chooseEvent(event: MappedEvent) {
    setSelectedId(event.id);
  }

  function recenter() {
    setSelectedId(null);

    if (searchCenter) {
      const bounds = searchAreaBounds(searchCenter, radiusKm);
      mapRef.current?.fitBounds(bounds, { animate: true, duration: 0.7, maxZoom: 15, padding: [70, 70] });
      return;
    }

    if (currentPosition) {
      mapRef.current?.flyTo(currentPosition, 16, { duration: 0.7 });
      return;
    }

    mapRef.current?.flyTo(FALLBACK_CENTER, 16, { duration: 0.7 });
  }

  function findNearbyEvents(nextRadiusKm = radiusKm) {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setError('Location is not available in this browser.');
      return;
    }

    setLocationStatus('locating');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition: [number, number] = [position.coords.latitude, position.coords.longitude];

        if (!isLatLng(nextPosition)) {
          setLocationStatus('unavailable');
          setError('Could not read your current location.');
          return;
        }

        setCurrentPosition(nextPosition);
        setSearchCenter(nextPosition);
        setRadiusKm(nextRadiusKm);
        setSelectedId(null);
        setLocationStatus('found');
      },
      (locationError) => {
        setLocationStatus(locationError.code === locationError.PERMISSION_DENIED ? 'denied' : 'unavailable');
        setError(locationError.code === locationError.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not get your current location.');
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  }

  function chooseRadius(option: RadiusKm) {
    setRadiusKm(option);

    if (!searchCenter) {
      findNearbyEvents(option);
    }
  }

  return (
    <div className="min-h-svh bg-[#f9f9ff] text-[#141b2b]">
      <Navbar />

      <main className="pt-16">
        <section className="relative h-[calc(100svh-4rem)] overflow-hidden">
          <MapContainer ref={mapRef} center={searchCenter ?? currentPosition ?? FALLBACK_CENTER} zoom={16} minZoom={3} maxZoom={19} zoomControl={false} className="h-full w-full bg-[#f1f3ff]">
            <TileLayer attribution={MAP_ATTRIBUTION} url={CARTO_POSITRON_URL} />
            {searchCenter && (
              <Circle
                center={searchCenter}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 0.08, opacity: 0.7, weight: 2 }}
              />
            )}
            {currentPosition && <Marker position={currentPosition} icon={currentLocationIcon} interactive={false} zIndexOffset={1000} />}
            {mappedEvents.map((event) => (
              <Marker key={event.id} position={event.position} icon={markerIcon(event, selected?.id === event.id)} eventHandlers={{ click: () => chooseEvent(event) }}>
                <Popup className="event-popup" closeButton={false} autoPan>
                  <EventCard event={event} />
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 pt-4 lg:px-10">
            <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div className="pointer-events-auto flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative flex w-full min-w-0 items-center rounded-full border-2 border-[#141b2b] bg-white shadow-[3px_3px_0_#141b2b] transition focus-within:-translate-x-px focus-within:-translate-y-px focus-within:shadow-[4px_4px_0_#1d4ed8] sm:w-[min(28rem,48vw)]">
                  <Icon name="search" className="ml-4 text-[22px] text-[#434655]" />
                  <input
                    ref={searchRef}
                    type="search"
                    aria-label="Search events"
                    placeholder="Search campus events..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm leading-6 text-[#141b2b] placeholder:text-[#747686] focus:outline-none"
                  />
                  <kbd className="mr-4 hidden rounded border border-[#c4c5d7] bg-[#e1e8fd] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold leading-3 tracking-normal text-[#434655] md:inline-flex">
                    Ctrl K
                  </kbd>
                </label>

                <div className="flex w-fit max-w-full items-center gap-2 rounded-md border border-[#dce2f7] bg-white px-4 py-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00687a] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00687a]" />
                  </span>
                  <span className="text-xs font-medium leading-4 tracking-normal">{locationLabel(locationStatus, mappedEvents.length, radiusKm, searchCenter)}</span>
                </div>
              </div>

              <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none lg:justify-end [&::-webkit-scrollbar]:hidden" role="group" aria-label="Find nearby events and filter by radius">
                <button
                  type="button"
                  onClick={() => findNearbyEvents()}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border-2 border-[#141b2b] bg-[#1d4ed8] px-4 py-1.5 font-['Space_Grotesk'] text-xs font-semibold uppercase leading-4 tracking-normal text-white shadow-[3px_3px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#141b2b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  <Icon name="near_me" className="text-base text-white" />
                  <span>Near me</span>
                </button>
                {RADIUS_OPTIONS.map((option) => {
                  const active = searchCenter !== null && radiusKm === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => chooseRadius(option)}
                      className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium leading-4 transition ${
                        active
                          ? 'border-2 border-[#141b2b] bg-white text-[#141b2b] shadow-[3px_3px_0_#141b2b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                          : 'border-[#dce2f7] bg-white text-[#434655] hover:border-[#141b2b]'
                      }`}
                    >
                      {option} km
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter events by category">
              {filters.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[#141b2b] px-4 py-1.5 font-['Space_Grotesk'] text-xs font-semibold uppercase leading-4 tracking-normal shadow-[3px_3px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#141b2b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                      active ? 'bg-[#1d4ed8] text-white' : 'bg-white text-[#141b2b]'
                    }`}
                  >
                    <Icon name={option.icon} className={`text-base ${active ? 'text-white' : 'text-[#434655]'}`} />
                    <span>{option.label}</span>
                    <span className="rounded-full bg-white/20 px-1.5 text-[10px] leading-3">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(isLoading || error || visibleEvents.length === 0 || mappedEvents.length === 0) && (
            <div className="absolute left-1/2 top-1/2 z-[500] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-[#dce2f7] bg-white px-4 py-3 text-center text-xs font-medium leading-5 tracking-normal shadow-[0_8px_24px_rgb(20_27_43_/_10%)]">
              {isLoading && 'Loading events'}
              {!isLoading && error && error}
              {!isLoading && !error && visibleEvents.length === 0 && 'No events match your filters'}
              {!isLoading && !error && visibleEvents.length > 0 && mappedEvents.length === 0 && 'No filtered events have map coordinates yet'}
            </div>
          )}

          <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-center gap-2">
            <div className="overflow-hidden rounded-lg border-2 border-[#141b2b] bg-white shadow-[3px_3px_0_#141b2b]">
              <button type="button" className="grid h-10 w-10 place-items-center border-b-2 border-[#141b2b] hover:bg-[#e9edff]" aria-label="Zoom in" title="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
                <Icon name="add" />
              </button>
              <button type="button" className="grid h-10 w-10 place-items-center hover:bg-[#e9edff]" aria-label="Zoom out" title="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
                <Icon name="remove" />
              </button>
            </div>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border-2 border-[#141b2b] bg-white text-[#00687a] shadow-[3px_3px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#141b2b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none" aria-label="Re-center map on my location" title="Re-center map on my location" onClick={recenter}>
              <Icon name="my_location" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

