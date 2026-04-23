import { useCallback, useEffect, useState } from 'react';

export function useRetryableLoader<T>(
  loader: () => Promise<T>,
  errorMessage: string
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);

    loader()
      .then(setData)
      .catch(() => {
        if (errorMessage) setError(errorMessage);
      })
      .finally(() => setLoading(false));
  }, [loader, errorMessage]);

  // ✅ THIS WAS MISSING
  useEffect(() => {
    run();
  }, [run]);

  return {
    data,
    loading,
    error,
    retry: run,
  };
}
