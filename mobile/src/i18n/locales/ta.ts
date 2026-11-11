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
  ...authTa,
  ...superAdminHomeTa,
  ...adminHomeTa,
  ...masterHomeTa,
  ...masterOpsTa,
  ...parentHomeTa,
  ...studentHomeTa,
};
