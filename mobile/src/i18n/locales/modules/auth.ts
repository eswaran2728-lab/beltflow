/**
 * H28 translation keys for the "auth" area. Keys are prefixed "auth.".
 * English is the source; Bahasa Melayu and Tamil must have the same keys and
 * {placeholders}. Tamil and BM need native-speaker review before release.
 */
export const authEn = {
  // Shared within auth screens
  'auth.common.tagline': 'Martial Arts Academy Management',
  'auth.common.signOut': 'Sign Out',
  'auth.common.verifyOfficialCertificate': 'Verify Official Certificate',

  // Welcome
  'auth.welcome.feature1.title': 'Multi-Tenant Silambam Portals',
  'auth.welcome.feature1.body': 'Dedicated access for Admins, Masters, Parents, and Students',
  'auth.welcome.feature2.title': 'Configurable Belt Syllabi',
  'auth.welcome.feature2.body': 'Tailored ranking, exams, and verified grading criteria',
  'auth.welcome.feature3.title': 'Offline Mat Attendance',
  'auth.welcome.feature3.body': 'Track training sessions with seamless cloud synchronization',
  'auth.welcome.signIn': 'Sign In to Academy',

  // Login
  'auth.login.title': 'Sign In to BeltFlow',
  'auth.login.subtitle': 'Access your academy syllabus, attendance, and grading',
  'auth.login.errorTitle': 'Sign In Error',
  'auth.login.emailLabel': 'Email Address',
  'auth.login.emailPlaceholder': 'e.g. master@beltflow.com',
  'auth.login.passwordLabel': 'Password',
  'auth.login.passwordPlaceholder': 'Enter your password',
  'auth.login.forgotPassword': 'Forgot Password?',
  'auth.login.forgotPasswordA11y': 'Forgot Password',
  'auth.login.submit': 'Sign In',
  'auth.login.submitA11y': 'Sign In Button',
  'auth.login.haveCode': 'Have a grading certificate code?',
  'auth.login.verifyHere': 'Verify Here',
  'auth.login.emailRequired': 'Please enter your email address',
  'auth.login.emailInvalid': 'Please enter a valid email address',
  'auth.login.passwordRequired': 'Please enter your password',
  'auth.login.failed': 'Login failed. Please check your credentials.',

  // Forgot password
  'auth.forgot.title': 'Password Assistance',
  'auth.forgot.subtitle': 'Academy credential policy',
  'auth.forgot.cardTitle': 'Managed Academy Security',
  'auth.forgot.cardSubtitle': 'Multi-tenant BeltFlow account guidelines',
  'auth.forgot.policy':
    'In accordance with martial arts academy security standards, student, parent, and master passwords are administrative credentials managed by each active Persatuan.',
  'auth.forgot.contact':
    'Please contact your Persatuan Admin or Academy Master to request a secure password reset or temporary credential voucher.',
  'auth.forgot.privacy':
    'For privacy protection, automated self-service email resets are not permitted to reveal membership or account existence.',
  'auth.forgot.back': 'Return to Sign In',

  // Splash
  'auth.splash.a11y': 'BeltFlow Splash Screen',
  'auth.splash.loading': 'Initializing session...',

  // Verify certificate
  'auth.verify.title': 'Verify Certificate',
  'auth.verify.subtitle': 'Official martial arts credentials',
  'auth.verify.lookupTitle': 'Certificate Lookup',
  'auth.verify.lookupBody': 'Enter the unique verification code printed on the official Persatuan grading certificate.',
  'auth.verify.codeLabel': 'Certificate Code',
  'auth.verify.codePlaceholder': 'e.g. CERT-2024-001',
  'auth.verify.submit': 'Verify Certificate',
  'auth.verify.codeRequired': 'Please enter a certificate verification code',
  'auth.verify.notFound': 'No certificate record found for the provided code.',
  'auth.verify.failed': 'Verification failed. Please check the code and try again.',
  'auth.verify.errorTitle': 'Verification Notice',
  'auth.verify.revokedBanner': 'CERTIFICATE REVOKED',
  'auth.verify.verifiedBanner': 'OFFICIALLY VERIFIED',
  'auth.verify.revoked': 'Revoked',
  'auth.verify.valid': 'Valid',
  'auth.verify.revocationNotice': 'REVOCATION NOTICE:',
  'auth.verify.studentName': 'STUDENT NAME',
  'auth.verify.rank': 'AWARDED RANK / TITLE',
  'auth.verify.academy': 'ACADEMY / PERSATUAN',
  'auth.verify.examiner': 'EXAMINER / MASTER',
  'auth.verify.issueDate': 'ISSUE DATE',
  'auth.verify.code': 'CODE',

  // Authenticated placeholder
  'auth.placeholder.title': 'BeltFlow Portal',
  'auth.placeholder.subtitle': 'Active verified session',
  'auth.placeholder.verifiedRole': 'VERIFIED ROLE',
  'auth.placeholder.tenantId': 'TENANT ID',
  'auth.placeholder.systemGlobal': 'System Global',
  'auth.placeholder.tenantIsolation':
    'Tenant isolation enforced: All student, mat, and grading operations bound to your Persatuan.',
  'auth.placeholder.milestoneTitle': 'Phase 1 Task 1.5 Milestone',
  'auth.placeholder.milestoneBody':
    'Authentication and secure storage are fully active. Complete role-based operational portals for Super Admin, Persatuan Admin, Masters, Parents, and Students will be orchestrated in Task 1.6.',
  'auth.placeholder.signOutA11y': 'Sign Out Button',

  // Unauthorized role
  'auth.unauthorized.title': 'Access Restricted',
  'auth.unauthorized.subtitle': 'Role Authorization',
  'auth.unauthorized.heading': 'Unauthorized Role',
  'auth.unauthorized.message': 'Your account role is not recognized or has not been authorized for any mobile portal.',
  'auth.unauthorized.account': 'Account: {email}',
  'auth.unauthorized.detectedRole': 'Detected Role: {role}',
  'auth.unauthorized.disclaimer': 'Please contact your organization administrator or academy master to verify permissions.',
  'auth.unauthorized.signOutA11y': 'Sign Out of unauthorized session',

  // Role placeholder base
  'auth.role.signOutA11y': 'Sign Out of BeltFlow',
  'auth.role.offline': 'Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online.',
  'auth.role.persatuan': 'Persatuan: {id}',
  'auth.role.comingSoon': 'Coming soon',
  'auth.role.comingSoonBody': 'This section is being prepared for your account.',
};

