import { useState, useEffect } from 'react';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function parseAndFormatDate(input: string): string {
  const cleaned = input.trim().replace(/[.\-]/g, '/');
  const parts = cleaned.split('/');
  if (parts.length !== 3) return input;

  let [day, month, year] = parts;
  day = day.padStart(2, '0');
  month = month.padStart(2, '0');

  if (year.length === 2) {
    const num = Number(year);
    year = num < 50 ? `20${year}` : `19${year}`;
  }

  return `${day}/${month}/${year}`;
}

export function dateToISO(input: string): string {
  const formatted = parseAndFormatDate(input);
  const parts = formatted.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (year.length !== 4) return '';
  return `${year}-${month}-${day}`;
}

export function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

type SmartDateInputProps = {
  value: string;
  onChange: (displayValue: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  hint?: boolean;
  minDate?: string; // dd/mm/yyyy format
};

export function SmartDateInput({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  className = '',
  label,
  hint = true,
  minDate,
}: SmartDateInputProps) {
  const [raw, setRaw] = useState(value);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    setRaw(value);
  }, [value]);

  const handleBlur = () => {
    const formatted = parseAndFormatDate(raw);
    setRaw(formatted);

    if (minDate) {
      const inputISO = dateToISO(formatted);
      const minISO = dateToISO(minDate);
      if (inputISO && minISO && inputISO < minISO) {
        setDateError(`Cannot be before ${minDate}`);
        return;
      }
    }

    setDateError(null);
    onChange(formatted);
  };

  const baseClass = `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
    dateError ? 'border-red-400' : 'border-gray-300'
  } ${className}`;

  return (
    <div onClick={e => e.stopPropagation()}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      {isMobile ? (
        <input
          type="date"
          min={minDate ? dateToISO(minDate) : undefined}
          value={dateToISO(value)}
          onClick={e => e.stopPropagation()}
          onChange={e => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split('-');
            onChange(`${d}/${m}/${y}`);
          }}
          className={baseClass}
        />
      ) : (
        <>
          <input
            type="text"
            value={raw}
            onClick={e => e.stopPropagation()}
            onChange={e => { setRaw(e.target.value); setDateError(null); }}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={baseClass}
          />
          {dateError && (
            <p className="text-xs text-red-500 mt-1">{dateError}</p>
          )}
          {hint && !dateError && (
            <p className="text-xs text-gray-400 mt-1">e.g. 1/5/26 → 01/05/2026</p>
          )}
        </>
      )}
    </div>
  );
}