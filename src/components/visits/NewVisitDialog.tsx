import { useState } from 'react';

type Customer = {
  code: string;
  name: string;
};

type NewVisitDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSave: (visitData: any) => Promise<void>;

  isSaving?: boolean;
  error?: string | null;
};

export function NewVisitDialog({
  isOpen,
  onClose,
  customers,
  onSave,
}: NewVisitDialogProps) {
  const [selectedCustomerCode, setSelectedCustomerCode] = useState<string>('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          New Visit
        </h2>

        <div className="mb-4 text-sm text-gray-600">
          Select customer ({customers.length})
        </div>

        {/* ✅ EMPTY STATE MESSAGE */}
        {customers.length === 0 && (
          <div className="mb-4 text-sm text-red-600">
            No customers match the current filters.
          </div>
        )}

        {/* ✅ CUSTOMER SELECTION */}
        
        <div className="space-y-3">
          <select
            value={selectedCustomerCode}
            onChange={(e) => setSelectedCustomerCode(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            disabled={!selectedCustomerCode}
            onClick={async () => {
              await onSave({ customerCode: selectedCustomerCode });
              onClose();
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            Save Visit
          </button>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}