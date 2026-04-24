import React from 'react';

type SalesRep = {
  id: string;
  name: string;
  role: 'rep' | 'manager';
};

type NewProspectDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SalesRep;
  onSave: (prospectData: any) => void;
};

export function NewProspectDialog({
  isOpen,
  onClose,
  currentUser,
  onSave,
}: NewProspectDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          New Prospect
        </h2>

        <div className="text-sm text-gray-600 mb-4">
          Created by: {currentUser.name}
        </div>

        {/* Stub UI */}
        <div className="space-y-3">
          <button
            onClick={() => {
              onSave({});
              onClose();
            }}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Save Prospect
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