interface TransportERPSectionProps {
  transportCompany?: string;
  transportMeans?: string;
}

export function TransportERPSection({
  transportCompany,
  transportMeans,
}: TransportERPSectionProps) {
  return (
    <section className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
      <h2 className="text-lg font-semibold mb-2">
        🚚 Μεταφορικά (ERP)
      </h2>

      {transportCompany || transportMeans ? (
        <div className="text-sm text-gray-700 space-y-1">
          {transportCompany && (
            <div>
              <span className="text-gray-500">Μεταφορική:</span>{' '}
              <span className="font-medium">{transportCompany}</span>
            </div>
          )}

          {transportMeans && (
            <div>
              <span className="text-gray-500">Τρόπος:</span>{' '}
              <span className="font-medium">{transportMeans}</span>
            </div>
          )}

          <div className="text-xs text-gray-400 mt-2">
            Τα στοιχεία προέρχονται από το ERP και αποτελούν τη μοναδική πηγή αλήθειας.
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic">
          Δεν υπάρχουν καταχωρημένα μεταφορικά στο ERP
        </div>
      )}
    </section>
  );
}