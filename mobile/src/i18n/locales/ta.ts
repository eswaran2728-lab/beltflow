/**
 * Tamil dictionary (H28). "Master" is rendered as ஆசான் and "Persatuan" as
 * சங்கம் (association). Needs native-speaker review before release.
 */
import type { Dictionary } from './en';
import { authTa } from './modules/auth';
import { superAdminHomeTa } from './modules/superAdminHome';
import { adminHomeTa } from './modules/adminHome';
import { masterHomeTa } from './modules/masterHome';
import { masterOpsTa } from './modules/masterOps';
import { parentHomeTa } from './modules/parentHome';
import { studentHomeTa } from './modules/studentHome';
import { adminOpsTa } from './modules/adminOps';
import { adminApprovalsTa } from './modules/adminApprovals';
import { masterClassesTa } from './modules/masterClasses';
import { masterLifecycleTa } from './modules/masterLifecycle';
import { masterHandoverTa } from './modules/masterHandover';
import { parentFlowsTa } from './modules/parentFlows';
import { parentLifecycleTa } from './modules/parentLifecycle';
import { studentFlowsTa } from './modules/studentFlows';
import { componentsTa } from './modules/components';
import { notificationsTa } from './modules/notifications';


export const ta: Dictionary = {
  'app.name': 'BeltFlow',

  'language.title': 'மொழி',
  'language.description': 'செயலியின் காட்சி மொழியைத் தேர்ந்தெடுக்கவும்.',

  'tabs.home': 'முகப்பு',
  'tabs.persatuans': 'சங்கங்கள்',
  'tabs.audit': 'தணிக்கை',
  'tabs.profile': 'சுயவிவரம்',
  'tabs.locations': 'இடங்கள்',
  'tabs.masters': 'ஆசான்கள்',
  'tabs.reports': 'அறிக்கைகள்',
  'tabs.classes': 'வகுப்புகள்',
  'tabs.attendance': 'வருகை',
  'tabs.grading': 'தரத்தேர்வு',
  'tabs.children': 'பிள்ளைகள்',
  'tabs.fees': 'கட்டணம்',
  'tabs.notices': 'அறிவிப்புகள்',
  'tabs.progress': 'முன்னேற்றம்',
  'tabs.certificates': 'சான்றிதழ்கள்',
  'tabs.ask': 'கேள்',
  'tabs.a11y': '{label} தாவல்',
  'tabs.persatuanManagement': 'சங்க நிர்வாகம்',
  'tabs.platformAudit': 'தளத் தணிக்கை',
  'tabs.assistant': 'BeltFlow உதவியாளர்',

  'status.a11y': 'நிலை: {label}',
  'status.pending': 'நிலுவையில்',
  'status.awaitingReview': 'பரிசீலனைக்குக் காத்திருக்கிறது',
  'status.actionRequired': 'நடவடிக்கை தேவை',
  'status.awaitingMaster': 'ஆசானின் அங்கீகாரத்திற்குக் காத்திருக்கிறது',
  'status.needsInformation': 'தகவல் தேவை',
  'status.waitlisted': 'காத்திருப்புப் பட்டியலில்',
  'status.approved': 'அங்கீகரிக்கப்பட்டது',
  'status.rejected': 'நிராகரிக்கப்பட்டது',
  'status.withdrawn': 'திரும்பப் பெறப்பட்டது',
  'status.draft': 'வரைவு',
  'status.active': 'செயலில்',
  'status.inactive': 'செயலில் இல்லை',
  'status.paid': 'செலுத்தப்பட்டது',
  'status.partiallyPaid': 'பகுதியாகச் செலுத்தப்பட்டது',
  'status.unpaid': 'செலுத்தப்படவில்லை',
  'status.overdue': 'தவணை கடந்தது',
  'status.present': 'வருகை',
  'status.absent': 'வரவில்லை',
  'status.late': 'தாமதம்',
  'status.excused': 'அனுமதி பெற்ற விடுப்பு',
  'status.completed': 'முடிந்தது',
  'status.cancelled': 'ரத்து செய்யப்பட்டது',
  'status.upcoming': 'வரவிருக்கிறது',
  'status.registered': 'பதிவு செய்யப்பட்டது',
  'status.pass': 'தேர்ச்சி',
  'status.fail': 'தோல்வி',

  'pending.title': 'அடுத்த படிகள்',
  'pending.whoReviews': 'யார் முடிவு செய்வார்',
  'pending.whatNext': 'அடுத்து என்ன நடக்கும்',
  'pending.whatYouCanDo': 'இப்போது நீங்கள் செய்யக்கூடியது',

  'pending.MASTER_APPLICATION.who': 'சங்க நிர்வாகி உங்கள் ஆசான் விண்ணப்பத்தைப் பரிசீலிப்பார்.',
  'pending.MASTER_APPLICATION.DRAFT.next': 'இதுவரை எதுவும் அனுப்பப்படவில்லை. நீங்கள் சமர்ப்பித்த பிறகே சங்கம் உங்கள் விண்ணப்பத்தைப் பார்க்கும்.',
  'pending.MASTER_APPLICATION.DRAFT.action': 'உங்கள் விவரங்களைச் சரிபார்த்து, தயாரானதும் சமர்ப்பி என்பதைத் தட்டவும்.',
  'pending.MASTER_APPLICATION.SUBMITTED.next': 'உங்கள் விண்ணப்பம் பரிசீலனைக்குக் காத்திருக்கிறது. அது அங்கீகரிக்கப்பட்டதும் அல்லது கூடுதல் தகவல் தேவைப்பட்டாலும் உங்களுக்குத் தெரிவிக்கப்படும்.',
  'pending.MASTER_APPLICATION.SUBMITTED.action': 'எந்த நடவடிக்கையும் தேவையில்லை. தவறுதலாக அனுப்பியிருந்தால் விண்ணப்பத்தைத் திரும்பப் பெறலாம்.',
  'pending.MASTER_APPLICATION.NEEDS_INFORMATION.next': 'கேட்கப்பட்ட தகவலை நீங்கள் அனுப்பும் வரை பரிசீலனை நிறுத்தி வைக்கப்பட்டுள்ளது.',
  'pending.MASTER_APPLICATION.NEEDS_INFORMATION.action': 'கோரிக்கையைப் படித்து, விண்ணப்பத்தைப் புதுப்பித்து மீண்டும் சமர்ப்பிக்கவும்.',
  'pending.MASTER_APPLICATION.REJECTED.next': 'இந்த விண்ணப்பம் முடிக்கப்பட்டது. இந்தச் சங்கத்தில் வகுப்புக் கருவிகள் பூட்டப்பட்டே இருக்கும்.',
  'pending.MASTER_APPLICATION.REJECTED.action': 'கொடுக்கப்பட்ட காரணத்தைப் படிக்கவும். சங்கத்தைத் தொடர்பு கொள்ளலாம் அல்லது புதிய விவரங்களுடன் மீண்டும் விண்ணப்பிக்கலாம்.',

  'pending.CLASS_PROPOSAL.who': 'சங்க நிர்வாகி உங்கள் வகுப்பு முன்மொழிவைப் பரிசீலிப்பார்.',
  'pending.CLASS_PROPOSAL.DRAFT.next': 'முன்மொழிவு இன்னும் அனுப்பப்படவில்லை. சங்கம் இதை இன்னும் பார்க்க முடியாது.',
  'pending.CLASS_PROPOSAL.DRAFT.action': 'வகுப்பு விவரங்களை நிறைவு செய்து முன்மொழிவைச் சமர்ப்பிக்கவும்.',
  'pending.CLASS_PROPOSAL.SUBMITTED.next': 'முன்மொழிவு பரிசீலனைக்குக் காத்திருக்கிறது. அங்கீகரிக்கப்படும் வரை இந்த வகுப்பு குடும்பங்களுக்குக் காட்டப்படாது.',
  'pending.CLASS_PROPOSAL.SUBMITTED.action': 'எந்த நடவடிக்கையும் தேவையில்லை. திட்டம் மாறினால் முன்மொழிவைத் திரும்பப் பெறலாம்.',
  'pending.CLASS_PROPOSAL.NEEDS_INFORMATION.next': 'சங்கத்தின் கேள்விக்கு நீங்கள் பதில் அளிக்கும் வரை பரிசீலனை நிறுத்தி வைக்கப்பட்டுள்ளது.',
  'pending.CLASS_PROPOSAL.NEEDS_INFORMATION.action': 'கோரிக்கையைப் படித்து, முன்மொழிவைப் புதுப்பித்து மீண்டும் சமர்ப்பிக்கவும்.',
  'pending.CLASS_PROPOSAL.REJECTED.next': 'இந்த முன்மொழிவு வகுப்பாக மாறாது.',
  'pending.CLASS_PROPOSAL.REJECTED.action': 'காரணத்தைப் படிக்கவும். மாற்றங்களுடன் புதிய வகுப்பை முன்மொழியலாம்.',

  'pending.ENROLLMENT_APPLICATION.who': 'இந்த வகுப்பின் ஆசான் உங்கள் விண்ணப்பத்தைப் பரிசீலிப்பார்.',
  'pending.ENROLLMENT_APPLICATION.DRAFT.next': 'விண்ணப்பம் இன்னும் ஆசானுக்கு அனுப்பப்படவில்லை.',
  'pending.ENROLLMENT_APPLICATION.DRAFT.action': 'விண்ணப்பத்தை நிறைவு செய்து சமர்ப்பிக்கவும்.',
  'pending.ENROLLMENT_APPLICATION.SUBMITTED.next': 'ஆசான் இதைப் பரிசீலிப்பார். அங்கீகாரத்திற்குப் பிறகே பயிற்சி தொடங்கும்.',
  'pending.ENROLLMENT_APPLICATION.SUBMITTED.action': 'எந்த நடவடிக்கையும் தேவையில்லை. மனம் மாறினால் திரும்பப் பெறலாம்.',
  'pending.ENROLLMENT_APPLICATION.NEEDS_INFORMATION.next': 'முடிவு செய்வதற்கு முன் ஆசானுக்குக் கூடுதல் தகவல் தேவை.',
  'pending.ENROLLMENT_APPLICATION.NEEDS_INFORMATION.action': 'இந்த விண்ணப்பத்தில் ஆசானின் கேள்விக்குப் பதில் அளிக்கவும்.',
  'pending.ENROLLMENT_APPLICATION.WAITLISTED.next': 'வகுப்பு நிரம்பியுள்ளது. காத்திருப்புப் பட்டியலில் உங்கள் இடம் தக்கவைக்கப்படும்; இடம் காலியானதும் உங்களுக்கு வழங்கப்படும்.',
  'pending.ENROLLMENT_APPLICATION.WAITLISTED.action': 'எந்த நடவடிக்கையும் தேவையில்லை. இனி இடம் தேவையில்லை என்றால் திரும்பப் பெறலாம்.',
  'pending.ENROLLMENT_APPLICATION.REJECTED.next': 'இந்த விண்ணப்பம் ஏற்றுக்கொள்ளப்படவில்லை.',
  'pending.ENROLLMENT_APPLICATION.REJECTED.action': 'காரணத்தைப் படிக்கவும். வேறு வகுப்பில் விண்ணப்பிக்கலாம்.',
  'pending.PAYMENT.who': 'உங்கள் வங்கியும் கட்டண வழங்குநரும் கட்டணத்தைத் தானாக உறுதிசெய்கின்றனர். அகாடமியில் யாரும் இதை அங்கீகரிப்பதில்லை.',
  'pending.PAYMENT.REQUIRES_PAYMENT_METHOD.next': 'கட்டணம் இன்னும் செலுத்தப்படவில்லை. உங்கள் வங்கி உறுதிசெய்த பிறகே கட்டணம் செலுத்தப்பட்டதாகக் குறிக்கப்படும்.',
  'pending.PAYMENT.REQUIRES_PAYMENT_METHOD.action': 'உங்கள் வங்கிப் பக்கத்தில் கட்டணத்தை முடிக்கவும். அதை மூடிவிட்டால், கட்டணத்தை மீண்டும் தொடங்கவும்.',
  'pending.PAYMENT.PENDING_PROCESSING.next': 'உங்கள் வங்கி கட்டணத்தை உறுதிசெய்து கொண்டிருக்கிறது. உறுதியானதும் அதிகாரப்பூர்வ ரசீது இங்கே தோன்றும். அதுவரை கட்டணம் செலுத்தப்பட்டதாகக் குறிக்கப்படாது.',
  'pending.PAYMENT.PENDING_PROCESSING.action': 'வங்கியில் செலுத்திய பிறகு, நிலையைச் சரிபார்க்கும் பொத்தானைத் தட்டவும். இது நிலுவையில் இருக்கும்போது மீண்டும் செலுத்த வேண்டாம். தோல்வியடைந்தால், மீண்டும் முயற்சிக்கலாம்.',
  'pending.MAKE_UP_BOOKING.who': 'ஈடுசெய் வகுப்பின் ஆசான்.',
  'pending.MAKE_UP_BOOKING.REQUESTED.next': 'ஆசான் உங்கள் முன்பதிவை உறுதிசெய்வார் அல்லது ரத்துசெய்வார். உறுதிசெய்யப்பட்ட முன்பதிவு செயலில் எனக் காட்டப்படும்.',
  'pending.MAKE_UP_BOOKING.REQUESTED.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. திட்டம் மாறினால், கோரிக்கையை இங்கே ரத்துசெய்யலாம்.',
  'pending.MAKE_UP_BOOKING.WAITLISTED.next': 'இந்த அமர்வு நிரம்பியுள்ளது. இடம் காலியானால், காத்திருப்புப் பட்டியலில் அடுத்தவருக்கு வழங்கப்பட்டு 24 மணி நேரம் ஒதுக்கி வைக்கப்படும்.',
  'pending.MAKE_UP_BOOKING.WAITLISTED.action': 'வாய்ப்பு வந்ததா என இந்தத் திரையில் பாருங்கள். காத்திருப்புப் பட்டியலிலிருந்து விலக ரத்துசெய்யவும்.',
  'pending.MAKE_UP_BOOKING.OFFERED.who': 'நீங்களே முடிவு செய்கிறீர்கள். இந்த இடம் உங்களுக்காக ஒதுக்கி வைக்கப்பட்டுள்ளது.',
  'pending.MAKE_UP_BOOKING.OFFERED.next': 'ஒரு இடம் காலியாகி, 24 மணி நேரம் உங்களுக்காக ஒதுக்கி வைக்கப்பட்டுள்ளது. நேரத்துக்குள் ஏற்காவிட்டால், அடுத்தவருக்குச் செல்லும்.',
  'pending.MAKE_UP_BOOKING.OFFERED.action': 'உறுதிசெய்ய இடத்தை ஏற்கவும் என்பதைத் தட்டவும், தேவையில்லை என்றால் ரத்துசெய்யவும்.',
  'pending.PAUSE_REQUEST.who': 'உங்கள் பிள்ளையின் ஆசான் அல்லது சங்க நிர்வாகி.',
  'pending.PAUSE_REQUEST.REQUESTED.next': 'அங்கீகரிக்கப்பட்டதும், தொடக்கத் தேதியிலிருந்து உறுப்பினர் நிலை இடைநிறுத்தப்படும். இந்தத் திரையிலிருந்து மீண்டும் பயிற்சிக்குத் திரும்பலாம்.',
  'pending.PAUSE_REQUEST.REQUESTED.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. அவசரமானால், ஆசானுக்குச் செய்தி அனுப்புங்கள்.',
  'pending.TRANSFER_REQUEST.who': 'புதிய வகுப்பின் ஆசான்.',
  'pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.who': 'முதலில் உங்கள் பிள்ளையின் தற்போதைய ஆசான், பிறகு புதிய வகுப்பின் ஆசான்.',
  'pending.TRANSFER_REQUEST.PENDING_RECEIVING.next': 'ஆசான் ஏற்றதும், நடைமுறைத் தேதியில் உங்கள் பிள்ளை புதிய வகுப்புக்கு மாறுவார். அதுவரை எதுவும் மாறாது.',
  'pending.TRANSFER_REQUEST.REQUESTED.next': 'ஆசான் ஏற்றதும், நடைமுறைத் தேதியில் உங்கள் பிள்ளை புதிய வகுப்புக்கு மாறுவார். அதுவரை எதுவும் மாறாது.',
  'pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.next': 'தற்போதைய ஆசான் ஒப்புக்கொண்ட பிறகு, புதிய வகுப்பின் ஆசான் முடிவு செய்வார். அதுவரை எதுவும் மாறாது.',
  'pending.TRANSFER_REQUEST.PENDING_NEW_MASTER.next': 'தற்போதைய ஆசான் ஒப்புக்கொண்டுள்ளார். புதிய வகுப்பின் ஆசான் ஏற்றதும், நடைமுறைத் தேதியில் உங்கள் பிள்ளை மாறுவார்.',
  'pending.TRANSFER_REQUEST.PENDING_RECEIVING.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. அவசரமானால், ஆசானுக்குச் செய்தி அனுப்புங்கள்.',
  'pending.TRANSFER_REQUEST.REQUESTED.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. அவசரமானால், ஆசானுக்குச் செய்தி அனுப்புங்கள்.',
  'pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. அவசரமானால், ஆசானுக்குச் செய்தி அனுப்புங்கள்.',
  'pending.TRANSFER_REQUEST.PENDING_NEW_MASTER.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. அவசரமானால், ஆசானுக்குச் செய்தி அனுப்புங்கள்.',
  'pending.HANDOVER.who': 'பொறுப்பேற்கும் ஆசான், பிறகு சங்க நிர்வாகி.',
  'pending.HANDOVER.REQUESTED.next': 'பொறுப்பேற்கும் ஆசான் ஏற்பார் அல்லது மறுப்பார். ஏற்றால், சங்க நிர்வாகி இறுதி அங்கீகாரம் அளித்து வகுப்பு அவருக்கு மாறும்.',
  'pending.HANDOVER.REQUESTED.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. ஒப்படைப்பு அங்கீகரிக்கப்படும் வரை நீங்களே வகுப்பை நடத்துவீர்கள்.',
  'pending.HANDOVER.INCOMING_ACCEPTED.who': 'சங்க நிர்வாகி.',
  'pending.HANDOVER.INCOMING_ACCEPTED.next': 'பொறுப்பேற்கும் ஆசான் ஏற்றுக்கொண்டார். சங்க நிர்வாகி அங்கீகரித்ததும், வகுப்பு அவருக்கு மாறும்.',
  'pending.HANDOVER.INCOMING_ACCEPTED.action': 'நீங்கள் எதுவும் செய்ய வேண்டியதில்லை. ஒப்படைப்பு அங்கீகரிக்கப்படும் வரை நீங்களே வகுப்பை நடத்துவீர்கள்.',
  ...authTa,
  ...superAdminHomeTa,
  ...adminHomeTa,
  ...masterHomeTa,
  ...masterOpsTa,
  ...parentHomeTa,
  ...studentHomeTa,
  ...adminOpsTa,
  ...adminApprovalsTa,
  ...masterClassesTa,
  ...masterLifecycleTa,
  ...masterHandoverTa,
  ...parentFlowsTa,
  ...parentLifecycleTa,
  ...studentFlowsTa,
  ...componentsTa,
  ...notificationsTa,
};
