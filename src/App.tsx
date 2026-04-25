import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardFigma } from './components/dashboard/DashboardFigma';
import { OfflineBanner } from './components/system/OfflineBanner';

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
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <DashboardFigma />
    </QueryClientProvider>
  );
}

export default App;