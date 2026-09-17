import fs from 'fs';
import path from 'path';
import { UserRole } from '../security/rbac';

export interface DbOrganization {
  id: string;
  name: string;
  state: string;
  martialArtStyle: string;
  masterName: string;
  phone: string;
  email: string;
  baseMonthlyFee: number;
  siblingDiscountPercent: number;
  status: string;
  createdAt: string;
}

export interface DbUser {
  id: string;
  organizationId?: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  status: string;
  assignedClassIds?: string[];
  linkedStudentIds?: string[];
  createdAt: string;
}

export interface DbClass {
  id: string;
  organizationId: string;
  masterId?: string;
  masterName?: string;
  mainMasterId?: string; // Main Master class assignment
  name: string;
  schedule: string;
  location: string;
  status: string;
  createdAt: string;
}

export interface DbStudent {
  id: string;
  organizationId: string;
  classId?: string;
  className?: string;
  userId?: string;
  fullName: string;
  icNumber: string;
  phone?: string;
  email?: string;
  beltRank: string;
  monthlyFee: number;
  hasSiblingDiscount: boolean;
  billingStatus: string;
  status: string;
  registeredAt: string;
}

export interface DbAttendanceRecord {
  id: string;
  classId: string;
  sessionDate: string;
  studentId: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  markedAt: string;
}

export interface DbInvoice {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  billingMonth: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: 'UNPAID' | 'PENDING_APPROVAL' | 'PAID';
  createdAt: string;
}

export interface DbPayment {
  id: string;
  invoiceId: string;
  studentId: string;
  studentName: string;
  parentId?: string;
  amount: number;
  method: string;
  proofNotes?: string;
  receiptNo?: string;
  submittedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  status: 'Pending Review' | 'Approved' | 'Rejected';
  createdAt: string;
}

export interface DbGradingEvent {
  id: string;
  organizationId: string;
  title: string;
  eventDate: string;
  location: string;
  fee: number;
  candidates: {
    studentId: string;
    studentName: string;
    currentBelt: string;
    targetBelt: string;
    result: 'Registered' | 'Passed' | 'Failed' | 'Double Promotion';
  }[];
  createdAt: string;
}

export interface DbCertificate {
  id: string;
  code: string;
  organizationId: string;
  organizationName: string;
  studentId: string;
  studentName: string;
  masterName: string;
  rankOrTitle: string;
  type: string;
  issueDate: string;
  status: string;
  createdAt: string;
}

export interface DbAuditLog {
  id: string;
  action: string;
  details: string;
  userRole: string;
  userEmail: string;
  timestamp: string;
}

interface SerializedState {
  organizations: DbOrganization[];
  users: DbUser[];
  classes: DbClass[];
  students: DbStudent[];
  attendance: DbAttendanceRecord[];
  invoices: DbInvoice[];
  payments: DbPayment[];
  gradingEvents: DbGradingEvent[];
  certificates: DbCertificate[];
  auditLogs: DbAuditLog[];
}

export class PersistentDataStore {
  private dbFilePath: string;
  organizations: DbOrganization[] = [];
  users: DbUser[] = [];
  classes: DbClass[] = [];
  students: DbStudent[] = [];
  attendance: DbAttendanceRecord[] = [];
  invoices: DbInvoice[] = [];
  payments: DbPayment[] = [];
  gradingEvents: DbGradingEvent[] = [];
  certificates: DbCertificate[] = [];
  auditLogs: DbAuditLog[] = [];

  constructor(customPath?: string) {
    this.dbFilePath = customPath || path.join(process.cwd(), '.beltflow_db.json');
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const data: SerializedState = JSON.parse(raw);
        this.organizations = data.organizations || [];
        this.users = data.users || [];
        this.classes = data.classes || [];
        this.students = data.students || [];
        this.attendance = data.attendance || [];
        this.invoices = data.invoices || [];
        this.payments = data.payments || [];
        this.gradingEvents = data.gradingEvents || [];
        this.certificates = data.certificates || [];
        this.auditLogs = data.auditLogs || [];
      }
    } catch (err) {
      console.warn('[DataStore]: Could not load DB file, starting clean.', err);
    }
  }

  saveToDisk() {
    try {
      const state: SerializedState = {
        organizations: this.organizations,
        users: this.users,
        classes: this.classes,
        students: this.students,
        attendance: this.attendance,
        invoices: this.invoices,
        payments: this.payments,
        gradingEvents: this.gradingEvents,
        certificates: this.certificates,
        auditLogs: this.auditLogs
      };
      fs.writeFileSync(this.dbFilePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.error('[DataStore]: Failed to persist DB to disk:', err);
    }
  }

  clear() {
    this.organizations = [];
    this.users = [];
    this.classes = [];
    this.students = [];
    this.attendance = [];
    this.invoices = [];
    this.payments = [];
    this.gradingEvents = [];
    this.certificates = [];
    this.auditLogs = [];
    if (fs.existsSync(this.dbFilePath)) {
      try { fs.unlinkSync(this.dbFilePath); } catch (e) {}
    }
  }

  logAudit(action: string, details: string, role: string, email: string) {
    this.auditLogs.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      details,
      userRole: role,
      userEmail: email,
      timestamp: new Date().toISOString()
    });
    this.saveToDisk();
  }
}

export const db = new PersistentDataStore();
