type VisitsLogProps = {
  currentUser: {
    id: string;
    name: string;
    role: 'rep' | 'manager';
  };
  onNewVisit: () => void;
};

export function VisitsLog({
  currentUser,
  onNewVisit,
}: VisitsLogProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Visits Log
        </h2>
        <button
          onClick={onNewVisit}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          New Visit
        </button>
      </div>

      <div className="text-sm text-gray-500">
        Logged in as: {currentUser.name}
      </div>

      {/* Stub content */}
      <div className="mt-4 text-gray-400 italic">
        Visits will appear here
      </div>
    </div>
  );
}