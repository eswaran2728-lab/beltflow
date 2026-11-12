/**
 * Bahasa Melayu dictionary (H28). Needs native-speaker review before release.
 */
import type { Dictionary } from './en';
import { authMs } from './modules/auth';
import { superAdminHomeMs } from './modules/superAdminHome';
import { adminHomeMs } from './modules/adminHome';
import { masterHomeMs } from './modules/masterHome';
import { masterOpsMs } from './modules/masterOps';
import { parentHomeMs } from './modules/parentHome';
import { studentHomeMs } from './modules/studentHome';
import { adminOpsMs } from './modules/adminOps';
import { adminApprovalsMs } from './modules/adminApprovals';
import { masterClassesMs } from './modules/masterClasses';
import { masterLifecycleMs } from './modules/masterLifecycle';
import { masterHandoverMs } from './modules/masterHandover';
import { parentFlowsMs } from './modules/parentFlows';
import { parentLifecycleMs } from './modules/parentLifecycle';
import { studentFlowsMs } from './modules/studentFlows';
import { componentsMs } from './modules/components';


export const ms: Dictionary = {
  'app.name': 'BeltFlow',

  'language.title': 'Bahasa',
  'language.description': 'Pilih bahasa paparan aplikasi.',

  'tabs.home': 'Utama',
  'tabs.persatuans': 'Persatuan',
  'tabs.audit': 'Audit',
  'tabs.profile': 'Profil',
  'tabs.locations': 'Lokasi',
  'tabs.masters': 'Master',
  'tabs.reports': 'Laporan',
  'tabs.classes': 'Kelas',
  'tabs.attendance': 'Kehadiran',
  'tabs.grading': 'Penggredan',
  'tabs.children': 'Anak',
  'tabs.fees': 'Yuran',
  'tabs.notices': 'Notis',
  'tabs.progress': 'Kemajuan',
  'tabs.certificates': 'Sijil',
  'tabs.ask': 'Tanya',
  'tabs.a11y': 'Tab {label}',
  'tabs.persatuanManagement': 'Pengurusan Persatuan',
  'tabs.platformAudit': 'Audit Platform',
  'tabs.assistant': 'Pembantu BeltFlow',

  'status.a11y': 'Status: {label}',
  'status.pending': 'Belum selesai',
  'status.awaitingReview': 'Menunggu semakan',
  'status.actionRequired': 'Tindakan diperlukan',
  'status.awaitingMaster': 'Menunggu kelulusan Master',
  'status.needsInformation': 'Perlukan maklumat',
  'status.waitlisted': 'Dalam senarai menunggu',
  'status.approved': 'Diluluskan',
  'status.rejected': 'Ditolak',
  'status.withdrawn': 'Ditarik balik',
  'status.draft': 'Draf',
  'status.active': 'Aktif',
  'status.inactive': 'Tidak aktif',
  'status.paid': 'Dibayar',
  'status.partiallyPaid': 'Dibayar sebahagian',
  'status.unpaid': 'Belum dibayar',
  'status.overdue': 'Tertunggak',
  'status.present': 'Hadir',
  'status.absent': 'Tidak hadir',
  'status.late': 'Lewat',
  'status.excused': 'Dimaafkan',
  'status.completed': 'Selesai',
  'status.cancelled': 'Dibatalkan',
  'status.upcoming': 'Akan datang',
  'status.registered': 'Berdaftar',
  'status.pass': 'Lulus',
  'status.fail': 'Gagal',

  'pending.title': 'Langkah seterusnya',
  'pending.whoReviews': 'Siapa yang membuat keputusan',
  'pending.whatNext': 'Apa yang berlaku seterusnya',
  'pending.whatYouCanDo': 'Apa yang anda boleh lakukan sekarang',

  'pending.MASTER_APPLICATION.who': 'Pentadbir Persatuan menyemak permohonan Master anda.',
  'pending.MASTER_APPLICATION.DRAFT.next': 'Belum ada apa-apa dihantar. Persatuan hanya melihat permohonan anda selepas anda menghantarnya.',
  'pending.MASTER_APPLICATION.DRAFT.action': 'Semak butiran anda dan tekan Hantar apabila sedia.',
  'pending.MASTER_APPLICATION.SUBMITTED.next': 'Permohonan anda sedang menunggu semakan. Anda akan dimaklumkan apabila ia diluluskan atau jika maklumat tambahan diperlukan.',
  'pending.MASTER_APPLICATION.SUBMITTED.action': 'Tiada tindakan diperlukan. Anda boleh menarik balik permohonan jika tersilap hantar.',
  'pending.MASTER_APPLICATION.NEEDS_INFORMATION.next': 'Semakan ditangguhkan sehingga anda menghantar maklumat yang diminta.',
  'pending.MASTER_APPLICATION.NEEDS_INFORMATION.action': 'Baca permintaan itu, kemas kini permohonan anda dan hantar semula.',
  'pending.MASTER_APPLICATION.REJECTED.next': 'Permohonan ini telah ditutup. Alat kelas kekal dikunci untuk Persatuan ini.',
  'pending.MASTER_APPLICATION.REJECTED.action': 'Baca sebab yang diberikan. Anda boleh menghubungi Persatuan atau memohon semula dengan butiran terkini.',

  'pending.CLASS_PROPOSAL.who': 'Pentadbir Persatuan menyemak cadangan kelas anda.',
  'pending.CLASS_PROPOSAL.DRAFT.next': 'Cadangan belum dihantar. Persatuan belum dapat melihatnya.',
  'pending.CLASS_PROPOSAL.DRAFT.action': 'Lengkapkan butiran kelas dan hantar cadangan.',
  'pending.CLASS_PROPOSAL.SUBMITTED.next': 'Cadangan sedang menunggu semakan. Keluarga tidak dapat melihat kelas ini sehingga ia diluluskan.',
  'pending.CLASS_PROPOSAL.SUBMITTED.action': 'Tiada tindakan diperlukan. Anda boleh menarik balik cadangan jika rancangan berubah.',
  'pending.CLASS_PROPOSAL.NEEDS_INFORMATION.next': 'Semakan ditangguhkan sehingga anda menjawab soalan Persatuan.',
  'pending.CLASS_PROPOSAL.NEEDS_INFORMATION.action': 'Baca permintaan itu, kemas kini cadangan dan hantar semula.',
  'pending.CLASS_PROPOSAL.REJECTED.next': 'Cadangan ini tidak akan dijadikan kelas.',
  'pending.CLASS_PROPOSAL.REJECTED.action': 'Baca sebabnya. Anda boleh mencadangkan kelas baharu dengan perubahan.',

  'pending.ENROLLMENT_APPLICATION.who': 'Master kelas ini menyemak permohonan anda.',
  'pending.ENROLLMENT_APPLICATION.DRAFT.next': 'Permohonan belum dihantar kepada Master.',
  'pending.ENROLLMENT_APPLICATION.DRAFT.action': 'Lengkapkan permohonan dan hantarkannya.',
  'pending.ENROLLMENT_APPLICATION.SUBMITTED.next': 'Master akan menyemaknya. Latihan hanya bermula selepas diluluskan.',
  'pending.ENROLLMENT_APPLICATION.SUBMITTED.action': 'Tiada tindakan diperlukan. Anda boleh menarik baliknya jika berubah fikiran.',
  'pending.ENROLLMENT_APPLICATION.NEEDS_INFORMATION.next': 'Master memerlukan maklumat tambahan sebelum membuat keputusan.',
  'pending.ENROLLMENT_APPLICATION.NEEDS_INFORMATION.action': 'Balas soalan Master dalam permohonan ini.',
  'pending.ENROLLMENT_APPLICATION.WAITLISTED.next': 'Kelas ini penuh. Tempat anda dalam senarai menunggu dikekalkan dan anda akan ditawarkan tempat apabila ada kekosongan.',
  'pending.ENROLLMENT_APPLICATION.WAITLISTED.action': 'Tiada tindakan diperlukan. Anda boleh menarik balik jika tidak lagi memerlukan tempat.',
  'pending.ENROLLMENT_APPLICATION.REJECTED.next': 'Permohonan ini tidak diterima.',
  'pending.ENROLLMENT_APPLICATION.REJECTED.action': 'Baca sebabnya. Anda boleh memohon kelas lain.',
  ...authMs,
  ...superAdminHomeMs,
  ...adminHomeMs,
  ...masterHomeMs,
  ...masterOpsMs,
  ...parentHomeMs,
  ...studentHomeMs,
  ...adminOpsMs,
  ...adminApprovalsMs,
  ...masterClassesMs,
  ...masterLifecycleMs,
  ...masterHandoverMs,
  ...parentFlowsMs,
  ...parentLifecycleMs,
  ...studentFlowsMs,
  ...componentsMs,
};
