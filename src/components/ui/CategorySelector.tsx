import { useState, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type CategoryItem = {
  category_code: string;
  parent_code: string | null;
  level: number;
  full_name: string;
  short_name: string;
};

export type SelectedCategory = {
  categoryCode: string;
  subcategoryCode?: string;
};

type CategorySelectorProps = {
  allCategories: CategoryItem[];
  selected: SelectedCategory[];
  onChange: (selected: SelectedCategory[]) => void;
};

function Checkbox({ checked, partial }: { checked: boolean; partial?: boolean }) {
  return (
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
      checked ? 'bg-blue-600 border-blue-600'
      : partial ? 'bg-blue-100 border-blue-400 border-dashed'
      : 'border-gray-300'
    }`}>
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {partial && !checked && <div className="w-2 h-0.5 bg-blue-400 rounded" />}
    </div>
  );
}

export function CategorySelector({ allCategories, selected, onChange }: CategorySelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSubcategory, setExpandedSubcategory] = useState<string | null>(null);

  const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const subcategoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const level1Categories = useMemo(() =>
    allCategories.filter(c => c.level === 1).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [allCategories]
  );

  const childrenOf = (parentCode: string) =>
    allCategories.filter(c => c.parent_code === parentCode);

  const isSelected = (categoryCode: string, subcategoryCode?: string) =>
    selected.some(s => s.categoryCode === categoryCode && s.subcategoryCode === subcategoryCode);

  const countSpecific = (categoryCode: string) =>
    selected.filter(s => s.categoryCode === categoryCode && s.subcategoryCode !== undefined).length;

  const isGeneralSelected = (categoryCode: string) =>
    selected.some(s => s.categoryCode === categoryCode && s.subcategoryCode === undefined);

  const toggle = (categoryCode: string, subcategoryCode?: string) => {
    if (isSelected(categoryCode, subcategoryCode)) {
      onChange(selected.filter(s =>
        !(s.categoryCode === categoryCode && s.subcategoryCode === subcategoryCode)
      ));
    } else {
      onChange([...selected, { categoryCode, subcategoryCode }]);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="block text-sm font-medium text-gray-700">Categories Discussed</span>
        {selected.length > 0 && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            {selected.length} selected
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><Checkbox checked={true} /> Specific</span>
        <span className="flex items-center gap-1.5"><Checkbox checked={false} partial={true} /> General</span>
      </div>
      <div className="border border-gray-300 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
        {level1Categories.map(cat => {
          const level2 = childrenOf(cat.category_code);
          const isExpanded = expandedCategory === cat.category_code;
          const specificCount = countSpecific(cat.category_code);
          const generalSelected = isGeneralSelected(cat.category_code);
          const anySelected = specificCount > 0 || generalSelected;

          return (
            <div
              key={cat.category_code}
              className="border-b border-gray-200 last:border-b-0"
              ref={el => { if (el) categoryRefs.current.set(cat.category_code, el); }}
            >
              <button
                onClick={() => {
                  if (level2.length > 0) {
                    const next = isExpanded ? null : cat.category_code;
                    setExpandedCategory(next);
                    setExpandedSubcategory(null);
                    if (next) setTimeout(() => {
                      categoryRefs.current.get(cat.category_code)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                  } else {
                    toggle(cat.category_code);
                  }
                }}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${anySelected ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {level2.length === 0 && <Checkbox checked={isSelected(cat.category_code)} />}
                  <span className="text-sm font-medium text-gray-900">{cat.full_name}</span>
                  {generalSelected && specificCount === 0 && (
                    <span className="px-2 py-0.5 border border-dashed border-blue-400 text-blue-500 rounded text-xs">general</span>
                  )}
                  {specificCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">
                      {specificCount}{generalSelected && '+gen'}
                    </span>
                  )}
                </div>
                {level2.length > 0 && (
                  isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {level2.length > 0 && isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => toggle(cat.category_code)}
                    className={`w-full px-6 py-2.5 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left border-b border-gray-200 ${generalSelected ? 'bg-blue-50' : ''}`}
                  >
                    <Checkbox checked={false} partial={generalSelected} />
                    <span className="text-sm text-gray-500 italic">General — {cat.short_name}</span>
                  </button>

                  {level2.map(sub => {
                    const level3 = childrenOf(sub.category_code);
                    const isSubExpanded = expandedSubcategory === sub.category_code;
                    const subSpecificCount = countSpecific(sub.category_code);
                    const subGeneralSelected = isGeneralSelected(sub.category_code);
                    const subAnySelected = isSelected(cat.category_code, sub.category_code) || subSpecificCount > 0 || subGeneralSelected;

                    return (
                      <div
                        key={sub.category_code}
                        ref={el => { if (el) subcategoryRefs.current.set(sub.category_code, el); }}
                      >
                        <button
                          onClick={() => {
                            if (level3.length > 0) {
                              const next = isSubExpanded ? null : sub.category_code;
                              setExpandedSubcategory(next);
                              if (next) setTimeout(() => {
                                subcategoryRefs.current.get(sub.category_code)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                              }, 50);
                            } else {
                              toggle(cat.category_code, sub.category_code);
                            }
                          }}
                          className={`w-full px-6 py-2.5 flex items-center justify-between hover:bg-gray-100 transition-colors text-left ${subAnySelected ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            {level3.length === 0 && <Checkbox checked={isSelected(cat.category_code, sub.category_code)} />}
                            <span className="text-sm text-gray-700">{sub.full_name}</span>
                            {subGeneralSelected && subSpecificCount === 0 && (
                              <span className="px-2 py-0.5 border border-dashed border-blue-400 text-blue-500 rounded text-xs">general</span>
                            )}
                            {subSpecificCount > 0 && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">
                                {subSpecificCount}{subGeneralSelected && '+gen'}
                              </span>
                            )}
                          </div>
                          {level3.length > 0 && (
                            isSubExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />
                          )}
                        </button>

                        {level3.length > 0 && isSubExpanded && (
                          <div className="bg-white border-t border-gray-100">
                            <button
                              onClick={() => toggle(sub.category_code)}
                              className={`w-full px-10 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 ${subGeneralSelected ? 'bg-blue-50' : ''}`}
                            >
                              <Checkbox checked={false} partial={subGeneralSelected} />
                              <span className="text-sm text-gray-400 italic">General — {sub.short_name}</span>
                            </button>
                            {level3.map(sub3 => (
                              <button
                                key={sub3.category_code}
                                onClick={() => toggle(sub.category_code, sub3.category_code)}
                                className={`w-full px-10 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${isSelected(sub.category_code, sub3.category_code) ? 'bg-blue-50' : ''}`}
                              >
                                <Checkbox checked={isSelected(sub.category_code, sub3.category_code)} />
                                <span className="text-sm text-gray-600">{sub3.full_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}