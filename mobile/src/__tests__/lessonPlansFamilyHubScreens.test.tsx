import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { teachingService } from '../services/teachingService';
import { familyService } from '../services/familyService';
import { LessonPlanModal } from '../screens/roles/master/LessonPlanModal';
import { FamilyTimelineHubScreen } from '../screens/roles/parent/FamilyTimelineHubScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/teachingService', () => ({
  teachingService: {
    saveLessonPlan: jest.fn(),
    getLessonPlan: jest.fn(),
    getSubstituteBrief: jest.fn(),
  },
}));

jest.mock('../services/familyService', () => ({
  familyService: {
    getChildren: jest.fn(),
    getChildTimeline: jest.fn(),
    getMerchantDuesSummary: jest.fn(),
  },
}));

jest.setTimeout(30000);

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('Official Task H19: Lesson Plans & Family Hub Depth Mobile Tests', () => {
  jest.setTimeout(30000);

  const parentUser: AuthUser = {
    id: 'usr_parent_h19',
    fullName: 'Puan Siti Aminah',
    email: 'siti@example.com',
    role: UserRole.PARENT,
    organizationId: 'org_silat_01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (teachingService.getLessonPlan as jest.Mock).mockResolvedValue({
      session: { id: 'sess_default' },
      lessonPlan: null,
    });
    (teachingService.getSubstituteBrief as jest.Mock).mockResolvedValue({
      isSubstituteBrief: true,
      session: { id: 'sess_default' },
      lessonPlan: null,
      studentSafetyBrief: [],
      confidentialityNotice: '',
    });
    (familyService.getChildren as jest.Mock).mockResolvedValue([]);
    (familyService.getChildTimeline as jest.Mock).mockResolvedValue({
      student: {},
      attendance: [],
      rankHistory: [],
      upcomingSessions: [],
      financialPartitions: [],
    });
  });

  // ACCEPTANCE CRITERIA 1: substitute_brief_hides_private_messages
  it('substitute_brief_hides_private_messages: strips private notes and displays confidentiality notice and safety brief', async () => {
    (teachingService.getSubstituteBrief as jest.Mock).mockResolvedValue({
      isSubstituteBrief: true,
      session: {
        id: 'sess_101',
        classId: 'cls_01',
        className: 'Silat Seni Gayong Remaja',
        dayOfWeek: 'SATURDAY',
        sessionDate: '2026-10-24',
        startTime: '10:00',
        endTime: '11:30',
        location: 'Gelanggang Utama, Shah Alam',
        status: 'SCHEDULED',
      },
      lessonPlan: {
        id: 'lp_101',
        sessionId: 'sess_101',
        classId: 'cls_01',
        title: 'Lompatan & Kuncian Lanjutan',
        objectives: 'Mastering counter locks and spatial evasion',
        drills: [
          { name: 'Kicking combinations', duration_minutes: 20, instructions: 'High and low roundhouse' },
        ],
        equipment: ['Target pads', 'Floor mats'],
        version: 2,
        authorName: 'Master Azlan',
      },
      studentSafetyBrief: [
        {
          student_id: 'stu_101',
          student_name: 'Adam Daniel',
          belt_rank: 'Kuning (Yellow)',
          medical_conditions: 'Asthma (Carries inhaler in bag)',
          allergies: 'Peanuts',
          emergency_contact_phone: '+60129876543',
        },
      ],
      confidentialityNotice:
        'CONFIDENTIAL: This briefing is intended solely for assigned substitute instructors. Unauthorized distribution or copying is strictly prohibited under BeltFlow Academy Governance.',
    });

    const { getByTestId, queryByText, findByText } = await renderWithTheme(
      <LessonPlanModal
        visible={true}
        onClose={jest.fn()}
        sessionId="sess_101"
        sessionTitle="Silat Seni Gayong Remaja"
        isSubstituteViewInitial={true}
      />
    );

    // Verify Substitute Brief loads
    expect(await findByText('CONFIDENTIAL SUBSTITUTE BRIEF')).toBeTruthy();
    expect(getByTestId('substitute-brief-view')).toBeTruthy();
    expect(getByTestId('substitute-confidentiality-notice')).toBeTruthy();
    expect(getByTestId('safety-brief-list')).toBeTruthy();

    // Verify student safety details are present
    expect(await findByText('Adam Daniel')).toBeTruthy();
    expect(await findByText(/Asthma \(Carries inhaler in bag\)/)).toBeTruthy();
    expect(await findByText(/Peanuts/)).toBeTruthy();

    // Verify private notes or private master messages are STRICTLY ABSENT
    expect(queryByText('Private Master Notes')).toBeNull();
    expect(queryByText('private_master_notes')).toBeNull();
    expect(queryByText('student grading readiness observations')).toBeNull();
  });

  // ACCEPTANCE CRITERIA 2: lesson_edit_version_conflict
  it('lesson_edit_version_conflict: enforces optimistic concurrency and shows conflict alert upon version mismatch', async () => {
    (teachingService.getLessonPlan as jest.Mock).mockResolvedValue({
      session: { id: 'sess_102' },
      lessonPlan: {
        id: 'lp_102',
        sessionId: 'sess_102',
        classId: 'cls_01',
        title: 'Original Syllabus Plan',
        objectives: 'Initial focus',
        drills: [{ name: 'Basic stances', duration_minutes: 15 }],
        equipment: ['Mats'],
        coveredMaterial: 'Form 1',
        privateMasterNotes: 'Confidential master observation notes',
        version: 1,
      },
    });

    const conflictError: any = new Error(
      'Conflict: Lesson plan was modified by another instructor. Expected version 1, but current version is 2.'
    );
    conflictError.statusCode = 409;
    conflictError.currentVersion = 2;
    (teachingService.saveLessonPlan as jest.Mock).mockRejectedValue(conflictError);

    const { getByTestId, findByText, getByText } = await renderWithTheme(
      <LessonPlanModal
        visible={true}
        onClose={jest.fn()}
        sessionId="sess_102"
        sessionTitle="Silat Dewasa"
        isSubstituteViewInitial={false}
      />
    );

    expect(await findByText('Version 1')).toBeTruthy();

    // Attempt to save
    const saveButton = getByTestId('btn-save-lesson-plan');
    fireEvent.press(saveButton);

    // Verify conflict banner appears with HTTP 409 and reload button
    await waitFor(() => {
      expect(getByTestId('version-conflict-banner')).toBeTruthy();
      expect(getByTestId('btn-reload-conflict')).toBeTruthy();
      expect(getByText('Edit Conflict (HTTP 409)')).toBeTruthy();
    });
  });

  // ACCEPTANCE CRITERIA 3: revoked_guardian_loses_access
  it('revoked_guardian_loses_access: revoked guardian access to student timeline triggers HTTP 403 access restricted banner', async () => {
    (familyService.getChildren as jest.Mock).mockResolvedValue([
      {
        id: 'stu_revoked_01',
        full_name: 'Zahra Binti Kamaruddin',
        ic_number: '120505-10-1234',
        belt_rank: 'Putih (White)',
        monthly_fee: 100,
        billing_status: 'CURRENT',
        status: 'ACTIVE',
        organization_id: 'org_silat_01',
        organization_name: 'Pertubuhan Silat Seni Gayong',
        link_status: 'REVOKED',
      },
    ]);

    const forbiddenError: any = new Error(
      'Forbidden: Guardian relationship to student is revoked or inactive.'
    );
    forbiddenError.statusCode = 403;
    (familyService.getChildTimeline as jest.Mock).mockRejectedValue(forbiddenError);

    const { findByTestId, findByText, queryByTestId } = await renderWithTheme(
      <FamilyTimelineHubScreen user={parentUser} />
    );

    // Verify revoked guardian banner is rendered
    expect(await findByTestId('revoked-guardian-banner')).toBeTruthy();
    expect(await findByTestId('revoked-guardian-message')).toBeTruthy();
    expect(await findByText('Access Restricted (HTTP 403)')).toBeTruthy();

    // Ensure private student timeline data is NOT displayed
    expect(queryByTestId('student-timeline-section')).toBeNull();
  });

  // ACCEPTANCE CRITERIA 4: long_multilingual_child_names_readable
  it('long_multilingual_child_names_readable: renders long, multi-byte Unicode names across Malay, Chinese, Tamil, and Jawi without truncation', async () => {
    const multilingualChildren = [
      {
        id: 'stu_malay_01',
        full_name: 'Nur Farhana Binti Ahmad Iskandar Shah Al-Haj',
        ic_number: '140101-14-1111',
        belt_rank: 'Kuning (Yellow)',
        monthly_fee: 120,
        billing_status: 'CURRENT',
        status: 'ACTIVE',
        organization_id: 'org_01',
        organization_name: 'Silat Academy',
      },
      {
        id: 'stu_chinese_02',
        full_name: '黄俊杰 (Wong Jun Jie — Brandon)',
        ic_number: '150202-10-2222',
        belt_rank: 'Hijau (Green)',
        monthly_fee: 120,
        billing_status: 'CURRENT',
        status: 'ACTIVE',
        organization_id: 'org_01',
        organization_name: 'Silat Academy',
      },
      {
        id: 'stu_tamil_03',
        full_name: 'முருகன் ராமசாமி (Murugan Ramasamy)',
        ic_number: '160303-08-3333',
        belt_rank: 'Biru (Blue)',
        monthly_fee: 120,
        billing_status: 'CURRENT',
        status: 'ACTIVE',
        organization_id: 'org_01',
        organization_name: 'Silat Academy',
      },
      {
        id: 'stu_jawi_04',
        full_name: 'محمد بن عبد الله (Muhammad bin Abdullah)',
        ic_number: '170404-03-4444',
        belt_rank: 'Merah (Red)',
        monthly_fee: 120,
        billing_status: 'CURRENT',
        status: 'ACTIVE',
        organization_id: 'org_01',
        organization_name: 'Silat Academy',
      },
    ];

    (familyService.getChildren as jest.Mock).mockResolvedValue(multilingualChildren);
    (familyService.getChildTimeline as jest.Mock).mockResolvedValue({
      student: {
        id: 'stu_malay_01',
        fullName: 'Nur Farhana Binti Ahmad Iskandar Shah Al-Haj',
        icNumber: '140101-14-1111',
        beltRank: 'Kuning (Yellow)',
        monthlyFee: 120,
        billingStatus: 'CURRENT',
        status: 'ACTIVE',
        registeredAt: '2025-01-15',
        organizationId: 'org_01',
        organizationName: 'Silat Academy',
      },
      attendance: [],
      rankHistory: [],
      upcomingSessions: [],
      financialPartitions: [],
    });

    const { findByText, findByTestId, getAllByText } = await renderWithTheme(<FamilyTimelineHubScreen user={parentUser} />);

    // Verify all long multilingual names are preserved cleanly in the UI
    expect(await findByTestId('child-name-text-stu_malay_01')).toBeTruthy();
    expect(getAllByText('Nur Farhana Binti Ahmad Iskandar Shah Al-Haj').length).toBeGreaterThanOrEqual(1);
    expect(await findByText('黄俊杰 (Wong Jun Jie — Brandon)')).toBeTruthy();
    expect(await findByText('முருகன் ராமசாமி (Murugan Ramasamy)')).toBeTruthy();
    expect(await findByText('محمد بن عبد الله (Muhammad bin Abdullah)')).toBeTruthy();
  }, 15000);

  // ACCEPTANCE CRITERIA 5: family_totals_correct_per_merchant
  it('family_totals_correct_per_merchant: segregates and partitions dues and balances strictly per merchant entity', async () => {
    (familyService.getChildren as jest.Mock).mockResolvedValue([
      {
        id: 'stu_multi_org_01',
        full_name: 'Danial Harith',
        ic_number: '130808-10-9999',
        belt_rank: 'Coklat (Brown)',
        monthly_fee: 150,
        billing_status: 'CURRENT',
        status: 'ACTIVE',
        organization_id: 'org_silat_01',
        organization_name: 'Gayong Silat Malaysia',
      },
    ]);

    (familyService.getChildTimeline as jest.Mock).mockResolvedValue({
      student: {
        id: 'stu_multi_org_01',
        fullName: 'Danial Harith',
        icNumber: '130808-10-9999',
        beltRank: 'Coklat (Brown)',
        monthlyFee: 150,
        billingStatus: 'CURRENT',
        status: 'ACTIVE',
        registeredAt: '2024-03-01',
        organizationId: 'org_silat_01',
        organizationName: 'Gayong Silat Malaysia',
      },
      attendance: [],
      rankHistory: [],
      upcomingSessions: [],
      financialPartitions: [
        {
          organizationId: 'org_gayong_silat',
          merchantName: 'Persatuan Silat Gayong Kebangsaan',
          currency: 'MYR',
          totalFeeAmount: 200,
          totalAmountPaid: 200,
          totalOutstandingAmount: 0,
          dues: [
            {
              id: 'due_g1',
              billingMonth: '2026-09',
              feeAmount: 100,
              amountPaid: 100,
              status: 'PAID',
            },
            {
              id: 'due_g2',
              billingMonth: '2026-10',
              feeAmount: 100,
              amountPaid: 100,
              status: 'PAID',
            },
          ],
        },
        {
          organizationId: 'org_taekwondo_selangor',
          merchantName: 'Persatuan Taekwondo Selangor',
          currency: 'MYR',
          totalFeeAmount: 350,
          totalAmountPaid: 150,
          totalOutstandingAmount: 200,
          dues: [
            {
              id: 'due_t1',
              billingMonth: '2026-10',
              feeAmount: 350,
              amountPaid: 150,
              status: 'PARTIAL',
            },
          ],
        },
      ],
    });

    const { getByTestId, findByText, findByTestId } = await renderWithTheme(
      <FamilyTimelineHubScreen user={parentUser} />
    );

    // Switch to Finances tab
    const financeTab = await findByTestId('tab-merchant-finances');
    fireEvent.press(financeTab);

    // Verify Merchant 1 Partition (Gayong)
    expect(await findByTestId('merchant-partition-card-org_gayong_silat')).toBeTruthy();
    expect(getByTestId('merchant-name-org_gayong_silat')).toBeTruthy();
    expect(getByTestId('merchant-billed-org_gayong_silat').props.children).toEqual(['MYR', ' ', '200.00']);
    expect(getByTestId('merchant-paid-org_gayong_silat').props.children).toEqual(['MYR', ' ', '200.00']);
    expect(getByTestId('merchant-outstanding-org_gayong_silat').props.children).toEqual(['MYR', ' ', '0.00']);

    // Verify Merchant 2 Partition (Taekwondo)
    expect(await findByTestId('merchant-partition-card-org_taekwondo_selangor')).toBeTruthy();
    expect(getByTestId('merchant-name-org_taekwondo_selangor')).toBeTruthy();
    expect(getByTestId('merchant-billed-org_taekwondo_selangor').props.children).toEqual(['MYR', ' ', '350.00']);
    expect(getByTestId('merchant-paid-org_taekwondo_selangor').props.children).toEqual(['MYR', ' ', '150.00']);
    expect(getByTestId('merchant-outstanding-org_taekwondo_selangor').props.children).toEqual(['MYR', ' ', '200.00']);

    // Confirm that totals are segregated per merchant card and NOT merged together
    expect(await findByText('Persatuan Silat Gayong Kebangsaan')).toBeTruthy();
    expect(await findByText('Persatuan Taekwondo Selangor')).toBeTruthy();
  });
});
