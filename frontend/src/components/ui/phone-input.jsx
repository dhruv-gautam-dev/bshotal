import React from 'react';

/**
 * Standard PhoneInput component with permanent Indian country code (+91).
 * Supports both public site and admin modal styling variants.
 */
export default function PhoneInput({
  value = '',
  onChange,
  placeholder = '98765 43210',
  id,
  name = 'phone',
  className = '',
  variant = 'public',
  required = false,
  autoComplete = 'tel',
  disabled = false,
}) {
  // Strip +91, 91, or 0 from display so country code doesn't duplicate inside input
  const cleanDisplay = (val) => {
    if (!val) return '';
    const digits = String(val)
      .replace(/[\s-]/g, '')
      .replace(/^(\+91|91|0)/, '')
      .replace(/\D/g, '')
      .slice(0, 10);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return digits;
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    const digitsOnly = raw
      .replace(/[\s-]/g, '')
      .replace(/^(\+91|91|0)/, '')
      .replace(/\D/g, '')
      .slice(0, 10);

    const synthEvent = {
      target: {
        name,
        value: digitsOnly ? `+91${digitsOnly}` : '',
      },
    };
    if (onChange) {
      onChange(synthEvent);
    }
  };

  const displayVal = cleanDisplay(value);

  const isAdmin = variant === 'admin';

  return (
    <div
      className={`relative flex items-center overflow-hidden rounded-xl border transition-all ${
        isAdmin
          ? 'border-slate-300 bg-white shadow-sm focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100'
          : 'border-input bg-card shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      <span
        className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold select-none shrink-0 border-r ${
          isAdmin
            ? 'bg-slate-100 text-slate-700 border-slate-200'
            : 'bg-muted/70 text-foreground/80 border-border'
        }`}
        title="India (+91)"
      >
        <span className="text-base leading-none" role="img" aria-label="India flag">
          🇮🇳
        </span>
        <span>+91</span>
      </span>
      <input
        type="tel"
        inputMode="numeric"
        id={id}
        name={name}
        value={displayVal}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={12}
        className={`w-full bg-transparent px-3 py-2 text-sm outline-none ${
          isAdmin
            ? 'text-slate-900 placeholder:text-slate-400'
            : 'text-foreground placeholder:text-muted-foreground'
        }`}
      />
    </div>
  );
}

