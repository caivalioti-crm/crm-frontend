import { useState } from 'react';
import { MapPin, TrendingUp, User, ChevronDown } from 'lucide-react';
import { formatDate } from '../../utils/dateFormat';

const DEFAULT_VISIBLE = 5;

type CustomerListSectionProps = {
  title: string;
  customers: any[];
  currentUserRole: 'rep' | 'manager' | 'admin' | 'exec';
  onSelectCustomer: (customer: any) => void;
  getDaysSinceVisit: (date: string | undefined | null) => number;
  getRepName?: (repId: string) => string | undefined;
};

export function CustomerListSection({
  title,
  customers,
  currentUserRole,
  onSelectCustomer,
  getDaysSinceVisit,
  getRepName,
}: CustomerListSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleCustomers = expanded ? customers : customers.slice(0, DEFAULT_VISIBLE);
  const hasMore = customers.length > DEFAULT_VISIBLE;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          {title}
          <span className="ml-2 text-sm font-normal text-gray-500">
            {expanded ? customers.length : Math.min(DEFAULT_VISIBLE, customers.length)} of {customers.length}
          </span>
        </h2>
        {hasMore && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {expanded ? 'Show less' : `Show all ${customers.length}`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-gray-200">
        {visibleCustomers.map(customer => {
          const days = getDaysSinceVisit(customer.lastVisitDate);

          return (
            <button
              key={customer.code}
              onClick={() => onSelectCustomer(customer)}
              className="w-full px-4 sm:px-6 py-4 hover:bg-blue-50 active:bg-blue-100 transition-colors text-left group"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left */}
                <div className="flex-1 min-w-0">
                  {/* Code + name */}
                  <div className="flex items-center flex-wrap gap-2 mb-1.5">
                    <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-mono rounded shrink-0">
                      {customer.code}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 break-words">
                      {customer.name}
                    </h3>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {customer.city}, {customer.area}
                    </span>
                    {customer.type && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                        {customer.type}
                      </span>
                    )}
                    {customer.group && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                        {customer.group}
                      </span>
                    )}
                    {(currentUserRole === 'manager' || currentUserRole === 'admin') &&
                      customer.assignedRepId && getRepName && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {getRepName(customer.assignedRepId)}
                        </span>
                      )}
                  </div>

                  {/* Last visit */}
                  <div className="text-xs mt-1">
                    <span className="text-gray-400">Last visit: </span>
                    {!customer.lastVisitDate ? (
                      <span className="text-gray-400">No visits yet</span>
                    ) : (
                      <span className={days > 90 ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                        {formatDate(customer.lastVisitDate)}
                        {days > 90 && (
                          <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                            {days}d ago
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right icon */}
                <TrendingUp className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0 mt-1" />
              </div>
            </button>
          );
        })}

        {customers.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">
            No customers found matching your criteria
          </div>
        )}
      </div>

      {/* Bottom expand button */}
      {hasMore && (
        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Show less' : `Show all ${customers.length} customers`}
          </button>
        </div>
      )}
    </div>
  );
}