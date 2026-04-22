import { useEffect, useState } from 'react';
import {
  getCustomerDashboard,
  getCustomerReadiness,
  getTopCategories,
  getNeglectedCategories,
} from './api/crmApi';

function App() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [neglectedCategories, setNeglectedCategories] = useState<any[]>([]);

  useEffect(() => {
  Promise.all([
    getCustomerDashboard('10234'),
    getCustomerReadiness('10234'),
    getTopCategories('10234'),
    getNeglectedCategories('10234'),
  ])
    .then(
      ([
        dashboardRes,
        readinessRes,
        topCategoriesRes,
        neglectedCategoriesRes,
      ]) => {
        setDashboard(dashboardRes);
        setReadiness(readinessRes);
        setTopCategories(topCategoriesRes);
        setNeglectedCategories(neglectedCategoriesRes);
      }
    )
    .catch((err) => setError(err.message));
}, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!dashboard || !readiness) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Customer Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginTop: 24,
        }}
      >
        <div style={{ padding: 16, border: '1px solid #ccc' }}>
          <strong>Categories discussed</strong>
          <div>{dashboard.categories_discussed_count}</div>
        </div>

        <div style={{ padding: 16, border: '1px solid #ccc' }}>
          <strong>Subcategories discussed</strong>
          <div>{dashboard.subcategories_discussed_count}</div>
        </div>

        <div style={{ padding: 16, border: '1px solid #ccc' }}>
          <strong>Readiness score</strong>
          <div>{readiness?.readiness_score ?? '—'}</div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
       <h2>Top Categories</h2>

       {topCategories.length === 0 ? (
        <div>No category data yet.</div>
       ) : (
       <ul>
       {topCategories.map((cat) => (
        <li key={cat.category_code}>
          <strong>{cat.category_code}</strong> — {cat.total_discussions} discussions
        </li>
      ))}
    </ul>
  )}
</div>

<div style={{ marginTop: 32 }}>
  <h2>Neglected Categories</h2>

  {neglectedCategories.length === 0 ? (
    <div>No neglected categories 🎉</div>
  ) : (
    <ul>
      {neglectedCategories.map((cat) => (
        <li key={cat.category_code}>
          <strong>{cat.category_code}</strong> — last discussed{' '}
          {cat.days_since_last_discussion} days ago
        </li>
      ))}
    </ul>
  )}
</div>

      <div style={{ marginTop: 24 }}>
        <strong>Last discussion:</strong>{' '}
        {dashboard.last_discussion_date}
      </div>
    </div>
  );
}

export default App;