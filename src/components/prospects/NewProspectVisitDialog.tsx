interface NewProspectVisitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prospectId: string;
  prospectName: string;
  onSave: (visitData: any) => void;
}

export function NewProspectVisitDialog({
  isOpen,
  onClose,
  prospectId,
  prospectName,
  onSave,
}: NewProspectVisitDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          Νέα Επίσκεψη — {prospectName}
        </h2>

        <div className="text-sm text-gray-500">
          Prospect ID: {prospectId}
        </div>

        {/* Placeholder form */}
        <div className="text-sm text-gray-400 italic">
          Visit form will be implemented here
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-100 rounded-lg"
          >
            Άκυρο
          </button>
          <button
            onClick={() => {
              onSave({});
            }}
            className="px-3 py-2 bg-green-600 text-white rounded-lg"
          >
            Αποθήκευση
          </button>
        </div>
      </div>
    </div>
  );
}