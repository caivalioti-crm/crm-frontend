import React from 'react';

type Customer = {
  code: string;
  name: string;
};

type NewVisitDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSave: (visitData: any) => void;
};

export function NewVisitDialog({
  isOpen,
  onClose,
  customers,
  onSave,
}: NewVisitDialogProps) {
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

        {/* Stub UI */}
        <div className="space-y-3">
          <button
            onClick={() => {
              onSave({});
              onClose();
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg"
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
