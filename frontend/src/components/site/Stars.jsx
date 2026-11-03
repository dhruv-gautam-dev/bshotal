import { Star } from 'lucide-react';

export function Stars({ value, size = 16 }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? 'fill-primary text-primary' : 'text-muted-foreground/40'} />
      ))}
    </div>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} stars`} onClick={() => onChange(n)} className="h-12 w-12 flex items-center justify-center">
          <Star size={30} className={n <= value ? 'fill-primary text-primary' : 'text-muted-foreground/50'} />
        </button>
      ))}
    </div>
  );
}