interface TransportERPSectionProps {
  transportCompany?: string;
  transportMeans?: string;
}

export function TransportERPSection({
  transportCompany,
  transportMeans,
}: TransportERPSectionProps) {
  return (
    <section className="bg-card text-card-foreground rounded-xl shadow-md p-6 border-l-4 border-blue-500">

      <h2 className="text-lg font-semibold mb-2">
        🚚 Μεταφορικά (ERP)
      </h2>

      {transportCompany || transportMeans ? (
        <div className="text-sm text-muted-foreground space-y-1">
          {transportCompany && (
            <div>
              <span className="text-muted-foreground">Μεταφορική:</span>{' '}
              <span className="font-medium">{transportCompany}</span>
            </div>
          )}

          {transportMeans && (
            <div>
              <span className="text-muted-foreground">Τρόπος:</span>{' '}
              <span className="font-medium">{transportMeans}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground/70 mt-2">
            Τα στοιχεία προέρχονται από το ERP και αποτελούν τη μοναδική πηγή αλήθειας.
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground/70 italic">
          Δεν υπάρχουν καταχωρημένα μεταφορικά στο ERP
        </div>
      )}
    </section>
  );
}