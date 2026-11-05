import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  min,
  max,
  className,
  id,
  name,
  disabled = false,
  required = false,
  variant = 'default', // 'default' (dark site) or 'admin' (light admin dashboard)
}) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const d = typeof value === 'string' ? parseISO(value) : value;
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  const minDate = React.useMemo(() => {
    if (!min) return undefined;
    try {
      const d = typeof min === 'string' ? parseISO(min) : min;
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  }, [min]);

  const maxDate = React.useMemo(() => {
    if (!max) return undefined;
    try {
      const d = typeof max === 'string' ? parseISO(max) : max;
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  }, [max]);

  const handleSelect = (date) => {
    if (!date) {
      onChange?.({ target: { value: '', name } });
    } else {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const formatted = `${yyyy}-${mm}-${dd}`;
      onChange?.({ target: { value: formatted, name } });
    }
    setOpen(false);
  };

  const isAdmin = variant === 'admin';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex items-center justify-between w-full min-h-[46px] rounded-xl border px-3.5 py-2.5 text-sm transition text-left outline-none cursor-pointer select-none',
            isAdmin
              ? 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
              : 'border-input bg-background text-foreground hover:border-primary/50 focus:ring-2 focus:ring-ring',
            !value && (isAdmin ? 'text-slate-400' : 'text-muted-foreground/70'),
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
          aria-label={placeholder}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className={cn('h-4 w-4 shrink-0', isAdmin ? 'text-amber-600' : 'text-primary')} />
            <span className="truncate">
              {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
            </span>
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-50', isAdmin ? 'text-slate-500' : 'text-muted-foreground')} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          'w-auto p-2 shadow-2xl z-[80] rounded-2xl border',
          isAdmin ? 'border-slate-200 bg-white text-slate-900' : 'border-primary/30 bg-card text-foreground'
        )}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(d) => {
            if (minDate) {
              const startOfMin = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
              if (d < startOfMin) return true;
            }
            if (maxDate) {
              const endOfMax = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59);
              if (d > endOfMax) return true;
            }
            return false;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default DatePicker;

