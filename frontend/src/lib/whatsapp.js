// WhatsApp direct messaging and click-to-chat integration helpers
export const whatsapp = {
  createChatUrl: (phone, text = '') => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
};

export default whatsapp;