export const authMs: Record<keyof typeof authEn, string> = {
  'auth.common.tagline': 'Pengurusan Akademi Seni Mempertahankan Diri',
  'auth.common.signOut': 'Log Keluar',
  'auth.common.verifyOfficialCertificate': 'Sahkan Sijil Rasmi',

  'auth.welcome.feature1.title': 'Portal Silambam Berbilang Persatuan',
  'auth.welcome.feature1.body': 'Akses khusus untuk Pentadbir, Master, Ibu Bapa dan Pelajar',
  'auth.welcome.feature2.title': 'Silibus Tali Pinggang Boleh Dikonfigurasi',
  'auth.welcome.feature2.body': 'Kedudukan, peperiksaan dan kriteria penggredan yang disahkan',
  'auth.welcome.feature3.title': 'Kehadiran Gelanggang Luar Talian',
  'auth.welcome.feature3.body': 'Rekod sesi latihan dengan penyegerakan awan yang lancar',
  'auth.welcome.signIn': 'Log Masuk ke Akademi',

  'auth.login.title': 'Log Masuk ke BeltFlow',
  'auth.login.subtitle': 'Akses silibus, kehadiran dan penggredan akademi anda',
  'auth.login.errorTitle': 'Ralat Log Masuk',
  'auth.login.emailLabel': 'Alamat E-mel',
  'auth.login.emailPlaceholder': 'cth. master@beltflow.com',
  'auth.login.passwordLabel': 'Kata Laluan',
  'auth.login.passwordPlaceholder': 'Masukkan kata laluan anda',
  'auth.login.forgotPassword': 'Lupa Kata Laluan?',
  'auth.login.forgotPasswordA11y': 'Lupa Kata Laluan',
  'auth.login.submit': 'Log Masuk',
  'auth.login.submitA11y': 'Butang Log Masuk',
  'auth.login.haveCode': 'Ada kod sijil penggredan?',
  'auth.login.verifyHere': 'Sahkan Di Sini',
  'auth.login.emailRequired': 'Sila masukkan alamat e-mel anda',
  'auth.login.emailInvalid': 'Sila masukkan alamat e-mel yang sah',
  'auth.login.passwordRequired': 'Sila masukkan kata laluan anda',
  'auth.login.failed': 'Log masuk gagal. Sila semak butiran log masuk anda.',

  'auth.forgot.title': 'Bantuan Kata Laluan',
  'auth.forgot.subtitle': 'Dasar kelayakan akademi',
  'auth.forgot.cardTitle': 'Keselamatan Akademi Terurus',
  'auth.forgot.cardSubtitle': 'Garis panduan akaun BeltFlow berbilang Persatuan',
  'auth.forgot.policy':
    'Selaras dengan piawaian keselamatan akademi seni mempertahankan diri, kata laluan pelajar, ibu bapa dan Master ialah kelayakan pentadbiran yang diurus oleh setiap Persatuan aktif.',
  'auth.forgot.contact':
    'Sila hubungi Pentadbir Persatuan atau Master Akademi anda untuk meminta set semula kata laluan yang selamat atau baucar kelayakan sementara.',
  'auth.forgot.privacy':
    'Demi melindungi privasi, set semula e-mel layan diri automatik tidak dibenarkan supaya keahlian atau kewujudan akaun tidak didedahkan.',
  'auth.forgot.back': 'Kembali ke Log Masuk',

  'auth.splash.a11y': 'Skrin Pembuka BeltFlow',
  'auth.splash.loading': 'Memulakan sesi...',

  'auth.verify.title': 'Sahkan Sijil',
  'auth.verify.subtitle': 'Kelayakan rasmi seni mempertahankan diri',
  'auth.verify.lookupTitle': 'Semakan Sijil',
  'auth.verify.lookupBody': 'Masukkan kod pengesahan unik yang dicetak pada sijil penggredan rasmi Persatuan.',
  'auth.verify.codeLabel': 'Kod Sijil',
  'auth.verify.codePlaceholder': 'cth. CERT-2024-001',
  'auth.verify.submit': 'Sahkan Sijil',
  'auth.verify.codeRequired': 'Sila masukkan kod pengesahan sijil',
  'auth.verify.notFound': 'Tiada rekod sijil ditemui untuk kod yang diberikan.',
  'auth.verify.failed': 'Pengesahan gagal. Sila semak kod dan cuba lagi.',
  'auth.verify.errorTitle': 'Notis Pengesahan',
  'auth.verify.revokedBanner': 'SIJIL DIBATALKAN',
  'auth.verify.verifiedBanner': 'DISAHKAN SECARA RASMI',
  'auth.verify.revoked': 'Dibatalkan',
  'auth.verify.valid': 'Sah',
  'auth.verify.revocationNotice': 'NOTIS PEMBATALAN:',
  'auth.verify.studentName': 'NAMA PELAJAR',
  'auth.verify.rank': 'PANGKAT / GELARAN DIANUGERAHKAN',
  'auth.verify.academy': 'AKADEMI / PERSATUAN',
  'auth.verify.examiner': 'PEMERIKSA / MASTER',
  'auth.verify.issueDate': 'TARIKH DIKELUARKAN',
  'auth.verify.code': 'KOD',

  'auth.placeholder.title': 'Portal BeltFlow',
  'auth.placeholder.subtitle': 'Sesi aktif yang disahkan',
  'auth.placeholder.verifiedRole': 'PERANAN DISAHKAN',
  'auth.placeholder.tenantId': 'ID PERSATUAN',
  'auth.placeholder.systemGlobal': 'Sistem Global',
  'auth.placeholder.tenantIsolation':
    'Pengasingan Persatuan dikuatkuasakan: Semua operasi pelajar, gelanggang dan penggredan terikat kepada Persatuan anda.',
  'auth.placeholder.milestoneTitle': 'Pencapaian Fasa 1 Tugasan 1.5',
  'auth.placeholder.milestoneBody':
    'Pengesahan dan storan selamat aktif sepenuhnya. Portal operasi berasaskan peranan untuk Super Admin, Pentadbir Persatuan, Master, Ibu Bapa dan Pelajar akan disediakan dalam Tugasan 1.6.',
  'auth.placeholder.signOutA11y': 'Butang Log Keluar',

  'auth.unauthorized.title': 'Akses Terhad',
  'auth.unauthorized.subtitle': 'Kebenaran Peranan',
  'auth.unauthorized.heading': 'Peranan Tidak Dibenarkan',
  'auth.unauthorized.message': 'Peranan akaun anda tidak dikenali atau belum dibenarkan untuk mana-mana portal mudah alih.',
  'auth.unauthorized.account': 'Akaun: {email}',
  'auth.unauthorized.detectedRole': 'Peranan Dikesan: {role}',
  'auth.unauthorized.disclaimer': 'Sila hubungi pentadbir organisasi atau Master akademi anda untuk mengesahkan kebenaran.',
  'auth.unauthorized.signOutA11y': 'Log keluar daripada sesi tanpa kebenaran',

  'auth.role.signOutA11y': 'Log Keluar daripada BeltFlow',
  'auth.role.offline': 'Mod Luar Talian: Identiti Disimpan Setempat — Operasi pelayan yang sensitif dikunci sehingga dalam talian.',
  'auth.role.persatuan': 'Persatuan: {id}',
  'auth.role.comingSoon': 'Akan datang',
  'auth.role.comingSoonBody': 'Bahagian ini sedang disediakan untuk akaun anda.',
};

