import { MapPin, ExternalLink } from 'lucide-react';

type CustomerCardProps = {
  code: string;
  name: string;
  legalName?: string;
  city: string;
  area: string;
  tags: string[];
  lastVisit?: string;
  onClick?: () => void;
};

export function CustomerCard({
  code,
  name,
  legalName,
  city,
  area,
  tags,
  lastVisit,
  onClick,
}: CustomerCardProps) {
  return (
    <button
      onClick={onClick}
      className="
        w-full text-left bg-white rounded-xl border
        px-4 py-3 space-y-2
        hover:bg-gray-50 transition
      "
    >
      {/* Row 1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-gray-900 text-white rounded-md px-2 py-0.5">
            {code}
          </span>
          <span className="font-semibold text-gray-900">
            {name}
          </span>
        </div>

        <ExternalLink className="w-4 h-4 text-gray-400" />
      </div>

      {/* Row 2 */}
      {legalName && (
        <div className="text-sm text-gray-500">
          {legalName}
        </div>
      )}

      {/* Row 3 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex items-center gap-1 text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{city}, {area}</span>
        </div>

        {tags.map(tag => (
          <span
            key={tag}
            className="
              rounded-full px-2 py-0.5
              text-xs font-medium
              bg-blue-100 text-blue-700
            "
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Row 4 */}
      {lastVisit && (
        <div className="text-xs text-gray-500">
          Last visit: {lastVisit}
        </div>
      )}
    </button>
  );
}