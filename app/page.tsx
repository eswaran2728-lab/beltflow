'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Users, Calendar, Award, CreditCard, BarChart3, Trophy, Shield, ArrowRight, Zap } from 'lucide-react';

type Lang = 'en' | 'ms' | 'ta';

const icons = [Users, Calendar, Award, CreditCard, BarChart3, Trophy, Shield, Zap];

const content: Record<Lang, {
  langLabel: string;
  nav: { features: string; pricing: string; about: string; login: string; start: string };
  hero: { badge: string; title1: string; title2: string; subtitle: string; register: string; login: string; note: string };
  about: { title: string; body1: string; body2: string; role: string; org: string };
  features: { title: string; subtitle: string; items: { title: string; desc: string }[] };
  roles: { title: string; subtitle: string; items: { emoji: string; title: string; desc: string }[] };
  pricing: { title: string; subtitle: string; plans: { name: string; price: string; period: string; badge: string; features: string[] }[]; cta: string };
  cta: { title: string; subtitle: string; register: string; login: string };
  footer: { tagline: string; createdBy: string; login: string; signup: string };
}> = {
  en: {
    langLabel: 'EN',
    nav: { features: 'Features', pricing: 'Pricing', about: 'About', login: 'Log in', start: 'Start Free' },
    hero: {
      badge: 'Silambam, Karate, Taekwondo, Muay Thai, BJJ, Silat, Wushu',
      title1: 'Manage Your Martial Arts', title2: 'Academy with Ease',
      subtitle: 'Built for martial arts. Powered by progress. BeltFlow helps you manage students, track attendance, collect fees, grade belts, and grow your academy.',
      register: 'Register Now', login: 'Log In',
      note: 'Free during the MVP period — Accounts require admin approval',
    },
    about: {
      title: 'Built by a Martial Arts Instructor',
      body1: 'Founded by ESWARAN A/L PADMANATHAN, Silambam instructor and proud student of Mahaguru Sri S. Arumugam, Dato\' Mahaguru A. Sivakumar, Grandmaster Vijaya Sekaran and Master Kanesan.',
      body2: 'Having managed a Silambam academy firsthand, Eswaran understood the pain of tracking 100+ students with spreadsheets and WhatsApp groups. BeltFlow was built to solve real problems faced by real instructors across Malaysia and beyond.',
      role: 'Founder · Silambam Instructor', org: 'Persatuan Silambam Malaysia Daerah Sepang',
    },
    features: {
      title: 'Complete Academy Management',
      subtitle: 'From student enrollment to championship tracking, BeltFlow covers your entire academy workflow.',
      items: [
        { title: 'Student Management', desc: 'Manage student profiles, belt ranks, parent contacts, and emergency information in one place.' },
        { title: 'Attendance Tracking', desc: 'Mark attendance by class, auto-detect absences, and get alerts when students are at risk.' },
        { title: 'Belt Grading', desc: 'Create grading events, track pass/fail results, and automatically update student belt ranks.' },
        { title: 'Payment Management', desc: 'Track monthly fees, approve cash payments, send overdue reminders, and generate receipts.' },
        { title: 'Skills & Curriculum', desc: 'Track each student\'s progress across your martial art curriculum with visual indicators.' },
        { title: 'Tournament Management', desc: 'Manage tournament results, medal tallies, and showcase student achievements.' },
        { title: 'Digital Certificates', desc: 'Auto-issue verifiable digital sijil on belt promotion and tournament medals.' },
        { title: 'Parent Portal', desc: 'Parents can view their child\'s progress, pay fees, and stay connected with the academy.' },
      ],
    },
    roles: {
      title: 'Who is BeltFlow For?', subtitle: 'Designed for every role in your martial arts academy',
      items: [
        { emoji: '🏛️', title: 'Academy Owners', desc: 'Full control over students, coaches, settings, and academy-wide reports.' },
        { emoji: '🥷', title: 'Coaches', desc: 'Mark attendance, set class fees, add performance notes, and track student progress.' },
        { emoji: '👪', title: 'Parents', desc: 'View your child\'s progress, pay fees, and receive grading updates instantly.' },
        { emoji: '🎯', title: 'Students', desc: 'Track your skill progress, view upcoming gradings, and celebrate tournament medals.' },
      ],
    },
    pricing: {
      title: 'Plans for Every Academy', subtitle: 'Start free. Scale as you grow. No hidden fees.',
      plans: [
        { name: 'Free Trial', price: 'Free', period: '30 days', badge: '', features: ['Up to 20 students', 'Basic attendance', 'Student management'] },
        { name: 'Starter', price: 'RM99', period: '/month', badge: 'Popular', features: ['Up to 50 students', 'Attendance and Payments', 'Parent portal', 'Basic reports'] },
        { name: 'Academy', price: 'RM199', period: '/month', badge: 'Best Value', features: ['Up to 150 students', 'Full dashboard', 'Belt grading', 'Skill tracking', 'Coach tools', 'Digital certificates'] },
        { name: 'Association', price: 'Custom', period: '', badge: 'Enterprise', features: ['Multiple branches', 'Multiple coaches', 'Advanced reports', 'Priority support'] },
      ],
      cta: 'Get Started',
    },
    cta: {
      title: 'Ready to Transform Your Academy?', subtitle: 'Run your martial arts academy like a professional operation with BeltFlow.',
      register: 'Register Now', login: 'Log In',
    },
    footer: { tagline: 'Built for martial arts. Powered by progress.', createdBy: 'Created by', login: 'Login', signup: 'Sign Up' },
  },
  ms: {
    langLabel: 'BM',
    nav: { features: 'Ciri-ciri', pricing: 'Harga', about: 'Tentang', login: 'Log masuk', start: 'Mula Percuma' },
    hero: {
      badge: 'Silambam, Karate, Taekwondo, Muay Thai, BJJ, Silat, Wushu',
      title1: 'Urus Akademi Seni Mempertahankan Diri', title2: 'Anda dengan Mudah',
      subtitle: 'Dibina untuk seni mempertahankan diri. BeltFlow membantu anda menguruskan pelajar, merekod kehadiran, mengutip yuran, menggred tali pinggang, dan mengembangkan akademi anda.',
      register: 'Daftar Sekarang', login: 'Log Masuk',
      note: 'Percuma semasa tempoh MVP — Akaun memerlukan kelulusan admin',
    },
    about: {
      title: 'Dibina oleh Jurulatih Seni Mempertahankan Diri',
      body1: 'Diasaskan oleh ESWARAN A/L PADMANATHAN, jurulatih Silambam dan pelajar bangga kepada Mahaguru Sri S. Arumugam, Dato\' Mahaguru A. Sivakumar, Grandmaster Vijaya Sekaran dan Master Kanesan.',
      body2: 'Setelah mengurus akademi Silambam sendiri, Eswaran memahami kesukaran menjejaki 100+ pelajar menggunakan spreadsheet dan kumpulan WhatsApp. BeltFlow dibina untuk menyelesaikan masalah sebenar yang dihadapi jurulatih di seluruh Malaysia dan luar negara.',
      role: 'Pengasas · Jurulatih Silambam', org: 'Persatuan Silambam Malaysia Daerah Sepang',
    },
    features: {
      title: 'Pengurusan Akademi Yang Lengkap',
      subtitle: 'Dari pendaftaran pelajar hingga penjejakan kejohanan, BeltFlow merangkumi keseluruhan aliran kerja akademi anda.',
      items: [
        { title: 'Pengurusan Pelajar', desc: 'Urus profil pelajar, tali pinggang, hubungan ibu bapa, dan maklumat kecemasan dalam satu tempat.' },
        { title: 'Rekod Kehadiran', desc: 'Rekod kehadiran mengikut kelas, kesan ketidakhadiran secara automatik, dan dapatkan makluman pelajar berisiko.' },
        { title: 'Gred Tali Pinggang', desc: 'Cipta acara penggredan, rekod keputusan lulus/gagal, dan kemas kini tali pinggang pelajar secara automatik.' },
        { title: 'Pengurusan Bayaran', desc: 'Jejaki yuran bulanan, luluskan bayaran tunai, hantar peringatan tertunggak, dan jana resit.' },
        { title: 'Kemahiran & Kurikulum', desc: 'Jejaki kemajuan setiap pelajar dalam kurikulum seni mempertahankan diri anda dengan penunjuk visual.' },
        { title: 'Pengurusan Kejohanan', desc: 'Urus keputusan kejohanan, kiraan pingat, dan paparkan pencapaian pelajar.' },
        { title: 'Sijil Digital', desc: 'Terbit sijil digital yang boleh disahkan secara automatik semasa kenaikan tali pinggang dan pingat kejohanan.' },
        { title: 'Portal Ibu Bapa', desc: 'Ibu bapa boleh melihat kemajuan anak, membayar yuran, dan kekal berhubung dengan akademi.' },
      ],
    },
    roles: {
      title: 'Untuk Siapa BeltFlow?', subtitle: 'Direka untuk setiap peranan dalam akademi seni mempertahankan diri anda',
      items: [
        { emoji: '🏛️', title: 'Pemilik Akademi', desc: 'Kawalan penuh ke atas pelajar, jurulatih, tetapan, dan laporan seluruh akademi.' },
        { emoji: '🥷', title: 'Jurulatih', desc: 'Rekod kehadiran, tetapkan yuran kelas, tambah nota prestasi, dan jejaki kemajuan pelajar.' },
        { emoji: '👪', title: 'Ibu Bapa', desc: 'Lihat kemajuan anak anda, bayar yuran, dan terima kemas kini penggredan serta-merta.' },
        { emoji: '🎯', title: 'Pelajar', desc: 'Jejaki kemajuan kemahiran anda, lihat penggredan akan datang, dan raikan pingat kejohanan.' },
      ],
    },
    pricing: {
      title: 'Pelan untuk Setiap Akademi', subtitle: 'Mula percuma. Berkembang mengikut keperluan. Tiada caj tersembunyi.',
      plans: [
        { name: 'Percubaan Percuma', price: 'Percuma', period: '30 hari', badge: '', features: ['Sehingga 20 pelajar', 'Kehadiran asas', 'Pengurusan pelajar'] },
        { name: 'Starter', price: 'RM99', period: '/bulan', badge: 'Popular', features: ['Sehingga 50 pelajar', 'Kehadiran dan Bayaran', 'Portal ibu bapa', 'Laporan asas'] },
        { name: 'Academy', price: 'RM199', period: '/bulan', badge: 'Nilai Terbaik', features: ['Sehingga 150 pelajar', 'Papan pemuka penuh', 'Gred tali pinggang', 'Jejak kemahiran', 'Alat jurulatih', 'Sijil digital'] },
        { name: 'Association', price: 'Tersuai', period: '', badge: 'Enterprise', features: ['Pelbagai cawangan', 'Pelbagai jurulatih', 'Laporan lanjutan', 'Sokongan keutamaan'] },
      ],
      cta: 'Mula Sekarang',
    },
    cta: {
      title: 'Bersedia Mengubah Akademi Anda?', subtitle: 'Uruskan akademi seni mempertahankan diri anda secara profesional dengan BeltFlow.',
      register: 'Daftar Sekarang', login: 'Log Masuk',
    },
    footer: { tagline: 'Dibina untuk seni mempertahankan diri. Dikuasakan oleh kemajuan.', createdBy: 'Dicipta oleh', login: 'Log Masuk', signup: 'Daftar' },
  },
  ta: {
    langLabel: 'த',
    nav: { features: 'அம்சங்கள்', pricing: 'விலை', about: 'எங்களைப் பற்றி', login: 'உள்நுழைய', start: 'இலவசமாகத் தொடங்கு' },
    hero: {
      badge: 'சிலம்பம், கராத்தே, டேக்வாண்டோ, முய் தாய், பிஜேஜே, சிலாட், வூஷூ',
      title1: 'உங்கள் தற்காப்புக் கலை', title2: 'அகாடமியை எளிதாக நிர்வகியுங்கள்',
      subtitle: 'தற்காப்புக் கலைக்காக உருவாக்கப்பட்டது. மாணவர்களை நிர்வகிக்கவும், வருகையைக் கண்காணிக்கவும், கட்டணங்களை வசூலிக்கவும், பெல்ட் தரங்களை வழங்கவும், உங்கள் அகாடமியை வளர்க்கவும் BeltFlow உதவுகிறது.',
      register: 'இப்போது பதிவு செய்யுங்கள்', login: 'உள்நுழைய',
      note: 'MVP காலகட்டத்தில் இலவசம் — கணக்குகளுக்கு நிர்வாக ஒப்புதல் தேவை',
    },
    about: {
      title: 'ஒரு தற்காப்புக் கலை பயிற்சியாளரால் உருவாக்கப்பட்டது',
      body1: 'ESWARAN A/L PADMANATHAN அவர்களால் நிறுவப்பட்டது, சிலம்பம் பயிற்சியாளர் மற்றும் மஹாகுரு ஸ்ரீ S. அருமுகம், டாட்டோ மஹாகுரு A. சிவகுமார், கிராண்ட்மாஸ்டர் விஜயா சேகரன் மற்றும் மாஸ்டர் கணேசன் ஆகியோரின் பெருமைமிக்க மாணவர்.',
      body2: 'ஒரு சிலம்பம் அகாடமியை நேரடியாக நிர்வகித்த அனுபவத்தில், ஸ்பிரெட்ஷீட்கள் மற்றும் WhatsApp குழுக்கள் மூலம் 100+ மாணவர்களைக் கண்காணிப்பதன் சிரமத்தை எஸ்வரன் புரிந்துகொண்டார். மலேசியா மற்றும் வெளிநாடுகளில் உள்ள உண்மையான பயிற்சியாளர்கள் எதிர்கொள்ளும் உண்மையான பிரச்சினைகளைத் தீர்க்க BeltFlow உருவாக்கப்பட்டது.',
      role: 'நிறுவனர் · சிலம்பம் பயிற்சியாளர்', org: 'Persatuan Silambam Malaysia Daerah Sepang',
    },
    features: {
      title: 'முழுமையான அகாடமி மேலாண்மை',
      subtitle: 'மாணவர் சேர்க்கை முதல் சாம்பியன்ஷிப் கண்காணிப்பு வரை, BeltFlow உங்கள் முழு அகாடமி பணிப்பாய்வையும் உள்ளடக்கியது.',
      items: [
        { title: 'மாணவர் மேலாண்மை', desc: 'மாணவர் சுயவிவரங்கள், பெல்ட் தரங்கள், பெற்றோர் தொடர்புகள் மற்றும் அவசர தகவல்களை ஒரே இடத்தில் நிர்வகிக்கவும்.' },
        { title: 'வருகைக் கண்காணிப்பு', desc: 'வகுப்பு வாரியாக வருகையைக் குறிக்கவும், வராதவர்களை தானாகக் கண்டறியவும், ஆபத்தில் உள்ள மாணவர்களுக்கு எச்சரிக்கைகளைப் பெறவும்.' },
        { title: 'பெல்ட் தரப்படுத்தல்', desc: 'தரப்படுத்தல் நிகழ்வுகளை உருவாக்கவும், தேர்ச்சி/தோல்வி முடிவுகளைக் கண்காணிக்கவும், மாணவர் பெல்ட் தரங்களை தானாகப் புதுப்பிக்கவும்.' },
        { title: 'கட்டண மேலாண்மை', desc: 'மாதாந்திர கட்டணங்களைக் கண்காணிக்கவும், பண பணம் செலுத்துதலை அங்கீகரிக்கவும், நினைவூட்டல்களை அனுப்பவும், ரசீதுகளை உருவாக்கவும்.' },
        { title: 'திறன்கள் & பாடத்திட்டம்', desc: 'உங்கள் தற்காப்புக் கலை பாடத்திட்டத்தில் ஒவ்வொரு மாணவரின் முன்னேற்றத்தையும் காட்சி குறிகாட்டிகளுடன் கண்காணிக்கவும்.' },
        { title: 'போட்டி மேலாண்மை', desc: 'போட்டி முடிவுகள், பதக்க எண்ணிக்கை மற்றும் மாணவர் சாதனைகளை நிர்வகிக்கவும்.' },
        { title: 'டிஜிட்டல் சான்றிதழ்கள்', desc: 'பெல்ட் பதவி உயர்வு மற்றும் போட்டி பதக்கங்களில் சரிபார்க்கக்கூடிய டிஜிட்டல் சான்றிதழ்களை தானாக வழங்கவும்.' },
        { title: 'பெற்றோர் போர்ட்டல்', desc: 'பெற்றோர்கள் தங்கள் குழந்தையின் முன்னேற்றத்தைக் காணலாம், கட்டணம் செலுத்தலாம், அகாடமியுடன் தொடர்பில் இருக்கலாம்.' },
      ],
    },
    roles: {
      title: 'BeltFlow யாருக்கானது?', subtitle: 'உங்கள் தற்காப்புக் கலை அகாடமியில் ஒவ்வொரு பங்குக்கும் வடிவமைக்கப்பட்டது',
      items: [
        { emoji: '🏛️', title: 'அகாடமி உரிமையாளர்கள்', desc: 'மாணவர்கள், பயிற்சியாளர்கள், அமைப்புகள் மற்றும் அகாடமி முழுவதற்குமான அறிக்கைகள் மீது முழு கட்டுப்பாடு.' },
        { emoji: '🥷', title: 'பயிற்சியாளர்கள்', desc: 'வருகையைக் குறிக்கவும், வகுப்பு கட்டணங்களை நிர்ணயிக்கவும், செயல்திறன் குறிப்புகளைச் சேர்க்கவும், மாணவர் முன்னேற்றத்தைக் கண்காணிக்கவும்.' },
        { emoji: '👪', title: 'பெற்றோர்கள்', desc: 'உங்கள் குழந்தையின் முன்னேற்றத்தைப் பார்க்கவும், கட்டணம் செலுத்தவும், தரப்படுத்தல் புதுப்பிப்புகளை உடனடியாகப் பெறவும்.' },
        { emoji: '🎯', title: 'மாணவர்கள்', desc: 'உங்கள் திறன் முன்னேற்றத்தைக் கண்காணிக்கவும், வரவிருக்கும் தரப்படுத்தல்களைப் பார்க்கவும், போட்டி பதக்கங்களைக் கொண்டாடவும்.' },
      ],
    },
    pricing: {
      title: 'ஒவ்வொரு அகாடமிக்கும் திட்டங்கள்', subtitle: 'இலவசமாகத் தொடங்குங்கள். வளரும்போது விரிவாக்குங்கள். மறைமுக கட்டணங்கள் இல்லை.',
      plans: [
        { name: 'இலவச சோதனை', price: 'இலவசம்', period: '30 நாட்கள்', badge: '', features: ['20 மாணவர்கள் வரை', 'அடிப்படை வருகை', 'மாணவர் மேலாண்மை'] },
        { name: 'Starter', price: 'RM99', period: '/மாதம்', badge: 'பிரபலமானது', features: ['50 மாணவர்கள் வரை', 'வருகை மற்றும் கட்டணங்கள்', 'பெற்றோர் போர்ட்டல்', 'அடிப்படை அறிக்கைகள்'] },
        { name: 'Academy', price: 'RM199', period: '/மாதம்', badge: 'சிறந்த மதிப்பு', features: ['150 மாணவர்கள் வரை', 'முழு டாஷ்போர்டு', 'பெல்ட் தரப்படுத்தல்', 'திறன் கண்காணிப்பு', 'பயிற்சியாளர் கருவிகள்', 'டிஜிட்டல் சான்றிதழ்கள்'] },
        { name: 'Association', price: 'தனிப்பயன்', period: '', badge: 'நிறுவனம்', features: ['பல கிளைகள்', 'பல பயிற்சியாளர்கள்', 'மேம்பட்ட அறிக்கைகள்', 'முன்னுரிமை ஆதரவு'] },
      ],
      cta: 'தொடங்குங்கள்',
    },
    cta: {
      title: 'உங்கள் அகாடமியை மாற்றத் தயாரா?', subtitle: 'BeltFlow உடன் உங்கள் தற்காப்புக் கலை அகாடமியை தொழில்முறையாக நடத்துங்கள்.',
      register: 'இப்போது பதிவு செய்யுங்கள்', login: 'உள்நுழைய',
    },
    footer: { tagline: 'தற்காப்புக் கலைக்காக உருவாக்கப்பட்டது.', createdBy: 'உருவாக்கியவர்', login: 'உள்நுழைய', signup: 'பதிவு செய்யுங்கள்' },
  },
};

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = content[lang];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-2xl font-extrabold text-yellow-500">BeltFlow</span>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900">{t.nav.features}</a>
            <a href="#pricing" className="hover:text-gray-900">{t.nav.pricing}</a>
            <a href="#about" className="hover:text-gray-900">{t.nav.about}</a>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
              {(['en', 'ms', 'ta'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${lang === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {content[l].langLabel}
                </button>
              ))}
            </div>
            <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 hidden sm:block">{t.nav.login}</Link>
            <Link href="/auth/signup" className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800">{t.nav.start}</Link>
          </div>
        </div>
      </nav>

      <section className="bg-gray-900 text-white py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-400 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-yellow-500/30">
            <Zap size={14} /> {t.hero.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
            {t.hero.title1}<br /><span className="text-yellow-500">{t.hero.title2}</span>
          </h1>
          <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">{t.hero.subtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="bg-yellow-500 text-white font-bold px-8 py-4 rounded-xl hover:bg-yellow-600 text-lg flex items-center gap-2 shadow-lg shadow-yellow-500/30">
              {t.hero.register} <ArrowRight size={20} />
            </Link>
            <Link href="/auth/login" className="bg-white/10 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 text-lg border border-white/20">
              {t.hero.login}
            </Link>
          </div>
          <p className="text-white/30 text-sm mt-6">{t.hero.note}</p>
        </div>
      </section>

      <section id="about" className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg">🥋</div>
          <h2 className="text-3xl font-extrabold mb-6 text-gray-900">{t.about.title}</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-6">{t.about.body1}</p>
          <p className="text-gray-500 leading-relaxed mb-8">{t.about.body2}</p>
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 px-6 py-4 rounded-xl shadow-sm">
            <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">E</div>
            <div className="text-left">
              <p className="font-extrabold text-gray-900 text-lg">ESWARAN A/L PADMANATHAN</p>
              <p className="text-sm text-gray-500 mt-0.5">{t.about.role}</p>
              <p className="text-sm text-gray-500">{t.about.org}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">{t.features.title}</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">{t.features.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.features.items.map((f, i) => {
              const Icon = icons[i];
              return (
                <div key={f.title} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-all hover:border-blue-100">
                  <div className="w-12 h-12 bg-gray-900/5 rounded-xl flex items-center justify-center mb-4">
                    <Icon size={24} className="text-gray-900" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t.roles.title}</h2>
            <p className="text-white/60 text-lg">{t.roles.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.roles.items.map(r => (
              <div key={r.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="text-4xl mb-4">{r.emoji}</div>
                <h3 className="font-bold text-white mb-2">{r.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">{t.pricing.title}</h2>
            <p className="text-gray-500 text-lg">{t.pricing.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.pricing.plans.map((p, i) => (
              <div key={p.name} className={`bg-white border-2 ${['border-gray-200', 'border-blue-200', 'border-yellow-400', 'border-purple-200'][i]} rounded-2xl p-6 relative hover:shadow-lg transition-all`}>
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{p.badge}</span>
                )}
                <h3 className="font-bold text-gray-900 text-lg mb-1">{p.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-gray-900">{p.price}</span>
                  <span className="text-gray-400 text-sm">{p.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle size={15} className="text-green-500 mt-0.5 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="block text-center bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
                  {t.pricing.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-6">{t.cta.title}</h2>
          <p className="text-white/60 text-lg mb-10">{t.cta.subtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="bg-yellow-500 text-white font-bold px-10 py-4 rounded-xl hover:bg-yellow-600 text-lg flex items-center gap-2 shadow-lg">
              {t.cta.register} <ArrowRight size={20} />
            </Link>
            <Link href="/auth/login" className="bg-white/10 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 text-lg">
              {t.cta.login}
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 border-t border-white/10 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-yellow-500 font-bold text-xl">BeltFlow</span>
            <p className="text-white/40 text-xs mt-1">{t.footer.tagline}</p>
          </div>
          <p className="text-white/40 text-sm text-center">
            {t.footer.createdBy} <span className="text-white/70 font-medium">ESWARAN A/L PADMANATHAN</span>
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <Link href="/auth/login" className="hover:text-white/70">{t.footer.login}</Link>
            <Link href="/auth/signup" className="hover:text-white/70">{t.footer.signup}</Link>
            <Link href="/privacy" className="hover:text-white/70">Privacy</Link>
            <Link href="/terms" className="hover:text-white/70">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
