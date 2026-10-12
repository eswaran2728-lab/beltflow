import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { BeltLevelConfig } from '../theme/belts';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input, PasswordInput, SearchInput } from '../components/Input';
import { StatusBadge, BeltBadge, SyncStatusBadge } from '../components/Badges';
import { StatCard } from '../components/StatCard';
import { LoadingState, EmptyState, ErrorState, OfflineBanner, ConfirmationDialog } from '../components/Feedback';
import { ScreenContainer, SectionHeader, ScreenHeader } from '../components/Layout';

// Mock safe area insets for testing
const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement, persatuanBelts?: readonly BeltLevelConfig[]) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider persatuanBelts={persatuanBelts}>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('BeltFlow Reusable Mobile Components — Task 1.3', () => {
  describe('1. Button Component', () => {
    test('renders label and fires onPress when enabled', async () => {
      const onPressMock = jest.fn();
      const { getByTestId, getByText } = await renderWithTheme(
        <Button label="Submit Attendance" onPress={onPressMock} testID="btn-submit" />
      );

      const btn = getByTestId('btn-submit');
      expect(getByText('Submit Attendance')).toBeTruthy();

      fireEvent.press(btn);
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    test('supports primary, secondary, outline, and danger variants', async () => {
      const { getByTestId } = await renderWithTheme(
        <>
          <Button label="Primary" variant="primary" testID="btn-primary" />
          <Button label="Secondary" variant="secondary" testID="btn-secondary" />
          <Button label="Outline" variant="outline" testID="btn-outline" />
          <Button label="Danger" variant="danger" testID="btn-danger" />
        </>
      );

      expect(getByTestId('btn-primary')).toBeTruthy();
      expect(getByTestId('btn-secondary')).toBeTruthy();
      expect(getByTestId('btn-outline')).toBeTruthy();
      expect(getByTestId('btn-danger')).toBeTruthy();
    });

    test('disabled button does not trigger onPress and has accessibilityState', async () => {
      const onPressMock = jest.fn();
      const { getByTestId } = await renderWithTheme(
        <Button label="Disabled" disabled onPress={onPressMock} testID="btn-disabled" />
      );

      const btn = getByTestId('btn-disabled');
      fireEvent.press(btn);
      expect(onPressMock).not.toHaveBeenCalled();
      expect(btn.props.accessibilityState.disabled).toBe(true);
    });

    test('loading button renders indicator and prevents interaction', async () => {
      const onPressMock = jest.fn();
      const { getByTestId } = await renderWithTheme(
        <Button label="Saving" loading onPress={onPressMock} testID="btn-loading" />
      );

      const btn = getByTestId('btn-loading');
      fireEvent.press(btn);
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe('2. Card Component', () => {
    test('renders content and supports standard, elevated, and interactive variants', async () => {
      const onCardPress = jest.fn();
      const { getByTestId } = await renderWithTheme(
        <>
          <Card variant="standard" testID="card-standard"><Text>Card 1</Text></Card>
          <Card variant="elevated" testID="card-elevated"><Text>Card 2</Text></Card>
          <Card variant="interactive" onPress={onCardPress} testID="card-interactive"><Text>Card 3</Text></Card>
        </>
      );

      expect(getByTestId('card-standard')).toBeTruthy();
      expect(getByTestId('card-elevated')).toBeTruthy();

      const interactiveCard = getByTestId('card-interactive');
      fireEvent.press(interactiveCard);
      expect(onCardPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Input Components', () => {
    test('TextInput renders label, placeholder, and propagates text changes', async () => {
      const onChangeMock = jest.fn();
      const { getByText, getByTestId } = await renderWithTheme(
        <Input
          label="Student Full Name"
          placeholder="Enter student name"
          value=""
          onChangeText={onChangeMock}
          testID="input-name"
        />
      );

      expect(getByText('Student Full Name')).toBeTruthy();
      const input = getByTestId('input-name');
      fireEvent.changeText(input, 'Tharun Suresh');
      expect(onChangeMock).toHaveBeenCalledWith('Tharun Suresh');
    });

    test('displays validation error and helper text', async () => {
      const { getByText } = await renderWithTheme(
        <Input
          label="Email"
          value="invalid-email"
          errorText="Please enter a valid email address"
          helperText="We send official receipts here"
        />
      );

      expect(getByText('Please enter a valid email address')).toBeTruthy();
      expect(getByText('We send official receipts here')).toBeTruthy();
    });

    test('PasswordInput renders toggle button and toggles secureTextEntry', async () => {
      const { getByTestId, findByTestId } = await renderWithTheme(
        <PasswordInput
          label="Password"
          value="secret123"
          testID="input-password"
        />
      );

      const input = getByTestId('input-password');
      expect(input.props.secureTextEntry).toBe(true);

      const toggleBtn = getByTestId('input-password-toggle');
      fireEvent.press(toggleBtn);

      const updatedInput = await findByTestId('input-password');
      expect(updatedInput.props.secureTextEntry).toBe(false);
    });

    test('SearchInput renders search field and handles clear action', async () => {
      const onClearMock = jest.fn();
      const { getByTestId } = await renderWithTheme(
        <SearchInput
          placeholder="Search students..."
          value="Kavitha"
          onClear={onClearMock}
          testID="search-input"
        />
      );

      expect(getByTestId('search-input')).toBeTruthy();
      const clearBtn = getByTestId('search-clear-btn');
      fireEvent.press(clearBtn);
      expect(onClearMock).toHaveBeenCalled();
    });
  });

  describe('4. Badges (StatusBadge, BeltBadge, SyncStatusBadge)', () => {
    test('StatusBadge displays semantic labels and variant styles', async () => {
      const { getByText } = await renderWithTheme(
        <>
          <StatusBadge status="ACTIVE" label="Active" testID="badge-active" />
          <StatusBadge status="PENDING" label="Pending Approval" testID="badge-pending" />
          <StatusBadge status="OVERDUE" label="Overdue" testID="badge-overdue" />
        </>
      );

      expect(getByText('Active')).toBeTruthy();
      expect(getByText('Pending Approval')).toBeTruthy();
      expect(getByText('Overdue')).toBeTruthy();
    });

    test('BeltBadge uses active Persatuan custom belt configuration (CRITICAL REQUIREMENT)', async () => {
      const customPersatuanBelts: BeltLevelConfig[] = [
        { id: 'sil_w', name: 'Vellai (White)', order: 1, colorHex: '#FFFFFF' },
        { id: 'sil_y', name: 'Manjal (Yellow)', order: 2, colorHex: '#FACC15' },
        { id: 'sil_g', name: 'Pachai (Green)', order: 3, colorHex: '#22C55E' },
        { id: 'sil_dan1', name: 'Asan Dan 1', order: 4, colorHex: '#0F172A', isDanRank: true, danLevel: 1 },
      ];

      const { getByText } = await renderWithTheme(
        <>
          <BeltBadge beltName="Manjal (Yellow)" testID="badge-yellow" />
          <BeltBadge beltName="Asan Dan 1" testID="badge-dan" showDanBadge />
          <BeltBadge beltName="Legacy Red Belt 2022" testID="badge-historical" />
        </>,
        customPersatuanBelts
      );

      // 1. Custom rank display
      expect(getByText('Manjal (Yellow)')).toBeTruthy();

      // 2. Dan rank indicator
      expect(getByText('Asan Dan 1')).toBeTruthy();
      expect(getByText('DAN 1')).toBeTruthy();

      // 3. Historical rank label preserved
      expect(getByText('Legacy Red Belt 2022')).toBeTruthy();
    });

    test('SyncStatusBadge displays synchronization states', async () => {
      const { getByText } = await renderWithTheme(
        <>
          <SyncStatusBadge status="synced" testID="sync-synced" />
          <SyncStatusBadge status="pending" testID="sync-pending" />
          <SyncStatusBadge status="offline" testID="sync-offline" />
        </>
      );

      expect(getByText('Synced')).toBeTruthy();
      expect(getByText('Pending Sync')).toBeTruthy();
      expect(getByText('Offline')).toBeTruthy();
    });
  });

  describe('5. StatCard Component', () => {
    test('renders KPI title, formatted value, and subtitle', async () => {
      const { getByText } = await renderWithTheme(
        <StatCard
          title="Active Students"
          value="142"
          subtitle="+8 this month"
          testID="stat-students"
        />
      );

      expect(getByText('Active Students')).toBeTruthy();
      expect(getByText('142')).toBeTruthy();
      expect(getByText('+8 this month')).toBeTruthy();
    });

    test('renders loading state when loading is true', async () => {
      const { getByTestId } = await renderWithTheme(
        <StatCard
          title="Monthly Dues"
          value="RM 12,400"
          loading
          testID="stat-loading"
        />
      );

      expect(getByTestId('stat-loading-loading')).toBeTruthy();
    });
  });

  describe('6. Feedback Components', () => {
    test('LoadingState displays indicator and message', async () => {
      const { getByText } = await renderWithTheme(
        <LoadingState message="Loading academy roster..." testID="feedback-loading" />
      );
      expect(getByText('Loading academy roster...')).toBeTruthy();
    });

    test('EmptyState renders title, description, and action button', async () => {
      const onAction = jest.fn();
      const { getByText } = await renderWithTheme(
        <EmptyState
          title="No Sessions Today"
          description="Schedule a new training session to start marking attendance."
          actionLabel="Create Session"
          onAction={onAction}
          testID="feedback-empty"
        />
      );

      expect(getByText('No Sessions Today')).toBeTruthy();
      expect(getByText('Schedule a new training session to start marking attendance.')).toBeTruthy();

      const btn = getByText('Create Session');
      fireEvent.press(btn);
      expect(onAction).toHaveBeenCalled();
    });

    test('ErrorState renders error title, message, and retry button', async () => {
      const onRetry = jest.fn();
      const { getByText } = await renderWithTheme(
        <ErrorState
          title="Connection Error"
          message="Unable to reach the academy backend service."
          onRetry={onRetry}
          testID="feedback-error"
        />
      );

      expect(getByText('Connection Error')).toBeTruthy();
      expect(getByText('Unable to reach the academy backend service.')).toBeTruthy();

      const retryBtn = getByText('Try Again');
      fireEvent.press(retryBtn);
      expect(onRetry).toHaveBeenCalled();
    });

    test('OfflineBanner renders offline notice', async () => {
      const { getByText } = await renderWithTheme(
        <OfflineBanner message="Offline Mode — Mat records saved locally" testID="offline-banner" />
      );
      expect(getByText('Offline Mode — Mat records saved locally')).toBeTruthy();
    });

    test('ConfirmationDialog renders modal with confirm and cancel buttons', async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      const { getByText } = await renderWithTheme(
        <ConfirmationDialog
          visible={true}
          title="Confirm Belt Promotion"
          message="Are you sure you want to promote Aryan Suresh to Green Belt?"
          confirmLabel="Promote"
          cancelLabel="Cancel"
          onConfirm={onConfirm}
          onCancel={onCancel}
          testID="confirm-dialog"
        />
      );

      expect(getByText('Confirm Belt Promotion')).toBeTruthy();
      expect(getByText('Are you sure you want to promote Aryan Suresh to Green Belt?')).toBeTruthy();

      fireEvent.press(getByText('Promote'));
      expect(onConfirm).toHaveBeenCalled();
    });

    test('ConfirmationDialog cancel button triggers onCancel', async () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      const { getByText } = await renderWithTheme(
        <ConfirmationDialog
          visible={true}
          title="Cancel Action"
          message="Discard changes?"
          confirmLabel="Discard"
          cancelLabel="Keep"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      fireEvent.press(getByText('Keep'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('7. Layout Components', () => {
    test('ScreenContainer renders children with safe area handling', async () => {
      const { getByTestId, getByText } = await renderWithTheme(
        <ScreenContainer testID="screen-container">
          <SectionHeader title="Today's Sessions" subtitle="3 classes scheduled" actionLabel="View All" />
        </ScreenContainer>
      );

      expect(getByTestId('screen-container')).toBeTruthy();
      expect(getByText("Today's Sessions")).toBeTruthy();
      expect(getByText('3 classes scheduled')).toBeTruthy();
      expect(getByText('View All')).toBeTruthy();
    });

    test('ScreenHeader renders title and fires onBack', async () => {
      const onBack = jest.fn();
      const { getByText, getByTestId } = await renderWithTheme(
        <ScreenHeader title="Student Details" onBack={onBack} testID="screen-header" />
      );

      expect(getByText('Student Details')).toBeTruthy();
      const backBtn = getByTestId('header-back-btn');
      fireEvent.press(backBtn);
      expect(onBack).toHaveBeenCalled();
    });
  });
});
