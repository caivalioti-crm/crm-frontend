import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardFigma } from './components/dashboard/DashboardFigma';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,   // ✅ when user returns to tab
      refetchOnReconnect: true,     // ✅ when internet reconnects
      staleTime: 30_000,            // ✅ 30s freshness window
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardFigma />
    </QueryClientProvider>
  );
}

export default App;