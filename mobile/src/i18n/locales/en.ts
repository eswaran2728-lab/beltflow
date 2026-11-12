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
import { adminOpsEn } from './modules/adminOps';
import { adminApprovalsEn } from './modules/adminApprovals';
import { masterClassesEn } from './modules/masterClasses';
import { masterLifecycleEn } from './modules/masterLifecycle';
import { masterHandoverEn } from './modules/masterHandover';
import { parentFlowsEn } from './modules/parentFlows';
import { parentLifecycleEn } from './modules/parentLifecycle';
import { studentFlowsEn } from './modules/studentFlows';
import { componentsEn } from './modules/components';

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
  'pending.PAYMENT.who': 'Your bank and the payment provider confirm the payment automatically. No one at the academy approves it.',
  'pending.PAYMENT.REQUIRES_PAYMENT_METHOD.next': 'The payment has not been made yet. The fee is only marked as paid after your bank confirms it.',
  'pending.PAYMENT.REQUIRES_PAYMENT_METHOD.action': 'Finish paying on your bank\'s page. If you closed it, start the payment again.',
  'pending.PAYMENT.PENDING_PROCESSING.next': 'Your bank is confirming the payment. Your official receipt appears here once it is confirmed. Until then, the fee is not marked as paid.',
  'pending.PAYMENT.PENDING_PROCESSING.action': 'After paying at your bank, tap the check status button. Do not pay again while this is pending. If it fails, you can try again.',
  'pending.MAKE_UP_BOOKING.who': 'The Master of the make-up class.',
  'pending.MAKE_UP_BOOKING.REQUESTED.next': 'The Master will confirm or cancel your booking. A confirmed booking shows as Active.',
  'pending.MAKE_UP_BOOKING.REQUESTED.action': 'No action is needed. You can cancel the request here if your plans change.',
  'pending.MAKE_UP_BOOKING.WAITLISTED.next': 'The session is full. If a seat opens, it is offered to the next person on the waiting list and held for 24 hours.',
  'pending.MAKE_UP_BOOKING.WAITLISTED.action': 'Check this screen for an offer. Cancel to leave the waiting list.',
  'pending.MAKE_UP_BOOKING.OFFERED.who': 'You decide. The seat is being held for you.',
  'pending.MAKE_UP_BOOKING.OFFERED.next': 'A seat has opened and is held for you for 24 hours. If you do not accept in time, it goes to the next person.',
  'pending.MAKE_UP_BOOKING.OFFERED.action': 'Tap Accept Seat to confirm, or cancel if you no longer need it.',
  'pending.PAUSE_REQUEST.who': 'Your child\'s Master or the Persatuan admin.',
  'pending.PAUSE_REQUEST.REQUESTED.next': 'When it is approved, the membership is paused from the start date. You can return to training from this screen.',
  'pending.PAUSE_REQUEST.REQUESTED.action': 'No action is needed. If it is urgent, message the Master.',
  'pending.TRANSFER_REQUEST.who': 'The Master of the new class.',
  'pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.who': 'Your child\'s current Master first, then the Master of the new class.',
  'pending.TRANSFER_REQUEST.PENDING_RECEIVING.next': 'When the Master accepts, your child moves to the new class on the effective date. Until then, nothing changes.',
  'pending.TRANSFER_REQUEST.REQUESTED.next': 'When the Master accepts, your child moves to the new class on the effective date. Until then, nothing changes.',
  'pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.next': 'After the current Master agrees, the Master of the new class decides. Until then, nothing changes.',
  'pending.TRANSFER_REQUEST.PENDING_NEW_MASTER.next': 'The current Master has agreed. When the Master of the new class accepts, your child moves on the effective date.',
  'pending.TRANSFER_REQUEST.PENDING_RECEIVING.action': 'No action is needed. If it is urgent, message the Master.',
  'pending.TRANSFER_REQUEST.REQUESTED.action': 'No action is needed. If it is urgent, message the Master.',
  'pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.action': 'No action is needed. If it is urgent, message the Master.',
  'pending.TRANSFER_REQUEST.PENDING_NEW_MASTER.action': 'No action is needed. If it is urgent, message the Master.',
  'pending.HANDOVER.who': 'The incoming Master, then the Persatuan admin.',
  'pending.HANDOVER.REQUESTED.next': 'The incoming Master accepts or declines. If they accept, the Persatuan admin gives final approval and the class moves to them.',
  'pending.HANDOVER.REQUESTED.action': 'No action is needed. You keep leading the class until the handover is approved.',
  'pending.HANDOVER.INCOMING_ACCEPTED.who': 'The Persatuan admin.',
  'pending.HANDOVER.INCOMING_ACCEPTED.next': 'The incoming Master has accepted. When the Persatuan admin approves, the class moves to them.',
  'pending.HANDOVER.INCOMING_ACCEPTED.action': 'No action is needed. You keep leading the class until the handover is approved.',
  ...authEn,
  ...superAdminHomeEn,
  ...adminHomeEn,
  ...masterHomeEn,
  ...masterOpsEn,
  ...parentHomeEn,
  ...studentHomeEn,
  ...adminOpsEn,
  ...adminApprovalsEn,
  ...masterClassesEn,
  ...masterLifecycleEn,
  ...masterHandoverEn,
  ...parentFlowsEn,
  ...parentLifecycleEn,
  ...studentFlowsEn,
  ...componentsEn,
};

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
