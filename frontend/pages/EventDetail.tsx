import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import './Explore.css';

type Category = 'hackathon' | 'workshop' | 'seminar' | 'meetup';

type Attendee = {
  id: string;
  status: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    college?: string | null;
  };
};

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
};

const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  hackathon: { label: 'Hackathon', icon: 'terminal', color: '#1d4ed8' },
  workshop: { label: 'Workshop', icon: 'memory', color: '#00687a' },
  seminar: { label: 'Seminar', icon: 'forum', color: '#434655' },
  meetup: { label: 'Meetup', icon: 'groups', color: '#623c00' },
};

const MAP_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function eventPosition(event: ApiEvent): [number, number] | null {
  const latitude = Number(event.latitude);
  const longitude = Number(event.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return [latitude, longitude];
}

function markerIcon(event: ApiEvent) {
  const meta = CATEGORY_META[event.category];

  return L.divIcon({
    className: 'circuit-marker-shell',
    html: `
      <div class="circuit-marker is-selected">
        <span class="circuit-marker-core">
          <span class="material-symbols-outlined circuit-marker-icon">${meta.icon}</span>
        </span>
        <span class="circuit-marker-copy">
          <span class="circuit-marker-label">${event.name}</span>
          <span class="circuit-marker-venue">${event.venue}</span>
        </span>
      </div>
    `,
    iconSize: [250, 58],
    iconAnchor: [18, 48],
  });
}

export default function EventDetail() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const missingEventId = !eventId;
  const [event, setEvent] = useState<ApiEvent | null>(null);
  const [isLoading, setIsLoading] = useState(!missingEventId);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState<string | null>(null);

  useEffect(() => {
    if (missingEventId) {
      return;
    }

    const request = new AbortController();

    api
      .get<ApiEvent>(`/events/${eventId}`, { signal: request.signal })
      .then((response) => setEvent(response.data))
      .catch((caught) => {
        if (request.signal.aborted) return;

        const status = typeof caught === 'object' && caught !== null && 'response' in caught
          ? (caught as { response?: { status?: number } }).response?.status
          : undefined;

        setError(status === 404 ? 'Event not found.' : 'Could not load event details.');
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => request.abort();
  }, [eventId, missingEventId]);

  const isOrganizer = Boolean(event && user?.id === event.organizer_id);

  useEffect(() => {
    if (!eventId || !isOrganizer) {
      return;
    }

    const request = new AbortController();
    setAttendeesLoading(true);
    setAttendeesError(null);

    api
      .get<Attendee[]>(`/events/${eventId}/attendees`, { signal: request.signal })
      .then((response) => setAttendees(response.data))
      .catch(() => {
        if (!request.signal.aborted) {
          setAttendeesError('Could not load attendees.');
        }
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setAttendeesLoading(false);
        }
      });

    return () => request.abort();
  }, [eventId, isOrganizer]);

  const position = useMemo(() => (event ? eventPosition(event) : null), [event]);
  const meta = event ? CATEGORY_META[event.category] : null;

  return (
    <div className="min-h-svh bg-[#f9f9ff] text-[#141b2b]">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-24 lg:px-10">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#434655] no-underline hover:text-[#141b2b]" to="/explore">
          <Icon name="arrow_back" className="text-lg" />
          Back to explore
        </Link>

        {isLoading && (
          <div className="mt-8 rounded-md border border-[#dce2f7] bg-white px-4 py-3 text-sm font-medium text-[#434655]">
            Loading event details
          </div>
        )}

        {missingEventId && (
          <div className="mt-8 rounded-md border-2 border-[#141b2b] bg-white px-5 py-4 shadow-[3px_3px_0_#141b2b]">
            <p className="font-['Space_Grotesk'] text-sm font-bold uppercase">Missing event id.</p>
          </div>
        )}

        {!missingEventId && !isLoading && error && (
          <div className="mt-8 rounded-md border-2 border-[#141b2b] bg-white px-5 py-4 shadow-[3px_3px_0_#141b2b]">
            <p className="font-['Space_Grotesk'] text-sm font-bold uppercase">{error}</p>
          </div>
        )}

        {!missingEventId && !isLoading && event && meta && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <section className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#141b2b] bg-white px-3 py-1 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[2px_2px_0_#141b2b]">
                  <Icon name={meta.icon} className="text-base" />
                  {meta.label}
                </span>
                <span className="rounded-full border border-[#dce2f7] bg-white px-3 py-1 text-xs font-semibold uppercase text-[#434655]">
                  {event.status}
                </span>
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">{event.name}</h1>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-[#dce2f7] bg-white p-4">
                  <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#747686]">Starts</p>
                  <p className="mt-1 text-sm font-semibold">{formatDateTime(event.start_time)}</p>
                </div>
                <div className="rounded-md border border-[#dce2f7] bg-white p-4">
                  <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#747686]">Ends</p>
                  <p className="mt-1 text-sm font-semibold">{formatDateTime(event.end_time)}</p>
                </div>
              </div>

              <div className="mt-6 rounded-md border border-[#dce2f7] bg-white p-5">
                <h2 className="text-xl font-semibold leading-7">About this event</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#434655]">
                  {event.description || 'No description has been added yet.'}
                </p>
              </div>
              {isOrganizer && (
                <div className="mt-6 overflow-hidden rounded-md border-2 border-[#141b2b] bg-white shadow-[3px_3px_0_#141b2b]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#141b2b] px-5 py-4">
                    <div>
                      <h2 className="font-['Space_Grotesk'] text-sm font-bold uppercase">Attendees</h2>
                      <p className="mt-1 text-xs text-[#747686]">Mark attended will live here later.</p>
                    </div>
                    <span className="rounded-full border-2 border-[#141b2b] bg-[#c7f464] px-3 py-1 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[2px_2px_0_#141b2b]">
                      {attendees.length} total
                    </span>
                  </div>

                  {attendeesLoading && <p className="px-5 py-4 text-sm text-[#434655]">Loading attendees</p>}
                  {!attendeesLoading && attendeesError && <p className="px-5 py-4 text-sm font-semibold text-[#9f1239]">{attendeesError}</p>}
                  {!attendeesLoading && !attendeesError && attendees.length === 0 && <p className="px-5 py-4 text-sm text-[#434655]">No attendees yet.</p>}

                  {!attendeesLoading && !attendeesError && attendees.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-[#dce2f7] bg-[#f1f3ff] font-['Space_Grotesk'] text-xs font-bold uppercase text-[#434655]">
                          <tr>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">College</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Registered</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dce2f7]">
                          {attendees.map((attendee) => (
                            <tr key={attendee.id}>
                              <td className="px-5 py-3 font-semibold text-[#141b2b]">{attendee.user.name}</td>
                              <td className="px-5 py-3 text-[#434655]">{attendee.user.college || 'Not added'}</td>
                              <td className="px-5 py-3">
                                <span className="rounded-full border border-[#dce2f7] bg-white px-2 py-1 text-xs font-semibold uppercase text-[#434655]">
                                  {attendee.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-[#434655]">{formatDateTime(attendee.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </section>

            <aside className="space-y-4">
              <div className="rounded-md border-2 border-[#141b2b] bg-white p-4 shadow-[3px_3px_0_#141b2b]">
                <h2 className="font-['Space_Grotesk'] text-sm font-bold uppercase">Event Info</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <p className="flex gap-2">
                    <Icon name="pin_drop" className="text-lg text-[#00687a]" />
                    <span>{event.venue}</span>
                  </p>
                  <p className="flex gap-2">
                    <Icon name="groups" className="text-lg text-[#1d4ed8]" />
                    <span>{event.capacity.toLocaleString()} capacity</span>
                  </p>
                  <p className="flex gap-2">
                    <Icon name="group_work" className="text-lg" />
                    <span>{event.allow_teams ? `Teams up to ${event.max_team_size}` : 'Solo participation'}</span>
                  </p>
                </div>
              </div>

              {position && (
                <div className="h-72 overflow-hidden rounded-md border-2 border-[#141b2b] bg-white shadow-[3px_3px_0_#141b2b]">
                  <MapContainer center={position} zoom={15} scrollWheelZoom={false} className="h-full w-full">
                    <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_URL} />
                    <Marker position={position} icon={markerIcon(event)} />
                  </MapContainer>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}



