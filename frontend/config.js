// Backend API manzili.
// Netlify'da frontend va backend bitta domenda — shuning uchun bo'sh qoldiriladi ("/api/..." ishlatiladi).
// Agar backend boshqa domenda bo'lsa, masalan: window.VIP_API_URL = 'https://api.vip.uzb'
export const API_URL = (window.VIP_API_URL || '').replace(/\/$/, '');
