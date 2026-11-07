import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import useRegistrations, { type Registration } from '../hooks/useRegistrations';
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

type TeamMember = {
  id: string;
  name: string;
  email: string;
};

type Team = {
  id: string;
  event_id: string;
  leader_id: string;
  name: string;
  members: TeamMember[];
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
  spots_left?: number | null;
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const missingEventId = !eventId;
  const [event, setEvent] = useState<ApiEvent | null>(null);
  const [isLoading, setIsLoading] = useState(!missingEventId);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeEventId, setAttendeeEventId] = useState<string | null>(null);
  const [attendeesError, setAttendeesError] = useState<string | null>(null);
  const [attendBusyId, setAttendBusyId] = useState<string | null>(null);
  const [attendError, setAttendError] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const {
    registrations,
    isLoading: registrationsLoading,
    error: registrationsError,
    refresh: refreshRegistrations,
  } = useRegistrations(Boolean(user));
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamActionBusy, setTeamActionBusy] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [resultsBusy, setResultsBusy] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsMessage, setResultsMessage] = useState<string | null>(null);
  const [places, setPlaces] = useState<[string, string, string]>(['', '', '']);

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
    if (!eventId || !event?.allow_teams) {
      return;
    }

    const request = new AbortController();
    api
      .get<Team[]>(`/events/${eventId}/teams`, { signal: request.signal })
      .then((response) => {
        setTeams(response.data);
        setTeamsError(null);
      })
      .catch(() => {
        if (!request.signal.aborted) {
          setTeamsError('Could not load teams.');
        }
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setTeamsLoading(false);
        }
      });

    return () => request.abort();
  }, [event?.allow_teams, eventId]);

  useEffect(() => {
    if (!eventId || !isOrganizer) {
      return;
    }

    const request = new AbortController();
    api
      .get<Attendee[]>(`/events/${eventId}/attendees`, { signal: request.signal })
      .then((response) => {
        setAttendees(response.data);
        setAttendeeEventId(eventId);
        setAttendeesError(null);
      })
      .catch(() => {
        if (!request.signal.aborted) {
          setAttendeesError('Could not load attendees.');
        }
      })

    return () => request.abort();
  }, [eventId, isOrganizer]);

  const visibleAttendees = attendeeEventId === eventId ? attendees : [];
  const attendeesPending = isOrganizer && attendeeEventId !== eventId && !attendeesError;
  const activeRegistration =
    !isOrganizer && !registrationsLoading && !registrationsError
      ? (registrations.find(
          (item) => item.event_id === eventId && (item.status === 'confirmed' || item.status === 'waitlisted'),
        ) ?? null)
      : null;
  const spotsLeft = event?.spots_left == null ? null : Number(event.spots_left);
  const registrationPending = Boolean(user && !isOrganizer && registrationsLoading && !registrationsError);
  const position = useMemo(() => (event ? eventPosition(event) : null), [event]);
  const meta = event ? CATEGORY_META[event.category] : null;
  const yourTeam = user ? teams.find((team) => team.members.some((member) => member.id === user.id)) : null;
  const canCreateTeam = activeRegistration?.status === 'confirmed' && !yourTeam;

  function getApiErrorDetail(caught: unknown, fallback = 'Could not update your team.') {
    if (typeof caught === 'object' && caught !== null && 'response' in caught) {
      const response = (caught as { response?: { data?: { detail?: unknown } } }).response;
      if (typeof response?.data?.detail === 'string') return response.data.detail;
    }
    return fallback;
  }

  async function refreshTeamsAndRegistration() {
    if (!eventId) return;

    const [teamsResponse] = await Promise.all([
      api.get<Team[]>(`/events/${eventId}/teams`),
      refreshRegistrations(),
    ]);
    setTeams(teamsResponse.data);
  }

  async function handleCreateTeam() {
    if (!eventId || !user || !canCreateTeam || !teamName.trim() || teamActionBusy) return;

    setTeamActionBusy(true);
    setTeamsError(null);
    try {
      await api.post<Team>('/teams', { event_id: eventId, name: teamName.trim() });
      setTeamName('');
      await refreshTeamsAndRegistration();
    } catch (caught) {
      setTeamsError(getApiErrorDetail(caught));
    } finally {
      setTeamActionBusy(false);
    }
  }

  async function handleJoinTeam(teamId: string) {
    if (!user || yourTeam || teamActionBusy) {
      if (!user) navigate('/login');
      return;
    }

    setTeamActionBusy(true);
    setTeamsError(null);
    try {
      await api.post<Team>(`/teams/${teamId}/join`);
      await refreshTeamsAndRegistration();
    } catch (caught) {
      setTeamsError(getApiErrorDetail(caught));
    } finally {
      setTeamActionBusy(false);
    }
  }

  async function handleLeaveTeam() {
    if (!yourTeam || teamActionBusy) return;

    setTeamActionBusy(true);
    setTeamsError(null);
    try {
      await api.delete(`/teams/${yourTeam.id}/members/me`);
      await refreshTeamsAndRegistration();
    } catch (caught) {
      setTeamsError(getApiErrorDetail(caught));
    } finally {
      setTeamActionBusy(false);
    }
  }

  async function handleMarkAttended(attendee: Attendee) {
    if (!eventId || attendBusyId) return;

    setAttendBusyId(attendee.user.id);
    setAttendError(null);
    try {
      const response = await api.post<Attendee>(
        `/events/${eventId}/attendees/${attendee.user.id}/attend`,
      );
      setAttendees((current) =>
        current.map((item) => (item.id === response.data.id ? response.data : item)),
      );
    } catch (caught) {
      setAttendError(getApiErrorDetail(caught, 'Could not mark attendance.'));
    } finally {
      setAttendBusyId(null);
    }
  }

  // Placement XP targets: teams with an attended member, or attended people.
  const attendedIds = new Set(
    visibleAttendees.filter((attendee) => attendee.status === 'attended').map((attendee) => attendee.user.id),
  );
  const resultTargets = event?.allow_teams
    ? teams
        .filter((team) => team.members.some((member) => attendedIds.has(member.id)))
        .map((team) => ({ id: team.id, label: team.name }))
    : visibleAttendees
        .filter((attendee) => attendedIds.has(attendee.user.id))
        .map((attendee) => ({ id: attendee.user.id, label: attendee.user.name }));

  async function handlePostResults() {
    if (!eventId || !event || resultsBusy) return;

    const results = places
      .map((target, index) => ({ place: index + 1, target }))
      .filter((item) => item.target)
      .map((item) =>
        event.allow_teams
          ? { place: item.place, team_id: item.target }
          : { place: item.place, user_id: item.target },
      );

    if (results.length === 0) return;

    setResultsBusy(true);
    setResultsError(null);
    setResultsMessage(null);
    try {
      const response = await api.post<{ awarded: number }>(`/events/${eventId}/results`, { results });
      setResultsMessage(
        response.data.awarded > 0
          ? `Awarded placement XP to ${response.data.awarded} ${response.data.awarded === 1 ? 'person' : 'people'}.`
          : 'Results saved — those placements already had XP.',
      );
      setPlaces(['', '', '']);
    } catch (caught) {
      setResultsError(getApiErrorDetail(caught, 'Could not post results.'));
    } finally {
      setResultsBusy(false);
    }
  }

  const registrationLabel = !user
    ? 'Log in to register'
    : registrationPending
      ? 'Checking registration'
      : activeRegistration?.status === 'confirmed'
        ? 'Cancel registration'
        : activeRegistration?.status === 'waitlisted'
          ? 'Leave waitlist'
          : spotsLeft !== null && spotsLeft <= 0
            ? 'Join waitlist'
            : 'Register';

  async function refreshEvent() {
    if (!eventId) return;

    const response = await api.get<ApiEvent>(`/events/${eventId}`);
    setEvent(response.data);
  }

  async function handleRegistrationAction() {
    if (!eventId) return;

    if (!user) {
      navigate('/login');
      return;
    }

    if (isOrganizer || registrationPending || registrationBusy) {
      return;
    }

    setRegistrationBusy(true);
    setRegistrationError(null);

    try {
      if (activeRegistration) {
        await api.delete<Registration>(`/registrations/${activeRegistration.id}`);
      } else {
        await api.post<Registration>('/registrations/', { event_id: eventId });
      }

      await Promise.all([refreshRegistrations(), refreshEvent()]);
    } catch (caught) {
      if (typeof caught === 'object' && caught !== null && 'response' in caught) {
        const detail = (caught as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
        setRegistrationError(typeof detail === 'string' ? detail : 'Could not update your registration.');
      } else {
        setRegistrationError('Could not update your registration.');
      }
    } finally {
      setRegistrationBusy(false);
    }
  }

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
                      <p className="mt-1 text-xs text-[#747686]">Mark confirmed attendees as attended to award XP.</p>
                    </div>
                    <span className="rounded-full border-2 border-[#141b2b] bg-[#c7f464] px-3 py-1 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[2px_2px_0_#141b2b]">
                      {visibleAttendees.length} total
                    </span>
                  </div>

                  {attendeesPending && <p className="px-5 py-4 text-sm text-[#434655]">Loading attendees</p>}
                  {attendeesError && <p className="px-5 py-4 text-sm font-semibold text-[#9f1239]">{attendeesError}</p>}
                  {attendError && <p className="px-5 py-4 text-sm font-semibold text-[#9f1239]">{attendError}</p>}
                  {!attendeesPending && !attendeesError && visibleAttendees.length === 0 && <p className="px-5 py-4 text-sm text-[#434655]">No attendees yet.</p>}

                  {!attendeesPending && !attendeesError && visibleAttendees.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-[#dce2f7] bg-[#f1f3ff] font-['Space_Grotesk'] text-xs font-bold uppercase text-[#434655]">
                          <tr>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">College</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Registered</th>
                            <th className="px-5 py-3">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dce2f7]">
                          {visibleAttendees.map((attendee) => (
                            <tr key={attendee.id}>
                              <td className="px-5 py-3 font-semibold text-[#141b2b]">{attendee.user.name}</td>
                              <td className="px-5 py-3 text-[#434655]">{attendee.user.college || 'Not added'}</td>
                              <td className="px-5 py-3">
                                <span className="rounded-full border border-[#dce2f7] bg-white px-2 py-1 text-xs font-semibold uppercase text-[#434655]">
                                  {attendee.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-[#434655]">{formatDateTime(attendee.created_at)}</td>
                              <td className="px-5 py-3">
                                {attendee.status === 'confirmed' ? (
                                  <button
                                    type="button"
                                    disabled={Boolean(attendBusyId) || event.status === 'upcoming'}
                                    title={event.status === 'upcoming' ? 'Event has not started yet' : undefined}
                                    onClick={() => void handleMarkAttended(attendee)}
                                    className="rounded-md border-2 border-[#141b2b] bg-[#c7f464] px-3 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[2px_2px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#141b2b] disabled:cursor-not-allowed disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                                  >
                                    {attendBusyId === attendee.user.id ? 'Marking' : 'Mark attended'}
                                  </button>
                                ) : (
                                  <span className="text-[#747686]" aria-hidden="true">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {isOrganizer && event.status === 'completed' && (
                <div className="mt-6 overflow-hidden rounded-md border-2 border-[#141b2b] bg-white shadow-[3px_3px_0_#141b2b]">
                  <div className="border-b-2 border-[#141b2b] px-5 py-4">
                    <h2 className="font-['Space_Grotesk'] text-sm font-bold uppercase">Post results</h2>
                    <p className="mt-1 text-xs text-[#747686]">
                      Award 100 / 75 / 50 XP for 1st, 2nd and 3rd. Only
                      {event.allow_teams ? ' teams with an attended member' : ' attended people'} can place, and each
                      placement can only be posted once.
                    </p>
                  </div>

                  <div className="space-y-3 px-5 py-4">
                    {[0, 1, 2].map((index) => {
                      const taken = new Set(places.filter((_, other) => other !== index));
                      return (
                        <div key={index} className="flex flex-wrap items-center gap-3">
                          <span className="w-24 font-['Space_Grotesk'] text-xs font-bold uppercase text-[#434655]">
                            {['1st place', '2nd place', '3rd place'][index]}
                          </span>
                          <select
                            value={places[index]}
                            aria-label={`${['1st', '2nd', '3rd'][index]} place`}
                            onChange={(changeEvent) =>
                              setPlaces((current) =>
                                current.map((value, position) =>
                                  position === index ? changeEvent.target.value : value,
                                ) as [string, string, string],
                              )
                            }
                            className="min-w-0 flex-1 rounded-md border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                          >
                            <option value="">Skip this place</option>
                            {resultTargets.map((target) => (
                              <option key={target.id} value={target.id} disabled={taken.has(target.id)}>
                                {target.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}

                    {resultTargets.length === 0 && (
                      <p className="text-sm text-[#434655]">Mark attendees as attended first.</p>
                    )}
                    {resultsError && <p className="text-sm font-semibold text-[#9f1239]">{resultsError}</p>}
                    {resultsMessage && <p className="text-sm font-semibold text-[#00687a]">{resultsMessage}</p>}

                    <button
                      type="button"
                      disabled={resultsBusy || resultTargets.length === 0 || places.every((place) => !place)}
                      onClick={() => void handlePostResults()}
                      className="rounded-md border-2 border-[#141b2b] bg-[#c7f464] px-3 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[2px_2px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#141b2b] disabled:cursor-not-allowed disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    >
                      {resultsBusy ? 'Posting…' : 'Post results'}
                    </button>
                  </div>
                </div>
              )}

              {event.allow_teams && (
                <div className="mt-6 overflow-hidden rounded-md border-2 border-[#141b2b] bg-white shadow-[3px_3px_0_#141b2b]">
                  <div className="border-b-2 border-[#141b2b] px-5 py-4">
                    <h2 className="font-['Space_Grotesk'] text-sm font-bold uppercase">Teams</h2>
                    <p className="mt-1 text-xs text-[#747686]">Join a team of up to {event.max_team_size} members.</p>
                  </div>

                  {yourTeam && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce2f7] bg-[#f1f3ff] px-5 py-4">
                      <p className="text-sm font-semibold">Your team: {yourTeam.name}</p>
                      <button
                        type="button"
                        className="rounded-md border-2 border-[#141b2b] bg-white px-3 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[2px_2px_0_#141b2b] disabled:cursor-wait disabled:opacity-60"
                        disabled={teamActionBusy}
                        onClick={handleLeaveTeam}
                      >
                        Leave
                      </button>
                    </div>
                  )}

                  {canCreateTeam && (
                    <form
                      className="flex flex-col gap-2 border-b border-[#dce2f7] px-5 py-4 sm:flex-row"
                      onSubmit={(submitEvent) => {
                        submitEvent.preventDefault();
                        void handleCreateTeam();
                      }}
                    >
                      <input
                        value={teamName}
                        onChange={(changeEvent) => setTeamName(changeEvent.target.value)}
                        placeholder="Team name"
                        aria-label="Team name"
                        className="min-w-0 flex-1 rounded-md border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                      />
                      <button
                        type="submit"
                        className="rounded-md border-2 border-[#141b2b] bg-[#c7f464] px-3 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase shadow-[2px_2px_0_#141b2b] disabled:cursor-wait disabled:opacity-60"
                        disabled={teamActionBusy || !teamName.trim()}
                      >
                        Create team
                      </button>
                    </form>
                  )}

                  {teamsLoading && <p className="px-5 py-4 text-sm text-[#434655]">Loading teams</p>}
                  {teamsError && <p className="px-5 py-4 text-sm font-semibold text-[#9f1239]">{teamsError}</p>}
                  {!teamsLoading && !teamsError && teams.length === 0 && <p className="px-5 py-4 text-sm text-[#434655]">No teams yet.</p>}
                  {!teamsLoading && !teamsError && teams.length > 0 && (
                    <div className="divide-y divide-[#dce2f7]">
                      {teams.map((team) => {
                        const full = team.members.length >= event.max_team_size;
                        return (
                          <div key={team.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                            <div>
                              <p className="font-semibold">{team.name}</p>
                              <p className="mt-1 text-sm text-[#434655]">{team.members.length} / {event.max_team_size} members</p>
                            </div>
                            <button
                              type="button"
                              className="rounded-md border-2 border-[#141b2b] bg-[#1d4ed8] px-3 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase text-white shadow-[2px_2px_0_#141b2b] disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={full || Boolean(yourTeam) || teamActionBusy}
                              onClick={() => void handleJoinTeam(team.id)}
                            >
                              Join
                            </button>
                          </div>
                        );
                      })}
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
                    <span>
                      {spotsLeft !== null ? `${spotsLeft} spots left` : `${event.capacity.toLocaleString()} capacity`}
                    </span>
                  </p>
                  <p className="flex gap-2">
                    <Icon name="group_work" className="text-lg" />
                    <span>{event.allow_teams ? `Teams up to ${event.max_team_size}` : 'Solo participation'}</span>
                  </p>
                </div>
              </div>

              {!isOrganizer && (
                <div className="rounded-md border-2 border-[#141b2b] bg-white p-4 shadow-[3px_3px_0_#141b2b]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-[#141b2b] bg-[#1d4ed8] px-4 py-3 font-['Space_Grotesk'] text-xs font-bold uppercase text-white shadow-[3px_3px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#141b2b] disabled:cursor-wait disabled:opacity-70 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    disabled={registrationBusy || registrationPending}
                    onClick={handleRegistrationAction}
                  >
                    {registrationBusy ? 'Updating' : registrationLabel}
                    <Icon name={activeRegistration ? 'close' : 'how_to_reg'} className="text-base text-white" />
                  </button>
                  {(registrationError || registrationsError) && (
                    <p className="mt-3 text-sm font-semibold text-[#9f1239]">
                      {registrationError ?? registrationsError}
                    </p>
                  )}
                </div>
              )}

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

