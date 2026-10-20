import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'attended';
type MyEventsTab = 'registered' | 'waitlisted' | 'past';

type Registration = {
  id: string;
  event_id: string;
  status: RegistrationStatus;
  created_at: string;
  event: {
    id: string;
    name: string;
    venue: string;
    start_time: string;
    end_time: string;
    status: string;
  };
};

const MY_EVENTS_TABS: { id: MyEventsTab; label: string }[] = [
  { id: 'registered', label: 'Registered' },
  { id: 'waitlisted', label: 'Waitlisted' },
  { id: 'past', label: 'Past' },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

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

function statusClasses(status: RegistrationStatus) {
  if (status === 'confirmed') return 'bg-[#e9edff] text-[#1d4ed8]';
  if (status === 'waitlisted') return 'bg-[#ffddb8] text-[#623c00]';
  if (status === 'attended') return 'bg-[#acedff] text-[#00687a]';
  return 'bg-[#f1f3ff] text-[#434655]';
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MyEventsTab>('registered');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);

  useEffect(() => {
    const request = new AbortController();

    api
      .get<Registration[]>('/registrations/me', { signal: request.signal })
      .then((response) => setRegistrations(response.data))
      .catch((caught) => {
        if (request.signal.aborted) return;

        const status = typeof caught === 'object' && caught !== null && 'response' in caught
          ? (caught as { response?: { status?: number } }).response?.status
          : undefined;

        if (status === 404) {
          setRegistrations([]);
          return;
        }

        setRegistrationsError('Could not load your events.');
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setRegistrationsLoading(false);
        }
      });

    return () => request.abort();
  }, []);

  const registrationGroups = useMemo(() => {
    return {
      registered: registrations.filter(
        (registration) =>
          registration.status === 'confirmed' &&
          registration.event.status !== 'completed',
      ),
      waitlisted: registrations.filter(
        (registration) =>
          registration.status === 'waitlisted' &&
          registration.event.status !== 'completed',
      ),
      past: registrations.filter(
        (registration) =>
          registration.status === 'attended' ||
          registration.status === 'cancelled' ||
          registration.event.status === 'completed',
      ),
    };
  }, [registrations]);

  const visibleRegistrations = registrationGroups[activeTab];

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  return (
    <div className="min-h-svh bg-[#f9f9ff] text-[#141b2b]">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-24 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-md border-2 border-[#141b2b] bg-white p-6 shadow-[3px_3px_0_#141b2b]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 border-[#141b2b] bg-[#57dffe] font-['Space_Grotesk'] text-xl font-bold text-[#006172] shadow-[3px_3px_0_#141b2b]">
                {initials(user.name)}
              </div>

              <div className="min-w-0">
                <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#434655]">My Profile</p>
                <h1 className="mt-1 truncate text-4xl font-semibold leading-tight tracking-normal">{user.name}</h1>
                <p className="mt-1 truncate text-sm text-[#434655]">{user.email}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[#dce2f7] bg-[#f9f9ff] p-4">
                <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#747686]">Role</p>
                <p className="mt-1 text-lg font-semibold capitalize">{user.role}</p>
              </div>
              <div className="rounded-md border border-[#dce2f7] bg-[#f9f9ff] p-4">
                <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#747686]">College</p>
                <p className="mt-1 text-lg font-semibold">{user.college || 'Not added'}</p>
              </div>
              <div className="rounded-md border border-[#dce2f7] bg-[#f9f9ff] p-4">
                <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#747686]">XP</p>
                <p className="mt-1 text-lg font-semibold">{user.xp.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-[#dce2f7] bg-[#f9f9ff] p-4">
                <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#747686]">Level</p>
                <p className="mt-1 text-lg font-semibold">{user.level}</p>
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <Link
              className="flex items-center justify-between rounded-md border border-[#dce2f7] bg-white px-4 py-3 text-sm font-semibold text-[#141b2b] no-underline hover:border-[#141b2b]"
              to="/events"
            >
              Event details
              <Icon name="arrow_forward" className="text-lg" />
            </Link>

            {user.role === 'organizer' && (
              <Link
                className="flex items-center justify-between rounded-md border-2 border-[#141b2b] bg-[#1d4ed8] px-4 py-3 font-['Space_Grotesk'] text-xs font-bold uppercase text-white no-underline shadow-[3px_3px_0_#141b2b]"
                to="/host-event"
              >
                Host event
                <Icon name="arrow_forward" className="text-lg text-white" />
              </Link>
            )}

            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border-2 border-[#141b2b] bg-white px-4 py-3 font-['Space_Grotesk'] text-xs font-bold uppercase text-[#141b2b] shadow-[3px_3px_0_#141b2b] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              onClick={handleLogout}
            >
              Logout
              <Icon name="logout" className="text-lg" />
            </button>
          </aside>
        </div>

        <section className="mt-6 rounded-md border border-[#dce2f7] bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#747686]">My events</p>
              <h2 className="mt-1 text-2xl font-semibold leading-8">Registrations</h2>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="My events tabs">
              {MY_EVENTS_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 font-['Space_Grotesk'] text-xs font-bold uppercase ${
                      active
                        ? 'border-2 border-[#141b2b] bg-[#1d4ed8] text-white shadow-[3px_3px_0_#141b2b]'
                        : 'border-[#dce2f7] bg-white text-[#434655]'
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{registrationGroups[tab.id].length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {registrationsLoading && <p className="mt-5 text-sm text-[#434655]">Loading your events</p>}
          {!registrationsLoading && registrationsError && <p className="mt-5 text-sm font-semibold text-[#623c00]">{registrationsError}</p>}
          {!registrationsLoading && !registrationsError && visibleRegistrations.length === 0 && (
            <p className="mt-5 text-sm text-[#434655]">No events in this tab.</p>
          )}

          {!registrationsLoading && !registrationsError && visibleRegistrations.length > 0 && (
            <div className="mt-5 divide-y divide-[#dce2f7]">
              {visibleRegistrations.map((registration) => (
                <Link
                  key={registration.id}
                  className="grid gap-3 py-4 text-[#141b2b] no-underline sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center"
                  to={`/events/${registration.event.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold leading-6">{registration.event.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase ${statusClasses(registration.status)}`}>
                        {registration.status}
                      </span>
                    </div>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-[#434655]">
                      <Icon name="pin_drop" className="text-base text-[#00687a]" />
                      <span className="truncate">{registration.event.venue}</span>
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-[#434655]">{formatDateTime(registration.event.start_time)}</p>

                  <span className="inline-flex items-center justify-center gap-1 rounded-md border-2 border-[#141b2b] bg-white px-3 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[3px_3px_0_#141b2b]">
                    View
                    <Icon name="arrow_forward" className="text-base" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
