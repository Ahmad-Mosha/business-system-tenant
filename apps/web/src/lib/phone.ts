/** An Egyptian mobile as a WhatsApp chat link: 010… becomes 2010…. */
export function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `2${digits}` : digits.length === 10 ? `20${digits}` : digits}`;
}