export const authTa: Record<keyof typeof authEn, string> = {
  'auth.common.tagline': 'தற்காப்புக் கலை அகாடமி மேலாண்மை',
  'auth.common.signOut': 'வெளியேறு',
  'auth.common.verifyOfficialCertificate': 'அதிகாரப்பூர்வ சான்றிதழைச் சரிபார்',

  'auth.welcome.feature1.title': 'பல சங்க சிலம்பம் தளங்கள்',
  'auth.welcome.feature1.body': 'நிர்வாகிகள், ஆசான்கள், பெற்றோர் மற்றும் மாணவர்களுக்கான தனி அணுகல்',
  'auth.welcome.feature2.title': 'அமைக்கக்கூடிய பட்டை பாடத்திட்டங்கள்',
  'auth.welcome.feature2.body': 'தனிப்பயன் தரவரிசை, தேர்வுகள் மற்றும் சரிபார்க்கப்பட்ட தர மதிப்பீட்டு அளவுகோல்கள்',
  'auth.welcome.feature3.title': 'ஆஃப்லைன் பயிற்சிக்கள வருகை',
  'auth.welcome.feature3.body': 'பயிற்சி அமர்வுகளைப் பதிவுசெய்து, கிளவுடுடன் தடையின்றி ஒத்திசைக்கவும்',
  'auth.welcome.signIn': 'அகாடமியில் உள்நுழை',

  'auth.login.title': 'BeltFlow-இல் உள்நுழை',
  'auth.login.subtitle': 'உங்கள் அகாடமி பாடத்திட்டம், வருகை மற்றும் தர மதிப்பீட்டைப் பாருங்கள்',
  'auth.login.errorTitle': 'உள்நுழைவுப் பிழை',
  'auth.login.emailLabel': 'மின்னஞ்சல் முகவரி',
  'auth.login.emailPlaceholder': 'எ.கா. master@beltflow.com',
  'auth.login.passwordLabel': 'கடவுச்சொல்',
  'auth.login.passwordPlaceholder': 'உங்கள் கடவுச்சொல்லை உள்ளிடவும்',
  'auth.login.forgotPassword': 'கடவுச்சொல் மறந்துவிட்டதா?',
  'auth.login.forgotPasswordA11y': 'கடவுச்சொல் மறந்துவிட்டது',
  'auth.login.submit': 'உள்நுழை',
  'auth.login.submitA11y': 'உள்நுழைவு பொத்தான்',
  'auth.login.haveCode': 'தர மதிப்பீட்டுச் சான்றிதழ் குறியீடு உள்ளதா?',
  'auth.login.verifyHere': 'இங்கே சரிபார்',
  'auth.login.emailRequired': 'உங்கள் மின்னஞ்சல் முகவரியை உள்ளிடவும்',
  'auth.login.emailInvalid': 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்',
  'auth.login.passwordRequired': 'உங்கள் கடவுச்சொல்லை உள்ளிடவும்',
  'auth.login.failed': 'உள்நுழைவு தோல்வியடைந்தது. உங்கள் விவரங்களைச் சரிபார்க்கவும்.',

  'auth.forgot.title': 'கடவுச்சொல் உதவி',
  'auth.forgot.subtitle': 'அகாடமி அணுகல் கொள்கை',
  'auth.forgot.cardTitle': 'நிர்வகிக்கப்படும் அகாடமி பாதுகாப்பு',
  'auth.forgot.cardSubtitle': 'பல சங்க BeltFlow கணக்கு வழிகாட்டுதல்கள்',
  'auth.forgot.policy':
    'தற்காப்புக் கலை அகாடமி பாதுகாப்புத் தரங்களின்படி, மாணவர், பெற்றோர் மற்றும் ஆசான் கடவுச்சொற்கள் ஒவ்வொரு செயலில் உள்ள சங்கத்தாலும் நிர்வகிக்கப்படும் நிர்வாக அணுகல் விவரங்கள் ஆகும்.',
  'auth.forgot.contact':
    'பாதுகாப்பான கடவுச்சொல் மீட்டமைப்பு அல்லது தற்காலிக அணுகல் சீட்டைக் கோர உங்கள் சங்க நிர்வாகி அல்லது அகாடமி ஆசானைத் தொடர்பு கொள்ளவும்.',
  'auth.forgot.privacy':
    'தனியுரிமைப் பாதுகாப்பிற்காக, உறுப்பினர் நிலை அல்லது கணக்கு இருப்பை வெளிப்படுத்தும் தானியங்கி மின்னஞ்சல் மீட்டமைப்புகள் அனுமதிக்கப்படுவதில்லை.',
  'auth.forgot.back': 'உள்நுழைவுக்குத் திரும்பு',

  'auth.splash.a11y': 'BeltFlow தொடக்கத் திரை',
  'auth.splash.loading': 'அமர்வு தொடங்குகிறது...',

  'auth.verify.title': 'சான்றிதழைச் சரிபார்',
  'auth.verify.subtitle': 'அதிகாரப்பூர்வ தற்காப்புக் கலைச் சான்றுகள்',
  'auth.verify.lookupTitle': 'சான்றிதழ் தேடல்',
  'auth.verify.lookupBody': 'அதிகாரப்பூர்வ சங்க தர மதிப்பீட்டுச் சான்றிதழில் அச்சிடப்பட்ட தனித்துவமான சரிபார்ப்புக் குறியீட்டை உள்ளிடவும்.',
  'auth.verify.codeLabel': 'சான்றிதழ் குறியீடு',
  'auth.verify.codePlaceholder': 'எ.கா. CERT-2024-001',
  'auth.verify.submit': 'சான்றிதழைச் சரிபார்',
  'auth.verify.codeRequired': 'சான்றிதழ் சரிபார்ப்புக் குறியீட்டை உள்ளிடவும்',
  'auth.verify.notFound': 'கொடுக்கப்பட்ட குறியீட்டிற்குச் சான்றிதழ் பதிவு எதுவும் இல்லை.',
  'auth.verify.failed': 'சரிபார்ப்பு தோல்வியடைந்தது. குறியீட்டைச் சரிபார்த்து மீண்டும் முயலவும்.',
  'auth.verify.errorTitle': 'சரிபார்ப்பு அறிவிப்பு',
  'auth.verify.revokedBanner': 'சான்றிதழ் ரத்து செய்யப்பட்டது',
  'auth.verify.verifiedBanner': 'அதிகாரப்பூர்வமாகச் சரிபார்க்கப்பட்டது',
  'auth.verify.revoked': 'ரத்து',
  'auth.verify.valid': 'செல்லுபடி',
  'auth.verify.revocationNotice': 'ரத்து அறிவிப்பு:',
  'auth.verify.studentName': 'மாணவர் பெயர்',
  'auth.verify.rank': 'வழங்கப்பட்ட தரம் / பட்டம்',
  'auth.verify.academy': 'அகாடமி / சங்கம்',
  'auth.verify.examiner': 'தேர்வாளர் / ஆசான்',
  'auth.verify.issueDate': 'வழங்கிய தேதி',
  'auth.verify.code': 'குறியீடு',

  'auth.placeholder.title': 'BeltFlow தளம்',
  'auth.placeholder.subtitle': 'சரிபார்க்கப்பட்ட செயலில் உள்ள அமர்வு',
  'auth.placeholder.verifiedRole': 'சரிபார்க்கப்பட்ட பங்கு',
  'auth.placeholder.tenantId': 'சங்க அடையாள எண்',
  'auth.placeholder.systemGlobal': 'அமைப்பு முழுவதும்',
  'auth.placeholder.tenantIsolation':
    'சங்கத் தனிமைப்படுத்தல் அமலில் உள்ளது: அனைத்து மாணவர், பயிற்சிக்களம் மற்றும் தர மதிப்பீட்டுச் செயல்பாடுகளும் உங்கள் சங்கத்திற்குள் மட்டுமே.',
  'auth.placeholder.milestoneTitle': 'கட்டம் 1 பணி 1.5 மைல்கல்',
  'auth.placeholder.milestoneBody':
    'அங்கீகாரம் மற்றும் பாதுகாப்பான சேமிப்பு முழுமையாகச் செயலில் உள்ளன. Super Admin, சங்க நிர்வாகி, ஆசான்கள், பெற்றோர் மற்றும் மாணவர்களுக்கான பங்கு அடிப்படையிலான தளங்கள் பணி 1.6-இல் அமைக்கப்படும்.',
  'auth.placeholder.signOutA11y': 'வெளியேறு பொத்தான்',

  'auth.unauthorized.title': 'அணுகல் தடைசெய்யப்பட்டது',
  'auth.unauthorized.subtitle': 'பங்கு அங்கீகாரம்',
  'auth.unauthorized.heading': 'அங்கீகரிக்கப்படாத பங்கு',
  'auth.unauthorized.message': 'உங்கள் கணக்குப் பங்கு அடையாளம் காணப்படவில்லை அல்லது எந்த மொபைல் தளத்திற்கும் அங்கீகரிக்கப்படவில்லை.',
  'auth.unauthorized.account': 'கணக்கு: {email}',
  'auth.unauthorized.detectedRole': 'கண்டறியப்பட்ட பங்கு: {role}',
  'auth.unauthorized.disclaimer': 'அனுமதிகளைச் சரிபார்க்க உங்கள் நிறுவன நிர்வாகி அல்லது அகாடமி ஆசானைத் தொடர்பு கொள்ளவும்.',
  'auth.unauthorized.signOutA11y': 'அங்கீகரிக்கப்படாத அமர்விலிருந்து வெளியேறு',

  'auth.role.signOutA11y': 'BeltFlow-இலிருந்து வெளியேறு',
  'auth.role.offline': 'ஆஃப்லைன் பயன்முறை: சாதனத்தில் சேமித்த அடையாளம் — இணைப்பு வரும் வரை முக்கியமான சேவையகச் செயல்பாடுகள் பூட்டப்பட்டுள்ளன.',
  'auth.role.persatuan': 'சங்கம்: {id}',
  'auth.role.comingSoon': 'விரைவில்',
  'auth.role.comingSoonBody': 'இந்தப் பகுதி உங்கள் கணக்கிற்காகத் தயாராகிறது.',
};
