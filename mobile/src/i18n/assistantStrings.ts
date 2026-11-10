/**
 * H26 AI Assistant interface strings: English, Bahasa Melayu, Tamil.
 *
 * Scoped to the assistant screen only. App-wide localisation is H28.
 * The Bahasa Melayu and Tamil text needs native-speaker review before
 * release (H28 usability work).
 *
 * Suggested questions show a localised label but send a fixed English
 * `query`, because the current offline (extractive) provider matches
 * English academy records. Free-typed Malay and Tamil questions work only
 * partly until a multilingual live provider is enabled.
 */
import { RoleType } from '../types/auth';

export type AssistantLocale = 'en' | 'ms' | 'ta';
export type AnswerStatus = 'ANSWERED' | 'INSUFFICIENT_EVIDENCE' | 'ACTION_REFUSED' | 'OUT_OF_SCOPE' | 'BLOCKED';

export interface SuggestedQuestion {
  label: string;
  query: string;
}

export interface AssistantStrings {
  languageName: string;
  title: string;
  readOnlyNotice: string;
  privacyNotice: string;
  welcome: Record<RoleType, string>;
  suggestedHeading: string;
  suggestions: Record<RoleType, SuggestedQuestion[]>;
  inputPlaceholder: string;
  inputLabel: string;
  send: string;
  thinking: string;
  retry: string;
  clear: string;
  sourcesHeading: string;
  you: string;
  assistant: string;
  offline: string;
  status: Record<AnswerStatus, string>;
  sourceType: { document: string; syllabus: string; lesson: string; record: string; statistics: string };
  errors: { network: string; rateLimited: string; unavailable: string; forbidden: string; disabled: string; generic: string };
}

const EN_QUERIES: Record<RoleType, string[]> = {
  SUPER_ADMIN: ['How many persatuans are on the platform?', 'How many active students are on the platform?', 'Show the persatuan directory'],
  ADMIN_PERSATUAN: ['How many applications are pending approval?', 'Show class statistics', 'What is our retention rate?'],
  MASTER: ['Show my class roster', 'When is my next session?', 'What are the belt requirements?'],
  PARENT: ["How is my child's attendance?", 'What fees are outstanding?', 'When is the next class?'],
  STUDENT: ['What is my current belt?', 'When is my next class?', 'What do I need for my next grading?'],
};

const withQueries = (labels: Record<RoleType, string[]>): Record<RoleType, SuggestedQuestion[]> =>
  (Object.keys(EN_QUERIES) as RoleType[]).reduce((acc, role) => {
    acc[role] = labels[role].map((label, i) => ({ label, query: EN_QUERIES[role][i] }));
    return acc;
  }, {} as Record<RoleType, SuggestedQuestion[]>);

