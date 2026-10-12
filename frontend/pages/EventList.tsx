import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';

type Category = 'hackathon' | 'workshop' | 'seminar' | 'meetup';

type ApiEvent = {
  id: string;
  name: string;
  description?: string | null;
  category: Category;
  venue: string;
  start_time: string;
  end_time: string;
  capacity: number;
  allow_teams: boolean;
  max_team_size: number;
  status: string;
};

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  hackathon: { label: 'Hackathon', icon: 'terminal' },
  workshop: { label: 'Workshop', icon: 'memory' },
  seminar: { label: 'Seminar', icon: 'forum' },
  meetup: { label: 'Meetup', icon: 'groups' },
};

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

export default function EventList() {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | Category>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const request = new AbortController();

    api
      .get<ApiEvent[]>('/events/', { signal: request.signal })
      .then((response) => setEvents(response.data))
      .catch((caught) => {
        if (request.signal.aborted) return;

        const status = typeof caught === 'object' && caught !== null && 'response' in caught
          ? (caught as { response?: { status?: number } }).response?.status
          : undefined;

        if (status === 404) {
          setEvents([]);
          return;
        }

        setError('Could not load events.');
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => request.abort();
  }, []);

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return events.filter((event) => {
      const matchesCategory = category === 'all' || event.category === category;
      const matchesQuery =
        !needle ||
        event.name.toLowerCase().includes(needle) ||
        event.venue.toLowerCase().includes(needle) ||
        event.status.toLowerCase().includes(needle) ||
        CATEGORY_META[event.category].label.toLowerCase().includes(needle);

      return matchesCategory && matchesQuery;
    });
  }, [category, events, query]);

  const categoryOptions = useMemo(
    () => [
      { id: 'all' as const, label: 'All', icon: 'grid_view', count: events.length },
      ...Object.entries(CATEGORY_META).map(([id, meta]) => ({
        id: id as Category,
        label: meta.label,
        icon: meta.icon,
        count: events.filter((event) => event.category === id).length,
      })),
    ],
    [events],
  );

  return (
    <div className="min-h-svh bg-[#f9f9ff] text-[#141b2b]">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-24 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#434655]">Circuit Events</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">Event Details</h1>
          </div>

          <label className="relative flex w-full items-center rounded-md border border-[#dce2f7] bg-white lg:w-96">
            <Icon name="search" className="ml-3 text-xl text-[#434655]" />
            <input
              type="search"
              aria-label="Search events"
              placeholder="Search events..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-[#747686]"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter events by category">
          {categoryOptions.map((option) => {
            const active = category === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(option.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[#141b2b] px-4 py-1.5 font-['Space_Grotesk'] text-xs font-semibold uppercase leading-4 shadow-[3px_3px_0_#141b2b] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
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

        {isLoading && (
          <div className="mt-8 rounded-md border border-[#dce2f7] bg-white px-4 py-3 text-sm font-medium text-[#434655]">
            Loading events
          </div>
        )}

        {!isLoading && error && (
          <div className="mt-8 rounded-md border-2 border-[#141b2b] bg-white px-5 py-4 shadow-[3px_3px_0_#141b2b]">
            <p className="font-['Space_Grotesk'] text-sm font-bold uppercase">{error}</p>
          </div>
        )}

        {!isLoading && !error && filteredEvents.length === 0 && (
          <div className="mt-8 rounded-md border border-[#dce2f7] bg-white px-4 py-3 text-sm font-medium text-[#434655]">
            No events found.
          </div>
        )}

        {!isLoading && !error && filteredEvents.length > 0 && (
          <div className="mt-6 grid gap-3">
            {filteredEvents.map((event) => {
              const meta = CATEGORY_META[event.category];

              return (
                <Link
                  key={event.id}
                  className="grid gap-4 rounded-md border border-[#dce2f7] bg-white p-4 text-[#141b2b] no-underline transition hover:border-[#141b2b] hover:shadow-[3px_3px_0_#141b2b] md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-center"
                  to={`/events/${event.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#dce2f7] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase text-[#434655]">
                        <Icon name={meta.icon} className="text-sm" />
                        {meta.label}
                      </span>
                      <span className="rounded-full bg-[#e9edff] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase text-[#1d4ed8]">
                        {event.status}
                      </span>
                    </div>
                    <h2 className="mt-2 truncate text-xl font-semibold leading-7">{event.name}</h2>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-[#434655]">
                      <Icon name="pin_drop" className="text-base text-[#00687a]" />
                      <span className="truncate">{event.venue}</span>
                    </p>
                  </div>

                  <div className="text-sm text-[#434655]">
                    <p className="font-semibold text-[#141b2b]">{formatDateTime(event.start_time)}</p>
                    <p className="mt-1">{event.capacity.toLocaleString()} capacity</p>
                  </div>

                  <span className="inline-flex items-center justify-center gap-1 rounded-md border-2 border-[#141b2b] bg-[#1d4ed8] px-3 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase text-white shadow-[3px_3px_0_#141b2b]">
                    View
                    <Icon name="arrow_forward" className="text-base text-white" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
