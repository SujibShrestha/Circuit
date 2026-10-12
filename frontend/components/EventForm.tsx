import { useState, type ChangeEvent, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from './Navbar';

type EventCategory = 'hackathon' | 'workshop' | 'seminar' | 'meetup';

type EventFormState = {
  name: string;
  description: string;
  category: EventCategory;
  venue: string;
  start_time: string;
  end_time: string;
  capacity: string;
  allow_teams: boolean;
  max_team_size: string;
};

type ApiErrorDetail = string | { msg?: string } | { msg?: string }[];

const CATEGORY_OPTIONS: { value: EventCategory; label: string; icon: string }[] = [
  { value: 'hackathon', label: 'Hackathon', icon: 'terminal' },
  { value: 'workshop', label: 'Workshop', icon: 'memory' },
  { value: 'seminar', label: 'Seminar', icon: 'forum' },
  { value: 'meetup', label: 'Meetup', icon: 'groups' },
];

const initialForm: EventFormState = {
  name: '',
  description: '',
  category: 'hackathon',
  venue: '',
  start_time: '',
  end_time: '',
  capacity: '100',
  allow_teams: false,
  max_team_size: '1',
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

function errorMessage(error: unknown) {
  if (isAxiosError<{ detail?: ApiErrorDetail }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(' ');
    if (detail?.msg) return detail.msg;
  }

  return 'Could not create this event. Please check the fields and try again.';
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

export default function EventForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<EventFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value;

    setForm((current) => ({ ...current, [target.name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError('');
    setSubmitting(true);

    try {
      await api.post('/events/', {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        venue: form.venue.trim(),
        start_time: toIsoDateTime(form.start_time),
        end_time: toIsoDateTime(form.end_time),
        capacity: Number(form.capacity),
        allow_teams: form.allow_teams,
        max_team_size: form.allow_teams ? Number(form.max_team_size) : 1,
      });

      navigate('/explore', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-svh bg-[#f9f9ff] text-[#141b2b]">
      <Navbar />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-10 pt-24 lg:px-10">
        <section className="flex flex-col gap-3 border-b border-[#dce2f7] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase leading-3 tracking-normal text-[#00687a]">Host Console</p>
            <h1 className="mt-2 text-3xl font-bold leading-10 tracking-normal">Create Event</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#434655]">Publish an event with a venue the backend can geocode for the Explore map.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded border-2 border-[#141b2b] bg-white px-4 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal shadow-[3px_3px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#141b2b]"
            onClick={() => navigate('/explore')}
          >
            <Icon name="map" className="text-lg" />
            Map
          </button>
        </section>

        <form className="grid gap-4 lg:grid-cols-[1fr_20rem]" onSubmit={handleSubmit}>
          <section className="rounded-lg border-2 border-[#141b2b] bg-white p-4 shadow-[4px_4px_0_#141b2b] sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Event Name</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  required
                  minLength={3}
                  maxLength={150}
                  placeholder="Hack night, AI meetup, workshop..."
                  className="w-full rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                />
              </label>

              <label>
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Category</span>
                <select
                  name="category"
                  value={form.category}
                  onChange={updateField}
                  className="w-full rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Capacity</span>
                <input
                  name="capacity"
                  type="number"
                  min={1}
                  max={100000}
                  value={form.capacity}
                  onChange={updateField}
                  required
                  className="w-full rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Venue</span>
                <input
                  name="venue"
                  value={form.venue}
                  onChange={updateField}
                  required
                  minLength={3}
                  maxLength={300}
                  placeholder="Sankhu, Kathmandu"
                  className="w-full rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                />
              </label>

              <label>
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Starts</span>
                <input
                  name="start_time"
                  type="datetime-local"
                  value={form.start_time}
                  onChange={updateField}
                  required
                  className="w-full rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                />
              </label>

              <label>
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Ends</span>
                <input
                  name="end_time"
                  type="datetime-local"
                  value={form.end_time}
                  onChange={updateField}
                  required
                  className="w-full rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Description</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  maxLength={5000}
                  rows={5}
                  placeholder="Tell students what they will build, learn, or compete in."
                  className="w-full resize-y rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none focus:shadow-[0_0_0_3px_#b7c4ff]"
                />
              </label>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border-2 border-[#141b2b] bg-white p-4 shadow-[4px_4px_0_#141b2b]">
              <h2 className="font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Team Settings</h2>
              <label className="mt-3 flex items-center justify-between gap-3 rounded border-2 border-[#141b2b] bg-[#f1f3ff] px-3 py-2">
                <span className="font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal">Allow teams</span>
                <input name="allow_teams" type="checkbox" checked={form.allow_teams} onChange={updateField} className="h-5 w-5 accent-[#1d4ed8]" />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#434655]">Max Team Size</span>
                <input
                  name="max_team_size"
                  type="number"
                  min={1}
                  max={20}
                  value={form.max_team_size}
                  onChange={updateField}
                  disabled={!form.allow_teams}
                  className="w-full rounded border-2 border-[#141b2b] bg-[#f9f9ff] px-3 py-2 text-sm leading-6 outline-none disabled:opacity-50 focus:shadow-[0_0_0_3px_#b7c4ff]"
                />
              </label>
            </section>

            <section className="rounded-lg border-2 border-[#141b2b] bg-[#ffddb8] p-4 shadow-[4px_4px_0_#141b2b]">
              <h2 className="font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-[#2a1700]">Map Tip</h2>
              <p className="mt-2 text-sm leading-6 text-[#2a1700]">Use a specific venue like "Sankhu, Kathmandu" so the event can be geocoded and shown on Explore.</p>
            </section>

            {error && <p className="rounded border-2 border-[#ba1a1a] bg-[#ffdad6] px-3 py-2 text-sm font-semibold leading-5 text-[#93000a]" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded border-2 border-[#141b2b] bg-[#1d4ed8] px-4 py-3 font-['Space_Grotesk'] text-xs font-bold uppercase leading-4 tracking-normal text-white shadow-[4px_4px_0_#141b2b] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#141b2b] disabled:cursor-wait disabled:opacity-70"
            >
              <span>{submitting ? 'Creating Event' : 'Create Event'}</span>
              <Icon name="arrow_forward" className="text-lg" />
            </button>
          </aside>
        </form>
      </main>
    </div>
  );
}
