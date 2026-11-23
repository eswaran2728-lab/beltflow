/**
 * Privacy and my data on the phone (Malaysia PDPA), 2026-11-15.
 *
 *  - Reached from every role's Profile screen.
 *  - "Share my data" fetches the person's own data from the server and hands
 *    it to the phone's share sheet (save to Files, send by e-mail).
 *  - Requests for deletion, correction or withdrawal of consent are sent to
 *    the server; deletion asks for confirmation first.
 *  - A guardian can include one of their own children.
 *  - The person's own requests are listed with their status.
 *  - Every string exists in English, Bahasa Malaysia and Tamil.
 * Synthetic data only.
 */
import React from 'react';
import { Alert, Share, Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider, DICTIONARIES, LOCALES } from '../i18n';
import { apiClient } from '../services/apiClient';
import { PrivacyDataSheet } from '../components/PrivacyDataSheet';
import { privacyEn } from '../i18n/locales/modules/privacy';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  onUnauthorizedResponse: jest.fn(),
}));

const MY_DATA = {
  generatedAt: '2026-11-15T00:00:00.000Z',
  account: { id: 'usr_test_parent', fullName: 'Test Parent', email: 'test.parent@example.test', role: 'PARENT' },
  consents: [{ type: 'PRIVACY_NOTICE', documentVersion: '2026-11-15', acceptedAt: '2026-11-15T00:00:00.000Z' }],
  children: [{ id: 'stu_test_child', fullName: 'Test Child', beltRank: 'White Belt' }],
  paymentsSubmitted: [],
  dataRequests: [],
};
const REQUEST = { id: 'dr_1', type: 'CORRECT', status: 'OPEN', details: 'Fix the spelling', createdAt: '2026-11-15T00:00:00.000Z', dueAt: '2026-12-06T00:00:00.000Z' };

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

function mockServer(requests: any[] = []) {
  get.mockImplementation(async (path: string) => {
    if (path === '/privacy/my-data') return MY_DATA;
    if (path === '/privacy/requests/mine') return { requests };
    throw new Error('unexpected GET ' + path);
  });
}

const renderSheet = (onClose = jest.fn()) =>
  render(
    <ThemeProvider defaultMode="light">
      <I18nProvider>
        <PrivacyDataSheet visible onClose={onClose} />
      </I18nProvider>
    </ThemeProvider>
  );

describe('Privacy and my data (mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('every privacy string exists in all three languages, with Tamil in Tamil script', () => {
    for (const locale of LOCALES) {
      const dict = DICTIONARIES[locale] as Record<string, string>;
      for (const key of Object.keys(privacyEn)) {
        expect({ locale, key, ok: typeof dict[key] === 'string' && dict[key].length > 0 }).toEqual({ locale, key, ok: true });
      }
    }
    const ta = DICTIONARIES.ta as Record<string, string>;
    for (const key of Object.keys(privacyEn)) {
      expect({ key, tamil: /[஀-௿]/.test(ta[key]) }).toEqual({ key, tamil: true });
    }
  });

  test('shows my requests and offers my own child', async () => {
    mockServer([REQUEST]);
    const { findByText, getByTestId } = await renderSheet();
    expect(await findByText('Fix the spelling')).toBeTruthy();
    expect(getByTestId('privacy-request-status-dr_1')).toBeTruthy();
    expect(await findByText('Test Child')).toBeTruthy();
  });

  test('share my data hands my own data to the share sheet', async () => {
    mockServer();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const { getByTestId } = await renderSheet();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/privacy/my-data'));
    await act(async () => {
      await fireEvent.press(getByTestId('btn-privacy-share-data'));
    });
    expect(share).toHaveBeenCalledTimes(1);
    const message = share.mock.calls[0][0] as { message: string };
    expect(JSON.parse(message.message).account.email).toBe('test.parent@example.test');
  });

  test('a correction request is sent with its details', async () => {
    mockServer();
    post.mockResolvedValue({ request: { ...REQUEST, id: 'dr_2' } });
    const { getByTestId } = await renderSheet();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/privacy/requests/mine'));
    await fireEvent.press(getByTestId('privacy-type-CORRECT'));
    await fireEvent.changeText(getByTestId('input-privacy-details'), 'My name is spelt wrongly');
    await act(async () => {
      await fireEvent.press(getByTestId('btn-privacy-send'));
    });
    expect(post).toHaveBeenCalledWith('/privacy/requests', { type: 'CORRECT', details: 'My name is spelt wrongly' });
  });

  test('a deletion request asks for confirmation and can include my child', async () => {
    mockServer();
    post.mockResolvedValue({ request: { ...REQUEST, id: 'dr_3', type: 'DELETE' } });
    const alert = jest.spyOn(Alert, 'alert');
    const { getByTestId, findByText } = await renderSheet();
    await findByText('Test Child');
    await fireEvent.press(getByTestId('privacy-type-DELETE'));
    await fireEvent.press(getByTestId('privacy-child-stu_test_child'));
    await act(async () => {
      await fireEvent.press(getByTestId('btn-privacy-send'));
    });
    // Nothing is sent until the person confirms.
    expect(post).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[alert.mock.calls.length - 1][2] as { style?: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find(b => b.style === 'destructive')!.onPress!();
    });
    expect(post).toHaveBeenCalledWith('/privacy/requests', { type: 'DELETE', studentId: 'stu_test_child' });
  });

  test('the privacy notice opens from the sheet', async () => {
    mockServer();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const { getByTestId } = await renderSheet();
    await fireEvent.press(getByTestId('link-privacy-notice'));
    expect(open.mock.calls[0][0]).toMatch(/\/legal\/privacy\.html$/);
  });
});
