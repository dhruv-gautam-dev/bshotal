export default function Ornament({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-primary ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-primary/70" />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /></svg>
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-primary/70" />
    </div>
  );
}