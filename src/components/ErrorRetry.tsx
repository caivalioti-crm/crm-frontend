type Props = {
  message: string;
  onRetry: () => void;
};

export function ErrorRetry({ message, onRetry }: Props) {
  return (
    <div style={{ color: '#b91c1c', marginBottom: 8 }}>
      {message}{' '}
      <button
        onClick={onRetry}
        style={{
          marginLeft: 8,
          background: 'none',
          border: 'none',
          color: '#2563eb',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Retry
      </button>
    </div>
  );
}