import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import Navbar from '../components/Navbar';

type Scope = 'global' | 'college';

type LeaderboardEntry = {
  rank: number;
  id: string;
  name: string;
  college: string | null;
  xp: number;
  level: number;
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const request = new AbortController();

    api
      .get<LeaderboardEntry[]>('/leaderboard', {
        params: { scope, limit: 50 },
        signal: request.signal,
      })
      .then((response) => setEntries(response.data))
      .catch(() => {
        if (request.signal.aborted) return;
        setError('Could not load the leaderboard.');
      })
      .finally(() => {
        if (!request.signal.aborted) setIsLoading(false);
      });

    return () => request.abort();
  }, [scope]);

  const hasCollege = Boolean(user?.college);

  // Resetting loading/error here rather than in the effect keeps setState out
  // of the effect body (react-hooks/set-state-in-effect).
  function selectScope(next: Scope) {
    if (next === scope) return;
    setScope(next);
    setIsLoading(true);
    setError(null);
  }

  return (
    <div className="min-h-svh bg-[#f9f9ff] text-[#141b2b]">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-24 lg:px-10">
        <p className="font-['Space_Grotesk'] text-xs font-bold uppercase text-[#434655]">Circuit Rankings</p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">Leaderboard</h1>

        <div className="mt-5 flex gap-2" role="group" aria-label="Leaderboard scope">
          {([
            { id: 'global' as const, label: 'Global', icon: 'public', disabled: false },
            { id: 'college' as const, label: 'My College', icon: 'school', disabled: !hasCollege },
          ]).map((option) => {
            const active = scope === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                disabled={option.disabled}
                title={option.disabled ? 'Add a college to your profile to see this' : undefined}
                onClick={() => selectScope(option.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[#141b2b] px-4 py-1.5 font-['Space_Grotesk'] text-xs font-semibold uppercase leading-4 shadow-[3px_3px_0_#141b2b] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:border-[#dce2f7] disabled:bg-white disabled:text-[#747686] disabled:shadow-none ${
                  active ? 'bg-[#1d4ed8] text-white' : 'bg-white text-[#141b2b]'
                }`}
              >
                <Icon name={option.icon} className={`text-base ${active ? 'text-white' : 'text-[#434655]'}`} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="mt-8 rounded-md border border-[#dce2f7] bg-white px-4 py-3 text-sm font-medium text-[#434655]">
            Loading leaderboard
          </div>
        )}

        {!isLoading && error && (
          <div className="mt-8 rounded-md border-2 border-[#141b2b] bg-white px-5 py-4 shadow-[3px_3px_0_#141b2b]">
            <p className="font-['Space_Grotesk'] text-sm font-bold uppercase">{error}</p>
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="mt-8 rounded-md border border-[#dce2f7] bg-white px-4 py-3 text-sm font-medium text-[#434655]">
            {scope === 'college' && !hasCollege
              ? 'Add a college to your profile to see your college rankings.'
              : 'No entries yet.'}
          </div>
        )}

        {!isLoading && !error && entries.length > 0 && (
          <ol className="mt-6 grid gap-2" aria-label="Leaderboard rankings">
            {entries.map((entry) => {
              const isMe = entry.id === user?.id;
              const podium = entry.rank <= 3;

              return (
                <li
                  key={entry.id}
                  className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-white px-4 py-3 ${
                    isMe
                      ? 'border-2 border-[#141b2b] shadow-[3px_3px_0_#141b2b]'
                      : 'border border-[#dce2f7]'
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-md border-2 border-[#141b2b] font-['Space_Grotesk'] text-sm font-bold ${
                      podium ? 'bg-[#57dffe] text-[#006172]' : 'bg-white text-[#434655]'
                    }`}
                    aria-label={`Rank ${entry.rank}`}
                  >
                    {entry.rank}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-5">
                      {entry.name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-[#e9edff] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase text-[#1d4ed8]">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs leading-4 text-[#434655]">
                      {entry.college ?? 'No college'} · Level {entry.level}
                    </p>
                  </div>

                  <span className="font-['Space_Grotesk'] text-sm font-bold tabular-nums">
                    {entry.xp.toLocaleString()} XP
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
