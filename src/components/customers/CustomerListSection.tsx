import { MapPin, TrendingUp, User } from 'lucide-react';
import { formatDate } from '../../utils/dateFormat';

type CustomerListSectionProps = {
  title: string;
  customers: any[];
  currentUserRole: 'rep' | 'manager';
  onSelectCustomer: (customer: any) => void;
  getDaysSinceVisit: (date: string) => number;
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
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          {title} ({customers.length})
        </h2>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-200">
        {customers.map(customer => {
          const days = getDaysSinceVisit(customer.lastVisitDate);

          return (
            <button
              key={customer.code}
              onClick={() => onSelectCustomer(customer)}
              className="
                w-full px-4 sm:px-6 py-4 sm:py-5
                hover:bg-blue-50 active:bg-blue-100
                transition-colors text-left group
              "
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left */}
                <div className="flex-1 min-w-0">
                  {/* Code + name */}
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span className="px-2 py-1 bg-gray-900 text-white text-xs font-mono rounded shrink-0">
                      {customer.code}
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-600 break-words">
                      {customer.name}
                    </h3>
                  </div>

                  {/* Legal name */}
                  {customer.nameGreek && (
                    <div className="text-sm text-gray-600 mb-2">
                      {customer.nameGreek}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {customer.city}, {customer.area}
                    </span>

                    {customer.type && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {customer.type}
                      </span>
                    )}

                    {customer.group && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {customer.group}
                      </span>
                    )}

                    {currentUserRole === 'manager' &&
                      customer.assignedRepId &&
                      getRepName && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {getRepName(customer.assignedRepId)}
                        </span>
                      )}
                  </div>

                  {/* Last visit */}
                  <div className="text-xs sm:text-sm mt-1">
                    <span className="text-gray-500">Last visit: </span>
                    <span
                      className={
                        days > 90
                          ? 'text-orange-600 font-medium'
                          : 'text-gray-500'
                      }
                    >
                      {formatDate(customer.lastVisitDate)}
                      {days > 90 && (
                        <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                          {days} days ago
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Right icon */}
                <TrendingUp className="w-5 h-5 text-gray-400 group-hover:text-blue-600 shrink-0 mt-1" />
              </div>
            </button>
          );
        })}

        {customers.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            No customers found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}