export const ASSISTANT_STRINGS: Record<AssistantLocale, AssistantStrings> = {
  en: {
    languageName: 'EN',
    title: 'BeltFlow Assistant',
    readOnlyNotice: 'Read-only: this assistant never approves, grades, changes attendance or handles payments.',
    privacyNotice: 'This conversation stays on this screen only and is not saved on your device.',
    welcome: {
      SUPER_ADMIN: "Ask about platform-level information. I only use aggregate statistics; individual children's records are not available to Super Admin.",
      ADMIN_PERSATUAN: "Ask about your Persatuan's classes, approval queues, syllabus, policies and analytics.",
      MASTER: 'Ask about the classes you currently lead, your rosters, schedules, lesson plans and the syllabus.',
      PARENT: "Ask about your linked children's schedules, attendance, fees, progress and notices.",
      STUDENT: 'Ask about your progress, achievements, schedule and the published syllabus.',
    },
    suggestedHeading: 'Suggested questions',
    suggestions: withQueries(EN_QUERIES),
    inputPlaceholder: 'Type your question…',
    inputLabel: 'Question for the BeltFlow assistant',
    send: 'Send',
    thinking: 'Searching your records…',
    retry: 'Retry',
    clear: 'Clear conversation',
    sourcesHeading: 'Sources',
    you: 'You',
    assistant: 'Assistant',
    offline: 'You are offline. Ask again when you are connected.',
    status: {
      ANSWERED: 'Answer from your records',
      INSUFFICIENT_EVIDENCE: 'Not found in your records',
      ACTION_REFUSED: 'Read-only: no action taken',
      OUT_OF_SCOPE: 'Outside what I can help with',
      BLOCKED: 'Answer withheld',
    },
    sourceType: { document: 'Academy document', syllabus: 'Syllabus', lesson: 'Lesson', record: 'Record', statistics: 'Statistics' },
    errors: {
      network: 'Connection failed. Check your internet and try again.',
      rateLimited: 'Too many questions. Please wait a minute and try again.',
      unavailable: 'The assistant is temporarily unavailable. Please try again later.',
      forbidden: 'You are not allowed to view this information.',
      disabled: 'The assistant is not enabled for your account yet.',
      generic: 'Something went wrong. Please try again.',
    },
  },
  ms: {
    languageName: 'BM',
    title: 'Pembantu BeltFlow',
    readOnlyNotice: 'Baca sahaja: pembantu ini tidak akan meluluskan, menaikkan gred, mengubah kehadiran atau memproses bayaran.',
    privacyNotice: 'Perbualan ini hanya kekal pada skrin ini dan tidak disimpan pada peranti anda.',
    welcome: {
      SUPER_ADMIN: 'Tanya tentang maklumat peringkat platform. Saya hanya menggunakan statistik agregat; rekod individu kanak-kanak tidak tersedia kepada Super Admin.',
      ADMIN_PERSATUAN: 'Tanya tentang kelas, barisan kelulusan, sukatan, polisi dan analitik Persatuan anda.',
      MASTER: 'Tanya tentang kelas yang anda kendalikan sekarang, senarai pelajar, jadual, rancangan pengajaran dan sukatan.',
      PARENT: 'Tanya tentang jadual, kehadiran, yuran, kemajuan dan notis anak-anak yang dipautkan kepada anda.',
      STUDENT: 'Tanya tentang kemajuan, pencapaian, jadual dan sukatan yang diterbitkan.',
    },
    suggestedHeading: 'Cadangan soalan',
    suggestions: withQueries({
      SUPER_ADMIN: ['Berapa banyak Persatuan dalam platform?', 'Berapa ramai pelajar aktif dalam platform?', 'Tunjukkan direktori Persatuan'],
      ADMIN_PERSATUAN: ['Berapa banyak permohonan menunggu kelulusan?', 'Tunjukkan statistik kelas', 'Berapakah kadar pengekalan kami?'],
      MASTER: ['Tunjukkan senarai pelajar kelas saya', 'Bilakah sesi saya seterusnya?', 'Apakah syarat tali pinggang?'],
      PARENT: ['Bagaimana kehadiran anak saya?', 'Berapa yuran tertunggak?', 'Bilakah kelas seterusnya?'],
      STUDENT: ['Apakah tali pinggang semasa saya?', 'Bilakah kelas saya seterusnya?', 'Apa yang saya perlukan untuk gred seterusnya?'],
    }),
    inputPlaceholder: 'Taip soalan anda…',
    inputLabel: 'Soalan untuk pembantu BeltFlow',
    send: 'Hantar',
    thinking: 'Mencari dalam rekod anda…',
    retry: 'Cuba lagi',
    clear: 'Kosongkan perbualan',
    sourcesHeading: 'Sumber',
    you: 'Anda',
    assistant: 'Pembantu',
    offline: 'Anda di luar talian. Tanya semula apabila anda bersambung.',
    status: {
      ANSWERED: 'Jawapan daripada rekod anda',
      INSUFFICIENT_EVIDENCE: 'Tiada dalam rekod anda',
      ACTION_REFUSED: 'Baca sahaja: tiada tindakan dilakukan',
      OUT_OF_SCOPE: 'Di luar skop bantuan saya',
      BLOCKED: 'Jawapan ditahan',
    },
    sourceType: { document: 'Dokumen akademi', syllabus: 'Sukatan', lesson: 'Pelajaran', record: 'Rekod', statistics: 'Statistik' },
    errors: {
      network: 'Sambungan gagal. Semak internet anda dan cuba lagi.',
      rateLimited: 'Terlalu banyak soalan. Tunggu seminit dan cuba lagi.',
      unavailable: 'Pembantu tidak tersedia buat sementara waktu. Cuba lagi kemudian.',
      forbidden: 'Anda tidak dibenarkan melihat maklumat ini.',
      disabled: 'Pembantu belum diaktifkan untuk akaun anda.',
      generic: 'Sesuatu tidak kena. Sila cuba lagi.',
    },
  },
  ta: {
    languageName: 'தமிழ்',
    title: 'BeltFlow உதவியாளர்',
    readOnlyNotice: 'படிக்க மட்டும்: இந்த உதவியாளர் ஒப்புதல், தர உயர்வு, வருகை மாற்றம் அல்லது பணம் தொடர்பான எதையும் செய்யாது.',
    privacyNotice: 'இந்த உரையாடல் இந்தத் திரையில் மட்டுமே இருக்கும்; உங்கள் சாதனத்தில் சேமிக்கப்படாது.',
    welcome: {
      SUPER_ADMIN: 'தளம் தொடர்பான தகவல்களைக் கேளுங்கள். நான் மொத்தப் புள்ளிவிவரங்களை மட்டுமே பயன்படுத்துவேன்; தனிப்பட்ட பிள்ளைகளின் பதிவுகள் Super Admin-க்குக் கிடைக்காது.',
      ADMIN_PERSATUAN: 'உங்கள் Persatuan-இன் வகுப்புகள், ஒப்புதல் வரிசைகள், பாடத்திட்டம், கொள்கைகள் மற்றும் பகுப்பாய்வுகள் பற்றிக் கேளுங்கள்.',
      MASTER: 'நீங்கள் தற்போது நடத்தும் வகுப்புகள், மாணவர் பட்டியல், அட்டவணை, பாடத் திட்டங்கள் மற்றும் பாடத்திட்டம் பற்றிக் கேளுங்கள்.',
      PARENT: 'உங்களுடன் இணைக்கப்பட்ட பிள்ளைகளின் அட்டவணை, வருகை, கட்டணம், முன்னேற்றம் மற்றும் அறிவிப்புகள் பற்றிக் கேளுங்கள்.',
      STUDENT: 'உங்கள் முன்னேற்றம், சாதனைகள், அட்டவணை மற்றும் வெளியிடப்பட்ட பாடத்திட்டம் பற்றிக் கேளுங்கள்.',
    },
    suggestedHeading: 'பரிந்துரைக்கப்பட்ட கேள்விகள்',
    suggestions: withQueries({
      SUPER_ADMIN: ['தளத்தில் எத்தனை Persatuan-கள் உள்ளன?', 'தளத்தில் எத்தனை செயலில் உள்ள மாணவர்கள் உள்ளனர்?', 'Persatuan பட்டியலைக் காட்டு'],
      ADMIN_PERSATUAN: ['ஒப்புதலுக்காக எத்தனை விண்ணப்பங்கள் காத்திருக்கின்றன?', 'வகுப்புப் புள்ளிவிவரங்களைக் காட்டு', 'எங்கள் மாணவர் தக்கவைப்பு விகிதம் என்ன?'],
      MASTER: ['என் வகுப்பு மாணவர் பட்டியலைக் காட்டு', 'என் அடுத்த வகுப்பு எப்போது?', 'பெல்ட் நிலைக்கான தேவைகள் என்ன?'],
      PARENT: ['என் பிள்ளையின் வருகை எப்படி உள்ளது?', 'நிலுவையில் உள்ள கட்டணம் எவ்வளவு?', 'அடுத்த வகுப்பு எப்போது?'],
      STUDENT: ['என் தற்போதைய பெல்ட் நிலை என்ன?', 'என் அடுத்த வகுப்பு எப்போது?', 'அடுத்த தரத் தேர்வுக்கு எனக்கு என்ன தேவை?'],
    }),
    inputPlaceholder: 'உங்கள் கேள்வியைத் தட்டச்சு செய்யுங்கள்…',
    inputLabel: 'BeltFlow உதவியாளருக்கான கேள்வி',
    send: 'அனுப்பு',
    thinking: 'உங்கள் பதிவுகளில் தேடுகிறது…',
    retry: 'மீண்டும் முயற்சி செய்',
    clear: 'உரையாடலை அழி',
    sourcesHeading: 'ஆதாரங்கள்',
    you: 'நீங்கள்',
    assistant: 'உதவியாளர்',
    offline: 'இணைய இணைப்பு இல்லை. இணைந்த பிறகு மீண்டும் கேளுங்கள்.',
    status: {
      ANSWERED: 'உங்கள் பதிவுகளிலிருந்து பதில்',
      INSUFFICIENT_EVIDENCE: 'உங்கள் பதிவுகளில் கிடைக்கவில்லை',
      ACTION_REFUSED: 'படிக்க மட்டும்: எந்தச் செயலும் செய்யப்படவில்லை',
      OUT_OF_SCOPE: 'என் உதவி வரம்புக்கு வெளியே',
      BLOCKED: 'பதில் நிறுத்தி வைக்கப்பட்டது',
    },
    sourceType: { document: 'கல்விக்கழக ஆவணம்', syllabus: 'பாடத்திட்டம்', lesson: 'பாடம்', record: 'பதிவு', statistics: 'புள்ளிவிவரம்' },
    errors: {
      network: 'இணைப்பு தோல்வியடைந்தது. உங்கள் இணையத்தைச் சரிபார்த்து மீண்டும் முயற்சி செய்யுங்கள்.',
      rateLimited: 'அதிகமான கேள்விகள். ஒரு நிமிடம் காத்திருந்து மீண்டும் முயற்சி செய்யுங்கள்.',
      unavailable: 'உதவியாளர் தற்காலிகமாகக் கிடைக்கவில்லை. பிறகு முயற்சி செய்யுங்கள்.',
      forbidden: 'இந்தத் தகவலைப் பார்க்க உங்களுக்கு அனுமதி இல்லை.',
      disabled: 'உங்கள் கணக்கிற்கு உதவியாளர் இன்னும் இயக்கப்படவில்லை.',
      generic: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சி செய்யுங்கள்.',
    },
  },
};

export function sourceTypeLabel(strings: AssistantStrings, type: string): string {
  if (type === 'knowledge_source' || type === 'org_policy') return strings.sourceType.document;
  if (type === 'curriculum_rank') return strings.sourceType.syllabus;
  if (type === 'learning_lesson' || type === 'lesson_plan') return strings.sourceType.lesson;
  if (type.startsWith('platform') || type.startsWith('org_')) return strings.sourceType.statistics;
  return strings.sourceType.record;
}
