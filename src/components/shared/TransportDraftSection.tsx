import { Truck, AlertTriangle } from 'lucide-react';

export interface TransportDraft {
  transportCompany?: string;
  transportMeans?: string;
}

interface TransportDraftSectionProps {
  value?: TransportDraft;
  onChange?: (next: TransportDraft) => void;
}

export function TransportDraftSection({
  value,
  onChange,
}: TransportDraftSectionProps) {
  return (
    <section className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-400">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Truck className="w-5 h-5 text-yellow-600" />
        Μεταφορικά (Πρόχειρο)
      </h2>

      <div className="text-sm text-gray-500 mb-4 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 shrink-0" />
        <span>
          Συλλέγονται για επιβεβαίωση πριν καταχώρηση στο ERP.
          Δεν αποτελούν οριστικά στοιχεία.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {/* Transport Company */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Μεταφορική
          </label>
          <input
            type="text"
            value={value?.transportCompany ?? ''}
            onChange={e =>
              onChange?.({
                ...value,
                transportCompany: e.target.value,
              })
            }
            placeholder="π.χ. ACS, Γενική Ταχυδρομική"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>

        {/* Transport Means */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Τρόπος Μεταφοράς
          </label>
          <input
            type="text"
            value={value?.transportMeans ?? ''}
            onChange={e =>
              onChange?.({
                ...value,
                transportMeans: e.target.value,
              })
            }
            placeholder="π.χ. Courier, Ιδιόκτητο όχημα"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>
      </div>
    </section>
  );
}