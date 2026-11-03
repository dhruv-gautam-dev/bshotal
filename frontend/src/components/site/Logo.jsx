// Brand logo. Single source of truth for the asset + its two crops.
// The artwork carries generous dark padding, so each variant zooms to the exact
// region it needs (measured from the source) and blends over the dark UI.
const SRC =
  'https://media.apiClient.com/images/public/6aea02802823d81a2a6586e3/b6425cfaa_generated_a2a98077.png';

const VARIANTS = {
  // Lotus emblem + BS monogram only
  mark: { size: '346.6% 296.5%', pos: '50% 30.7%', ratio: '397 / 259' },
  // Emblem + wordmark + tagline
  full: { size: '184.2% 168.8%', pos: '50% 49.8%', ratio: '747 / 455' },
};

export default function Logo({ variant = 'mark', className = '' }) {
  const v = VARIANTS[variant];
  return (
    <span
      role="img"
      aria-label="B.S. Hotel & Restaurant"
      className={`block shrink-0 bg-no-repeat mix-blend-screen ${className}`}
      style={{
        backgroundImage: `url(${SRC})`,
        backgroundSize: v.size,
        backgroundPosition: v.pos,
        aspectRatio: v.ratio,
      }}
    />
  );
}