import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { StitchTokens } from '../theme/tokens';
import {
  StitchAppHeader,
  LiveSessionCard,
  AtRiskAttendanceAlert,
  TraineeAttendanceRow,
  DigitalCertificateCard,
  TechniqueChecklistCard,
  SiblingDiscountBanner,
  StitchStatCard,
  StitchBottomNav,
  RoleViewSelector,
} from '../components/stitch';

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="light">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('Google Stitch UI/UX Approved Design System Integration', () => {
  // --------------------------------------------------------------------------
  // 1. Design Tokens Verification
  // --------------------------------------------------------------------------
  it('1. Design Tokens: validates exact Google Stitch color, typography & touch area tokens', () => {
    // Brand Navy & Surfaces
    expect(StitchTokens.colors.brandNavy).toBe('#0D2B47');
    expect(StitchTokens.colors.brandNavyLight).toBe('#123A5E');
    expect(StitchTokens.colors.brandNavyTint).toBe('#EAF1F7');
    expect(StitchTokens.colors.brandNavySurface).toBe('#091E32');

    // Amber Accent
    expect(StitchTokens.colors.colorAccent).toBe('#F2941C');
    expect(StitchTokens.colors.colorAccentSoft).toBe('#FFF7ED');
    expect(StitchTokens.colors.colorAccentBorder).toBe('#FED7AA');

    // Semantic Greens & Reds
    expect(StitchTokens.colors.bfGreen).toBe('#10B981');
    expect(StitchTokens.colors.bfGreenSoft).toBe('#DCFCE7');
    expect(StitchTokens.colors.bfGreenDark).toBe('#15803D');

    expect(StitchTokens.colors.bfRed).toBe('#EF4444');
    expect(StitchTokens.colors.bfRedSoft).toBe('#FFF1F2');
    expect(StitchTokens.colors.bfRedBorder).toBe('#FECDD3');
    expect(StitchTokens.colors.bfRedDark).toBe('#9F1239');

    // Space Grotesk Typography & Minimum Touch Target
    expect(StitchTokens.typography.fontFamily).toContain('Space Grotesk');
    expect(StitchTokens.a11y.minTouchTarget).toBeGreaterThanOrEqual(44);
  });

  // --------------------------------------------------------------------------
  // 2. StitchAppHeader
  // --------------------------------------------------------------------------
  it('2. StitchAppHeader: renders Top App Bar with brand logo, Dojang chip and notifications', async () => {
    const handleNotification = jest.fn();
    const { getByTestId, getByText } = await renderWithTheme(
      <StitchAppHeader
        dojangName="CENTRAL DOJANG"
        roleBadgeText="COACH"
        hasUnreadNotifications={true}
        onNotificationPress={handleNotification}
      />
    );

    expect(getByTestId('stitch-app-header')).toBeTruthy();
    expect(getByText('BELTFLOW')).toBeTruthy();
    expect(getByTestId('header-dojang-chip')).toBeTruthy();
    expect(getByText('CENTRAL DOJANG')).toBeTruthy();
    expect(getByTestId('header-role-chip')).toBeTruthy();
    expect(getByText('COACH')).toBeTruthy();
    expect(getByTestId('bell-unread-dot')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('header-bell-btn'));
    });
    expect(handleNotification).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 3. LiveSessionCard (Active Mat Session)
  // --------------------------------------------------------------------------
  it('3. LiveSessionCard: renders active mat session with 1-tap roster check action', async () => {
    const handleRosterCheck = jest.fn();
    const handleManage = jest.fn();

    const { getByTestId, getByText } = await renderWithTheme(
      <LiveSessionCard
        categoryLabel="ACTIVE MAT SESSION"
        className="Sparring & Poomsae"
        scheduleTime="Mon 6:00 PM"
        enrolledCount={18}
        capacity={20}
        onRosterCheckPress={handleRosterCheck}
        onManagePress={handleManage}
      />
    );

    expect(getByTestId('live-session-card')).toBeTruthy();
    expect(getByText('ACTIVE MAT SESSION')).toBeTruthy();
    expect(getByText('Sparring & Poomsae')).toBeTruthy();
    expect(getByText('Mon 6:00 PM')).toBeTruthy();
    expect(getByText('18 / 20 Enrolled')).toBeTruthy();

    const rosterBtn = getByTestId('btn-roster-check');
    await act(async () => {
      fireEvent.press(rosterBtn);
    });
    expect(handleRosterCheck).toHaveBeenCalledTimes(1);

    const manageBtn = getByTestId('btn-session-manage');
    await act(async () => {
      fireEvent.press(manageBtn);
    });
    expect(handleManage).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 4. AtRiskAttendanceAlert (3+ Absences with WhatsApp CTA)
  // --------------------------------------------------------------------------
  it('4. AtRiskAttendanceAlert: displays at-risk students with direct WhatsApp ping CTA', async () => {
    const mockAtRiskStudents = [
      { id: 'stu_risk_1', name: 'Wei Ling Tan', missedCount: 3, parentPhone: '+60129876543' },
      { id: 'stu_risk_2', name: 'Amirul Hakimi', missedCount: 4, parentPhone: '+60198765432' },
    ];
    const handlePing = jest.fn();

    const { getByTestId, getByText } = await renderWithTheme(
      <AtRiskAttendanceAlert students={mockAtRiskStudents} onPingParent={handlePing} />
    );

    expect(getByTestId('at-risk-attendance-alert')).toBeTruthy();
    expect(getByText('2 At-Risk Students (3+ missed)')).toBeTruthy();
    expect(getByText('Wei Ling Tan')).toBeTruthy();
    expect(getByText('3 classes absent')).toBeTruthy();
    expect(getByText('Amirul Hakimi')).toBeTruthy();
    expect(getByText('4 classes absent')).toBeTruthy();

    const pingBtn = getByTestId('btn-ping-parent-stu_risk_1');
    await act(async () => {
      fireEvent.press(pingBtn);
    });
    expect(handlePing).toHaveBeenCalledWith(mockAtRiskStudents[0]);
  });

  // --------------------------------------------------------------------------
  // 5. TraineeAttendanceRow (Today's Mat Attendance)
  // --------------------------------------------------------------------------
  it('5. TraineeAttendanceRow: renders initials avatar, belt badge, and quick Present/Late buttons', async () => {
    const handlePresent = jest.fn();
    const handleLate = jest.fn();
    const handleAbsent = jest.fn();

    const { getByTestId, getByText } = await renderWithTheme(
      <TraineeAttendanceRow
        studentId="stu_001"
        name="Aryan Suresh"
        initials="AS"
        beltRank="Green Belt (4th Gup)"
        currentStatus="PRESENT"
        onMarkPresent={handlePresent}
        onMarkLate={handleLate}
        onMarkAbsent={handleAbsent}
      />
    );

    expect(getByTestId('trainee-row-stu_001')).toBeTruthy();
    expect(getByText('AS')).toBeTruthy();
    expect(getByText('Aryan Suresh')).toBeTruthy();
    expect(getByText('Green Belt (4th Gup)')).toBeTruthy();

    const presentBtn = getByTestId('btn-present-stu_001');
    const lateBtn = getByTestId('btn-late-stu_001');
    const absentBtn = getByTestId('btn-absent-stu_001');

    await act(async () => {
      fireEvent.press(presentBtn);
    });
    expect(handlePresent).toHaveBeenCalledWith('stu_001');

    await act(async () => {
      fireEvent.press(lateBtn);
    });
    expect(handleLate).toHaveBeenCalledWith('stu_001');

    await act(async () => {
      fireEvent.press(absentBtn);
    });
    expect(handleAbsent).toHaveBeenCalledWith('stu_001');
  });

  // --------------------------------------------------------------------------
  // 6. DigitalCertificateCard (QR Verified Credential)
  // --------------------------------------------------------------------------
  it('6. DigitalCertificateCard: renders 2px amber border card with QR verified badge and download CTA', async () => {
    const handleDownload = jest.fn();
    const handleViewQr = jest.fn();

    const { getByTestId, getByText } = await renderWithTheme(
      <DigitalCertificateCard
        title="Promotion to Green Belt"
        issuedDate="Aug 14, 2026"
        certificateNumber="BF-GREEN-9821"
        isVerified={true}
        onDownloadPress={handleDownload}
        onViewQrPress={handleViewQr}
      />
    );

    expect(getByTestId('digital-certificate-card')).toBeTruthy();
    expect(getByText('Digital Certificate')).toBeTruthy();
    expect(getByTestId('qr-verified-badge')).toBeTruthy();
    expect(getByText('QR VERIFIED')).toBeTruthy();
    expect(getByText('Promotion to Green Belt')).toBeTruthy();
    expect(getByText('Issued Aug 14, 2026 · BF-GREEN-9821')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('btn-download-cert'));
    });
    expect(handleDownload).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(getByTestId('btn-view-cert-qr'));
    });
    expect(handleViewQr).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 7. TechniqueChecklistCard (Syllabus Readiness)
  // --------------------------------------------------------------------------
  it('7. TechniqueChecklistCard: displays syllabus checklist with readiness fraction and icons', async () => {
    const mockTechniques = [
      { id: 'tech_1', name: 'Taegeuk Sam Jang', isCompleted: true },
      { id: 'tech_2', name: 'Turning Kick Combos', isCompleted: true },
      { id: 'tech_3', name: 'One-Step Sparring', isCompleted: true },
      { id: 'tech_4', name: 'Board Breaking (Kyokpa)', isCompleted: false },
    ];

    const { getByTestId, getByText } = await renderWithTheme(
      <TechniqueChecklistCard
        syllabusTitle="Blue Belt Syllabus"
        techniques={mockTechniques}
      />
    );

    expect(getByTestId('technique-checklist-card')).toBeTruthy();
    expect(getByText('Blue Belt Syllabus')).toBeTruthy();
    expect(getByText('3/4 Ready')).toBeTruthy();
    expect(getByText('Taegeuk Sam Jang')).toBeTruthy();
    expect(getByText('Board Breaking (Kyokpa)')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 8. SiblingDiscountBanner
  // --------------------------------------------------------------------------
  it('8. SiblingDiscountBanner: displays automated sibling discount amount and details', async () => {
    const { getByTestId, getByText } = await renderWithTheme(
      <SiblingDiscountBanner
        siblingDetails="Enrolled with brother (Dev Suresh)"
        discountAmountText="-RM 18/mo"
      />
    );

    expect(getByTestId('sibling-discount-banner')).toBeTruthy();
    expect(getByText('10% Sibling Discount Applied')).toBeTruthy();
    expect(getByText('Enrolled with brother (Dev Suresh)')).toBeTruthy();
    expect(getByText('-RM 18/mo')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 9. StitchStatCard
  // --------------------------------------------------------------------------
  it('9. StitchStatCard: displays uppercase category label, bold KPI number and trend', async () => {
    const { getByTestId, getByText } = await renderWithTheme(
      <StitchStatCard
        label="Active Persatuans"
        value={14}
        trendText="+2 onboarded this month"
        isPositiveTrend={true}
        hasAccentBorder={true}
      />
    );

    expect(getByTestId('stitch-stat-card')).toBeTruthy();
    expect(getByText('Active Persatuans')).toBeTruthy();
    expect(getByText('14')).toBeTruthy();
    expect(getByText('+2 onboarded this month')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 10. StitchBottomNav & RoleViewSelector
  // --------------------------------------------------------------------------
  it('10. StitchBottomNav & RoleViewSelector: verifies bottom tabs navigation and active role selector', async () => {
    const handleTabChange = jest.fn();
    const { getByTestId, getByText } = await renderWithTheme(
      <StitchBottomNav activeTab="today" onTabChange={handleTabChange} />
    );

    expect(getByTestId('stitch-bottom-nav')).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Students')).toBeTruthy();
    expect(getByText('Grading')).toBeTruthy();
    expect(getByText('Fees')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('tab-students'));
    });
    expect(handleTabChange).toHaveBeenCalledWith('students');

    // Role View Selector test
    const handleSelectRole = jest.fn();
    const { getByTestId: getByTestIdRole } = await renderWithTheme(
      <RoleViewSelector
        roles={[
          { key: 'coach', label: 'Coach on Mat', icon: '🥋' },
          { key: 'student', label: 'Student & Parent', icon: '👤' },
        ]}
        activeRoleKey="coach"
        onSelectRole={handleSelectRole}
      />
    );

    expect(getByTestIdRole('role-view-selector')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestIdRole('btn-role-select-student'));
    });
    expect(handleSelectRole).toHaveBeenCalledWith('student');
  });
});
