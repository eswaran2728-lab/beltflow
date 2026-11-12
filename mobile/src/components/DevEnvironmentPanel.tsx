import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Server, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { getApiBaseUrl, setApiBaseUrl } from '../config/env';
import { setStoredApiBaseUrl } from '../services/storage';
import { useI18n } from '../i18n';

export interface DevEnvironmentPanelProps {
  onSelectTestAccount?: (email: string, pass: string) => void;
}

export const DevEnvironmentPanel: React.FC<DevEnvironmentPanelProps> = ({
  onSelectTestAccount,
}) => {
  const { colors, typography, spacing, iconSize, borderRadius } = useTheme();
  const { t } = useI18n();

  const [expanded, setExpanded] = useState(false);
  const [apiUrl, setApiUrlState] = useState(() => getApiBaseUrl());
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleTestConnection = async () => {
    setTestingStatus('testing');
    setStatusMessage(t('components.devPanel.pinging'));
    try {
      const cleanUrl = apiUrl.trim().replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${cleanUrl}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setTestingStatus('success');
        setStatusMessage(t('components.devPanel.connected', { service: data.service || 'BeltFlow API' }));
        setApiBaseUrl(cleanUrl);
        await setStoredApiBaseUrl(cleanUrl);
      } else {
        setTestingStatus('failed');
        setStatusMessage(t('components.devPanel.httpError', { status: res.status }));
      }
    } catch (err: any) {
      setTestingStatus('failed');
      setStatusMessage(err?.name === 'AbortError' ? t('components.devPanel.timeout') : t('components.devPanel.unreachable'));
    }
  };

  const testAccounts = [
    { label: 'Super Admin', email: 'superadmin@beltflow.test', pass: 'TestPass2026!' },
    { label: 'Admin Persatuan', email: 'admin@selangor.silambam.test', pass: 'TestPass2026!' },
    { label: 'Master Ravi', email: 'master.ravi@selangor.silambam.test', pass: 'TestPass2026!' },
    { label: 'Parent Suresh', email: 'parent.suresh@family.test', pass: 'TestPass2026!' },
    { label: 'Student Aryan', email: 'student.aryan@beltflow.test', pass: 'TestPass2026!' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
        },
      ]}
      testID="dev-environment-panel"
    >
      <TouchableOpacity
        style={styles.toggleHeader}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={t('components.devPanel.toggleA11y')}
      >
        <View style={styles.headerLeft}>
          <Server size={iconSize.sm} color={colors.buttonPrimaryBg} />
          <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>
            {t('components.devPanel.title')}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.buttonPrimaryBg }]}>
          {expanded ? t('components.devPanel.hide') : t('components.devPanel.configure')}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            {t('components.devPanel.apiUrlLabel')}
          </Text>

          <View style={styles.urlInputRow}>
            <TextInput
              style={[
                styles.urlInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceHighlight || colors.surface,
                },
              ]}
              value={apiUrl}
              onChangeText={setApiUrlState}
              placeholder={t('components.devPanel.apiUrlPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              testID="input-dev-api-url"
            />
            <TouchableOpacity
              style={[styles.pingButton, { backgroundColor: colors.buttonPrimaryBg }]}
              onPress={handleTestConnection}
              disabled={testingStatus === 'testing'}
            >
              {testingStatus === 'testing' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.pingButtonText}>{t('components.devPanel.ping')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {statusMessage ? (
            <View style={styles.statusRow}>
              {testingStatus === 'success' ? (
                <CheckCircle2 size={14} color="#10B981" />
              ) : testingStatus === 'failed' ? (
                <AlertTriangle size={14} color="#EF4444" />
              ) : null}
              <Text
                style={[
                  typography.caption,
                  {
                    marginLeft: 4,
                    color:
                      testingStatus === 'success'
                        ? '#10B981'
                        : testingStatus === 'failed'
                        ? '#EF4444'
                        : colors.textSecondary,
                  },
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            {t('components.devPanel.testAccountsLabel')}
          </Text>

          <View style={styles.rolesRow}>
            {testAccounts.map((acc) => (
              <TouchableOpacity
                key={acc.email}
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: colors.surfaceHighlight || '#1E293B',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => onSelectTestAccount && onSelectTestAccount(acc.email, acc.pass)}
                accessibilityRole="button"
                accessibilityLabel={t('components.devPanel.selectAccountA11y', { label: acc.label })}
              >
                <Text style={[typography.caption, { color: colors.textPrimary, fontSize: 11 }]}>
                  {acc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    marginVertical: 12,
    overflow: 'hidden',
  },
  toggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urlInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  pingButton: {
    marginLeft: 8,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pingButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
});
