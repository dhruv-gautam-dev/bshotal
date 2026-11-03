import { SITE } from '@/data/site';

export const waLink = (text = '') =>
  `https://wa.me/${SITE.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const openWhatsApp = (text) => window.open(waLink(text), '_blank', 'noopener');

export const makeRef = (prefix = 'BSH') => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const isValidPhone = (v) => /^[6-9]\d{9}$/.test(String(v).replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, ''));

export const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;