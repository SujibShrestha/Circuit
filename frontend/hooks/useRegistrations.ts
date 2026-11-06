import { useCallback, useEffect, useState } from 'react';
import api from '../api/api';

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'attended';

export type Registration = {
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

/**
 * Loads GET /registrations/me once and exposes refresh() to call after an
 * action. Pass enabled=false on public pages for logged-out visitors so we
 * don't fire a request that would 401.
 */
export default function useRegistrations(enabled = true) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const request = new AbortController();

    api
      .get<Registration[]>('/registrations/me', { signal: request.signal })
      .then((response) => {
        setRegistrations(response.data);
        setError(null);
      })
      .catch(() => {
        if (request.signal.aborted) return;
        setError('Could not load your registrations.');
      })
      .finally(() => {
        if (!request.signal.aborted) setIsLoading(false);
      });

    return () => request.abort();
  }, [enabled]);

  const refresh = useCallback(async (): Promise<Registration[] | null> => {
    try {
      const response = await api.get<Registration[]>('/registrations/me');
      setRegistrations(response.data);
      setError(null);
      return response.data;
    } catch {
      setError('Could not load your registrations.');
      return null;
    }
  }, []);

  return { registrations, isLoading, error, refresh };
}
