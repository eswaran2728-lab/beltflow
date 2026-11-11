/**
 * English source dictionary (H28). Every key here must exist in ms.ts and
 * ta.ts with the same {placeholders}; localizationUsabilityH28 enforces it.
 */
import { authEn } from './modules/auth';
import { superAdminHomeEn } from './modules/superAdminHome';
import { adminHomeEn } from './modules/adminHome';
import { masterHomeEn } from './modules/masterHome';
import { masterOpsEn } from './modules/masterOps';
import { parentHomeEn } from './modules/parentHome';
import { studentHomeEn } from './modules/studentHome';

export const en = {
  'app.name': 'BeltFlow',

  'language.title': 'Language',
  'language.description': 'Choose the language for the app.',

  'tabs.home': 'Home',
  'tabs.persatuans': 'Persatuans',
  'tabs.audit': 'Audit',
  'tabs.profile': 'Profile',
  'tabs.locations': 'Locations',
  'tabs.masters': 'Masters',
  'tabs.reports': 'Reports',
  'tabs.classes': 'Classes',
  'tabs.attendance': 'Attendance',
  'tabs.grading': 'Grading',
  'tabs.children': 'Children',
  'tabs.fees': 'Fees',
  'tabs.notices': 'Notices',
  'tabs.progress': 'Progress',
  'tabs.certificates': 'Certificates',
  'tabs.ask': 'Ask',
  'tabs.a11y': '{label} Tab',
  'tabs.persatuanManagement': 'Persatuan Management',
  'tabs.platformAudit': 'Platform Audit',
  'tabs.assistant': 'BeltFlow Assistant',

  'status.a11y': 'Status: {label}',
  'status.pending': 'Pending',
  'status.awaitingReview': 'Awaiting Review',
  'status.actionRequired': 'Action Required',
  'status.awaitingMaster': 'Awaiting Master Approval',
  'status.needsInformation': 'Needs Information',
  'status.waitlisted': 'Waitlisted',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',
  'status.withdrawn': 'Withdrawn',
  'status.draft': 'Draft',
  'status.active': 'Active',
  'status.inactive': 'Inactive',
  'status.paid': 'Paid',
  'status.partiallyPaid': 'Partially Paid',
  'status.unpaid': 'Unpaid',
  'status.overdue': 'Overdue',
  'status.present': 'Present',
  'status.absent': 'Absent',
  'status.late': 'Late',
  'status.excused': 'Excused',
  'status.completed': 'Completed',
  'status.cancelled': 'Cancelled',
  'status.upcoming': 'Upcoming',
  'status.registered': 'Registered',
  'status.pass': 'Pass',
  'status.fail': 'Fail',

  'pending.title': 'Next steps',
  'pending.whoReviews': 'Who decides',
  'pending.whatNext': 'What happens next',
  'pending.whatYouCanDo': 'What you can do now',

  'pending.MASTER_APPLICATION.who': 'The Persatuan administrator reviews your Master application.',
  'pending.MASTER_APPLICATION.DRAFT.next': 'Nothing has been sent yet. The Persatuan only sees your application after you submit it.',
  'pending.MASTER_APPLICATION.DRAFT.action': 'Check your details and tap Submit when you are ready.',
  'pending.MASTER_APPLICATION.SUBMITTED.next': 'Your application is waiting for review. You will be told when it is approved or if more information is needed.',
  'pending.MASTER_APPLICATION.SUBMITTED.action': 'No action is needed. You can withdraw the application if you sent it by mistake.',
  'pending.MASTER_APPLICATION.NEEDS_INFORMATION.next': 'The review is paused until you send the information that was requested.',
  'pending.MASTER_APPLICATION.NEEDS_INFORMATION.action': 'Read the request, update your application and submit it again.',
  'pending.MASTER_APPLICATION.REJECTED.next': 'This application is closed. Class tools stay locked for this Persatuan.',
  'pending.MASTER_APPLICATION.REJECTED.action': 'Read the reason given. You can contact the Persatuan or apply again with updated details.',

  'pending.CLASS_PROPOSAL.who': 'The Persatuan administrator reviews your class proposal.',
  'pending.CLASS_PROPOSAL.DRAFT.next': 'The proposal has not been sent. The Persatuan cannot see it yet.',
  'pending.CLASS_PROPOSAL.DRAFT.action': 'Complete the class details and submit the proposal.',
  'pending.CLASS_PROPOSAL.SUBMITTED.next': 'The proposal is waiting for review. Families cannot see the class until it is approved.',
  'pending.CLASS_PROPOSAL.SUBMITTED.action': 'No action is needed. You can withdraw the proposal if your plans change.',
  'pending.CLASS_PROPOSAL.NEEDS_INFORMATION.next': "The review is paused until you answer the Persatuan's question.",
  'pending.CLASS_PROPOSAL.NEEDS_INFORMATION.action': 'Read the request, update the proposal and submit it again.',
  'pending.CLASS_PROPOSAL.REJECTED.next': 'This proposal will not become a class.',
  'pending.CLASS_PROPOSAL.REJECTED.action': 'Read the reason. You can propose a new class with changes.',

  'pending.ENROLLMENT_APPLICATION.who': 'The Master of this class reviews your application.',
  'pending.ENROLLMENT_APPLICATION.DRAFT.next': 'The application has not been sent to the Master yet.',
  'pending.ENROLLMENT_APPLICATION.DRAFT.action': 'Finish the application and submit it.',
  'pending.ENROLLMENT_APPLICATION.SUBMITTED.next': 'The Master will review it. Training starts only after approval.',
  'pending.ENROLLMENT_APPLICATION.SUBMITTED.action': 'No action is needed. You can withdraw it if you change your mind.',
  'pending.ENROLLMENT_APPLICATION.NEEDS_INFORMATION.next': 'The Master needs more information before deciding.',
  'pending.ENROLLMENT_APPLICATION.NEEDS_INFORMATION.action': "Reply to the Master's question in this application.",
  'pending.ENROLLMENT_APPLICATION.WAITLISTED.next': 'The class is full. You keep your place on the waiting list and will be offered a seat when one opens.',
  'pending.ENROLLMENT_APPLICATION.WAITLISTED.action': 'No action is needed. You can withdraw if you no longer want a seat.',
  'pending.ENROLLMENT_APPLICATION.REJECTED.next': 'This application was not accepted.',
  'pending.ENROLLMENT_APPLICATION.REJECTED.action': 'Read the reason. You can apply to another class.',
  ...authEn,
  ...superAdminHomeEn,
  ...adminHomeEn,
  ...masterHomeEn,
  ...masterOpsEn,
  ...parentHomeEn,
  ...studentHomeEn,
};

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
