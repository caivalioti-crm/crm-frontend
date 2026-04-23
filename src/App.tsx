
import React, { useCallback } from 'react';
import {
  getCustomerDashboard,
  getCustomerReadiness,
  getTopCategories,
  getNeglectedCategories,
} from './api/crmApi';
import { useRetryableLoader } from './hooks/useRetryableLoader';
import { ErrorRetry } from './components/ErrorRetry';


/* ---------- Helpers ---------- */

const CATEGORY_LABELS: Record<string, string> = {
  FILTERS: 'Filters',
  BRAKES: 'Brakes',
  ENGINE: 'Engine',
  SUSPENSION: 'Suspension',
};

function labelCategory(code: string) {
  return CATEGORY_LABELS[code] ?? code;
}

const cardStyle = {
  padding: 16,
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
};

/* ---------- App ---------- */

function App() {
  /* ===== Stable loaders (IMPORTANT) ===== */
  const loadDashboard = useCallback(
    () => getCustomerDashboard('10234'),
    []
  );

  const loadReadiness = useCallback(
    () => getCustomerReadiness('10234'),
    []
  );

  const loadTopCategories = useCallback(
    () => getTopCategories('10234'),
    []
  );

  const loadNeglectedCategories = useCallback(
    () => getNeglectedCategories('10234'),
    []
  );

  /* ===== KPIs ===== */
  const {
    data: dashboard,
    loading: loadingDashboard,
    error: dashboardError,
    retry: retryDashboard,
  } = useRetryableLoader(
    loadDashboard,
    'Failed to load KPIs.'
  );

  const {
    data: readiness,
  } = useRetryableLoader(
    loadReadiness,
    '' // optional, no error UI
  );

  /* ===== Top Categories ===== */
  const {
    data: topCategories = [],
    loading: loadingTopCategories,
    error: topCategoriesError,
    retry: retryTopCategories,
  } = useRetryableLoader(
    loadTopCategories,
    'Failed to load top categories.'
  );

  /* ===== Neglected Categories ===== */
  const {
    data: neglectedCategories = [],
    loading: loadingNeglectedCategories,
    error: neglectedCategoriesError,
    retry: retryNeglectedCategories,
  } = useRetryableLoader(
    loadNeglectedCategories,
    'Failed to check neglected categories.'
  );

  /* ---------- Render ---------- */

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Customer Dashboard</h1>

      {/* ===== KPIs ===== */}
      {loadingDashboard ? (
        <div style={{ marginTop: 24 }}>Loading KPIs…</div>
      ) : (
        <>
          {dashboardError && (
            <ErrorRetry message={dashboardError} onRetry={retryDashboard} />
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24,
              marginTop: 24,
            }}
          >
            <div style={cardStyle}>
              <strong>Categories discussed</strong>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {dashboard?.categories_discussed_count}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>Subcategories discussed</strong>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {dashboard?.subcategories_discussed_count}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>Readiness score</strong>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {readiness?.readiness_score ?? '—'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Top Categories ===== */}
      <div style={{ marginTop: 32 }}>
        <h2>Top Categories</h2>

        {topCategoriesError && (
          <ErrorRetry
            message={topCategoriesError}
            onRetry={retryTopCategories}
          />
        )}

        {loadingTopCategories ? (
          <div>Loading top categories…</div>
        ) : topCategories.length === 0 ? (
          <div>No category data yet.</div>
        ) : (
          <ul>
            {topCategories.map((cat: any) => (
              <li key={cat.category_code}>
                <strong>{labelCategory(cat.category_code)}</strong> —{' '}
                {cat.total_discussions} discussions
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===== Neglected Categories ===== */}
      <div style={{ marginTop: 32 }}>
        <h2>Neglected Categories</h2>

        {neglectedCategoriesError && (
          <ErrorRetry
            message={neglectedCategoriesError}
            onRetry={retryNeglectedCategories}
          />
        )}

        {loadingNeglectedCategories ? (
          <div>Checking neglected categories…</div>
        ) : neglectedCategories.length === 0 ? (
          <div>No neglected categories 🎉</div>
        ) : (
          <ul>
            {neglectedCategories.map((cat: any) => (
              <li key={cat.category_code}>
                <strong>{labelCategory(cat.category_code)}</strong> — last
                discussed {cat.days_since_last_discussion} days ago
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===== Footer ===== */}
      <div style={{ marginTop: 24, color: '#555' }}>
        <strong>Last discussion:</strong>{' '}
        {dashboard?.last_discussion_date
          ? new Date(dashboard.last_discussion_date).toLocaleDateString()
          : '—'}
      </div>
    </div>
  );
}

export default App;