import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export const COUNTRIES = [
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'SG', dial: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: 'NP', dial: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: 'BD', dial: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'LK', dial: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: 'MY', dial: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'JP', dial: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: 'RU', dial: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: 'NL', dial: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'CH', dial: '+41', flag: '🇨🇭', name: 'Switzerland' },
  { code: 'NZ', dial: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: 'KW', dial: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: 'QA', dial: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: 'OM', dial: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: 'BH', dial: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: 'TH', dial: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: 'ID', dial: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa' },
];

/**
 * Universal PhoneInput with Country Code Selector.
 * Allows user to switch between India (+91) and international countries.
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
  // Determine initial country based on incoming value or default to India
  const initialCountry = useMemo(() => {
    const rawVal = (typeof value === 'object' && value !== null)
      ? (value.target?.value ?? value.value ?? '')
      : String(value ?? '');
    if (rawVal && rawVal.startsWith('+')) {
      const match = COUNTRIES.find((c) => rawVal.startsWith(c.dial));
      if (match) return match;
    }
    return COUNTRIES[0]; // Default India
  }, []);

  const [country, setCountry] = useState(initialCountry);

  // Normalize incoming value to safe string
  const rawStringValue = useMemo(() => {
    if (typeof value === 'object' && value !== null) {
      return String(value.target?.value ?? value.value ?? '');
    }
    return String(value ?? '');
  }, [value]);

  // Sync if value externally changes to another country code
  useEffect(() => {
    if (rawStringValue && rawStringValue.startsWith('+')) {
      const match = COUNTRIES.find((c) => rawStringValue.startsWith(c.dial));
      if (match && match.code !== country.code) {
        setCountry(match);
      }
    }
  }, [rawStringValue]);

  // Strip dial code from display input
  const cleanDisplay = (val, currentCountry) => {
    if (!val) return '';
    const safeStr = typeof val === 'object' && val !== null
      ? (val.target?.value ?? val.value ?? '')
      : String(val);
    let digits = safeStr.replace(/[\s-]/g, '');

    // Strip dial code if present at start
    if (digits.startsWith(currentCountry.dial)) {
      digits = digits.slice(currentCountry.dial.length);
    } else if (currentCountry.code === 'IN' && digits.startsWith('91') && digits.length > 10) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length > 10) {
      digits = digits.slice(1);
    }

    // Format Indian 10 digits as XXXXX XXXXX for readability
    if (currentCountry.code === 'IN' && digits.length > 5) {
      return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
    }
    return digits;
  };

  const handleCountryChange = (e) => {
    const selectedCode = e.target.value;
    const nextCountry = COUNTRIES.find((c) => c.code === selectedCode) || COUNTRIES[0];
    setCountry(nextCountry);

    // Keep the current local digits and re-prefix with the new dial code
    const currentLocalDigits = cleanDisplay(rawStringValue, country).replace(/\D/g, '');
    const fullPhone = currentLocalDigits ? `${nextCountry.dial}${currentLocalDigits}` : '';
    const synthEvent = {
      target: {
        name,
        value: fullPhone,
      },
      value: fullPhone,
      toString: () => fullPhone,
    };
    if (onChange) {
      onChange(synthEvent);
    }
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, '');
    const fullPhone = digitsOnly ? `${country.dial}${digitsOnly}` : '';

    const synthEvent = {
      target: {
        name,
        value: fullPhone,
      },
      value: fullPhone,
      toString: () => fullPhone,
    };
    if (onChange) {
      onChange(synthEvent);
    }
  };

  const displayVal = cleanDisplay(rawStringValue, country);
  const isAdmin = variant === 'admin';

  return (
    <div
      className={`relative flex items-center overflow-hidden rounded-xl border transition-all ${
        isAdmin
          ? 'border-slate-300 bg-white shadow-sm focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100'
          : 'border-input bg-card shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      {/* Country Selector Dropdown */}
      <div className={`relative flex items-center shrink-0 border-r transition-colors ${
        isAdmin
          ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
          : 'border-border bg-muted/60 text-foreground/90 hover:bg-muted/90'
      }`}>
        <div className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold pointer-events-none select-none">
          <span className="text-base leading-none" role="img" aria-label={country.name}>
            {country.flag}
          </span>
          <span>{country.dial}</span>
          <ChevronDown size={14} className="text-muted-foreground ml-0.5" />
        </div>
        <select
          value={country.code}
          onChange={handleCountryChange}
          disabled={disabled}
          aria-label="Select Country Code"
          title="Change Country"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
        >
          {COUNTRIES.map((c) => (
            <option key={`${c.code}-${c.dial}`} value={c.code} className="bg-popover text-popover-foreground">
              {c.flag} {c.name} ({c.dial})
            </option>
          ))}
        </select>
      </div>

      {/* Local Phone Number Input */}
      <input
        type="tel"
        inputMode="numeric"
        id={id}
        name={name}
        value={displayVal}
        onChange={handleInputChange}
        placeholder={country.code === 'IN' ? placeholder : 'Enter phone number'}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={15}
        className={`w-full bg-transparent px-3 py-2 text-sm outline-none ${
          isAdmin
            ? 'text-slate-900 placeholder:text-slate-400'
            : 'text-foreground placeholder:text-muted-foreground'
        }`}
      />
    </div>
  );
}
