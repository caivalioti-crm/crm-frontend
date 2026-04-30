import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardFigma } from './components/dashboard/DashboardFigma';
import { OfflineBanner } from './components/system/OfflineBanner';
import LoginScreen from './components/LoginScreen';
import { supabase } from './lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <DashboardFigma />
    </QueryClientProvider>
  );
}

export default App;