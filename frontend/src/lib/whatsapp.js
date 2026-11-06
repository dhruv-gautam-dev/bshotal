import { SITE } from '@/data/site';

export const waLink = (text = '') =>
  `https://wa.me/${SITE.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const openWhatsApp = (text) => window.open(waLink(text), '_blank', 'noopener');

export const makeRef = (prefix = 'BSH') => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const isValidPhone = (v) => {
  if (!v) return false;
  const clean = String(v).replace(/[\s-]/g, '');
  if (/^(\+91|91|0)?[6-9]\d{9}$/.test(clean)) return true;
  if (/^\+[1-9]\d{6,14}$/.test(clean)) return true;
  return /^\d{7,12}$/.test(clean);
};

export const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;