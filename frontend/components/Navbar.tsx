import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS: { label: string; to?: string }[] = [
  { label: 'Map Explore', to: '/explore' },
  { label: 'Event Details', to: '/events' },
  { label: 'Leaderboard' },
  { label: 'My Profile' },
  { label: 'Host Event', to: '/host-event' },
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

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <header className="fixed inset-x-0 top-0 z-[1000] border-b border-[#dce2f7] bg-white">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 lg:px-10">
        <div className="flex min-w-0 items-center gap-6">
          <Link className="flex items-center gap-2 text-[#141b2b] no-underline" to="/explore">
            <img src="/circuit-mark.png" alt="" className="h-8 w-8 object-contain" />
            <span className="font-['Space_Grotesk'] text-sm font-bold uppercase leading-5 tracking-normal">Circuit</span>
          </Link>

          <nav className="hidden items-center gap-4 xl:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const isActive = item.to === '/events' ? location.pathname.startsWith('/events') : item.to === location.pathname;

              if (!item.to) {
                return (
                  <span
                    key={item.label}
                    className="py-1 font-['Space_Grotesk'] text-xs font-semibold uppercase leading-4 tracking-normal text-[#434655]"
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.label}
                  className={`py-1 no-underline ${
                    isActive
                      ? 'border-b-2 border-[#141b2b] text-lg font-semibold leading-6 text-[#141b2b]'
                      : "font-['Space_Grotesk'] text-xs font-semibold uppercase leading-4 tracking-normal text-[#434655]"
                  }`}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="rounded-full border-2 border-[#141b2b] bg-[#e9edff] px-4 py-1 font-['Space_Grotesk'] text-xs font-bold leading-4 shadow-[2px_2px_0_#141b2b]">
              {user.xp.toLocaleString()} XP
            </div>
          )}

          {user ? (
            <div
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#141b2b] bg-[#57dffe] font-['Space_Grotesk'] text-[10px] font-bold leading-3 text-[#006172] shadow-[2px_2px_0_#141b2b]"
              title={user.name}
            >
              {initials(user.name)}
            </div>
          ) : (
            <Link className="font-['Space_Grotesk'] text-xs font-semibold uppercase leading-4 tracking-normal text-[#434655] no-underline" to="/login">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

