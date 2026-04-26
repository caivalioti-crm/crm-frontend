interface InlineErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function InlineError({ title, message, onRetry }: InlineErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      {title && (
        <div className="font-semibold mb-1 text-destructive">
          {title}
        </div>
      )}
      <div className="text-muted-foreground">{message}</div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs underline text-destructive"
        >
          Retry
        </button>
      )}
    </div>
  );
}