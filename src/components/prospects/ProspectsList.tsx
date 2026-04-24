import React from 'react';

type SalesRep = {
  id: string;
  name: string;
  role: 'rep' | 'manager';
};

type ProspectsListProps = {
  currentUser: SalesRep;
  onNewProspect: () => void;
  onSelectProspect: (prospect: any) => void;
};

export function ProspectsList({
  currentUser,
  onNewProspect,
  onSelectProspect,
}: ProspectsListProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Prospects
        </h2>
        <button
          onClick={onNewProspect}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"
        >
          New Prospect
        </button>
      </div>

      <div className="text-sm text-gray-500 mb-4">
        Logged in as: {currentUser.name}
      </div>

      {/* Stub content */}
      <div className="text-gray-400 italic">
        Prospects will appear here
      </div>
    </div>
  );
}