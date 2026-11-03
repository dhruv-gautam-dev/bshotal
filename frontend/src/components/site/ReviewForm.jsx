import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { StarInput } from '@/components/site/Stars';

export default function ReviewForm() {
  const [f, setF] = useState({ name: '', rating: 0, comment: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr('Please enter your name.');
    if (!f.rating) return setErr('Please choose a star rating.');
    if (f.comment.trim().length < 10) return setErr('Please write at least a few words (10+ characters).');
    setErr('');
    setBusy(true);
    try {
      await base44.entities.Review.create({ name: f.name.trim(), rating: f.rating, comment: f.comment.trim(), status: 'pending' });
      setDone(true);
    } catch {
      setErr('Sorry, we could not submit your review. Please try again.');
    }
    setBusy(false);
  };

  if (done) return <p className="rounded-2xl border border-primary/40 bg-card p-6 text-center">Thank you! Your review was submitted and will appear after owner approval.</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-primary/30 bg-card p-6">
      <h3 className="text-2xl font-semibold">Write a review</h3>
      <label className="block text-sm">Your name<input className="field mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div><p className="text-sm">Rating</p><StarInput value={f.rating} onChange={(rating) => setF({ ...f, rating })} /></div>
      <label className="block text-sm">Your comment<textarea className="field mt-1 py-3" rows={4} value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} /></label>
      <p className="text-xs text-muted-foreground">Reviews appear on the website after approval by the owner.</p>
      {err && <p className="text-sm text-red-400" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="btn-gold w-full">{busy ? 'Submitting…' : 'Submit review'}</button>
    </form>
  );
}