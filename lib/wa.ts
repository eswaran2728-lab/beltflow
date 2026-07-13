// WhatsApp deep-link helpers with trilingual message templates (EN / BM / Tamil).
import { Language } from './auth';

/** Build a wa.me deep link. Normalises MY numbers to 60xxxxxxxxx. */
export function waLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '6' + digits;          // 01... -> 601...
  else if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function atRiskMessage(studentName: string, lang: Language): string {
  switch (lang) {
    case 'ms':
      return `Salam, kami perasan ${studentName} telah terlepas beberapa kelas. Harap semuanya baik-baik sahaja. Kami harap dapat melihat mereka kembali berlatih minggu ini.`;
    case 'ta':
      return `வணக்கம், ${studentName} சில பயிற்சி வகுப்புகளைத் தவறவிட்டதை நாங்கள் கவனித்தோம். எல்லாம் நலமாக இருக்கிறது என நம்புகிறோம். இந்த வாரம் அவர்களை மீண்டும் பயிற்சியில் காண ஆவலாக உள்ளோம்.`;
    default:
      return `Hi, we noticed ${studentName} missed a few classes. Hope everything is okay. We would love to see them back in training this week.`;
  }
}

export function overdueMessage(studentName: string, amount: number, monthLabel: string, lang: Language): string {
  switch (lang) {
    case 'ms':
      return `Salam, ini peringatan mesra bahawa yuran bulanan untuk ${studentName} (${monthLabel}) sebanyak RM${amount} masih belum dijelaskan. Terima kasih.`;
    case 'ta':
      return `வணக்கம், ${studentName} இன் மாதாந்திர கட்டணம் (${monthLabel}) RM${amount} இன்னும் செலுத்தப்படவில்லை என்பதை நினைவூட்டுகிறோம். நன்றி.`;
    default:
      return `Hi, a friendly reminder that the monthly fee for ${studentName} (${monthLabel}) of RM${amount} is still outstanding. Thank you.`;
  }
}
