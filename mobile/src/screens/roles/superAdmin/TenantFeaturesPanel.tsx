import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { apiClient } from '../../../services/apiClient';
import { useI18n } from '../../../i18n';
import { StitchTokens } from '../../../theme/tokens';

type Setting = 'INHERIT' | 'ON' | 'OFF';
interface Org { id: string; name: string; state?: string }
interface TenantModule { key: string; title: string; release: string; platformEnabled: boolean; setting: Setting; effective: boolean }

const OPTIONS: Setting[] = ['INHERIT', 'ON', 'OFF'];

/**
 * Super Admin: turn optional release modules on/off per Persatuan (staged
 * rollout). Platform-level settings, never child data. The server enforces
 * and audits every change.
 */
export const TenantFeaturesPanel: React.FC = () => {
  const { t } = useI18n();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [selected, setSelected] = useState<Org | null>(null);
  const [modules, setModules] = useState<TenantModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ organizations: Org[] }>('/api/v1/organizations')
      .then(res => { if (active) setOrgs(res?.organizations || []); })
      .catch(() => { if (active) setError(t('superAdminHome.features.loadError')); });
    return () => { active = false; };
  }, [t]);

  const loadModules = useCallback(async (org: Org) => {
    const res = await apiClient.get<{ modules: TenantModule[] }>(`/release/tenants/${encodeURIComponent(org.id)}/modules`);
    setModules(res?.modules || []);
  }, []);

  const open = async (org: Org) => {
    setSelected(org);
    setModules(null);
    setError(null);
    try {
      await loadModules(org);
    } catch {
      setError(t('superAdminHome.features.loadError'));
    }
  };

  const change = async (m: TenantModule, setting: Setting) => {
    if (!selected || !m.platformEnabled || setting === m.setting || saving) return;
    setSaving(m.key);
    setError(null);
    try {
      await apiClient.put(`/release/tenants/${encodeURIComponent(selected.id)}/modules/${m.key}`, { setting });
      await loadModules(selected);
    } catch {
      setError(t('superAdminHome.features.saveError'));
    } finally {
      setSaving(null);
    }
  };

  const moduleTitle = (m: TenantModule) => {
    const key = `superAdminHome.module.${m.key}`;
    const label = t(key);
    return label === key ? m.title : label;
  };

  return (
    <View style={styles.card} testID="tenant-features-panel">
      <Text style={styles.title} accessibilityRole="header">{t('superAdminHome.features.title')}</Text>
      <Text style={styles.description}>{t('superAdminHome.features.description')}</Text>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      {!selected ? (
        <>
          <Text style={styles.label}>{t('superAdminHome.features.choose')}</Text>
          {orgs === null && !error ? <Text style={styles.muted}>{t('superAdminHome.features.loading')}</Text> : null}
          {orgs && orgs.length === 0 ? <Text style={styles.muted}>{t('superAdminHome.features.empty')}</Text> : null}
          {(orgs || []).map(org => (
            <TouchableOpacity
              key={org.id}
              style={styles.row}
              onPress={() => open(org)}
              accessibilityRole="button"
              accessibilityLabel={org.name}
              testID={`tenant-features-org-${org.id}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{org.name}</Text>
                {org.state ? <Text style={styles.muted}>{org.state}</Text> : null}
              </View>
              <ChevronRight size={18} color={StitchTokens.colors.brandNavy} />
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <>
          <TouchableOpacity
            style={styles.back}
            onPress={() => { setSelected(null); setModules(null); setError(null); }}
            accessibilityRole="button"
            testID="tenant-features-back"
          >
            <ChevronLeft size={18} color={StitchTokens.colors.brandNavy} />
            <Text style={styles.backText}>{t('superAdminHome.features.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.rowTitle}>{selected.name}</Text>
          {modules === null && !error ? <Text style={styles.muted}>{t('superAdminHome.features.loading')}</Text> : null}
          {(modules || []).map(m => (
            <View key={m.key} style={styles.module} testID={`tenant-module-${m.key}`}>
              <Text style={styles.rowTitle}>{moduleTitle(m)}</Text>
              <Text style={[styles.muted, !m.effective && styles.offText]} testID={`tenant-module-${m.key}-status`}>
                {m.platformEnabled
                  ? (m.effective ? t('superAdminHome.features.effectiveOn') : t('superAdminHome.features.effectiveOff'))
                  : t('superAdminHome.features.platformOff')}
              </Text>
              <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={moduleTitle(m)}>
                {OPTIONS.map(opt => {
                  const isSelected = m.setting === opt;
                  const disabled = !m.platformEnabled || saving !== null;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => change(m, opt)}
                      disabled={disabled}
                      style={[styles.option, isSelected && styles.optionSelected, disabled && styles.optionDisabled]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected, disabled }}
                      testID={`tenant-module-${m.key}-${opt}`}
                    >
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {t(`superAdminHome.features.option.${opt}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
};

const c = StitchTokens.colors;
const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: c.brandNavy },
  description: { color: '#475569' },
  label: { fontWeight: '600', color: '#0F172A', marginTop: 4 },
  muted: { color: '#64748B' },
  error: { color: '#B91C1C', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  rowTitle: { fontWeight: '700', color: '#0F172A' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backText: { color: c.brandNavy, fontWeight: '600', marginLeft: 4 },
  module: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 4 },
  offText: { color: '#B45309' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  option: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  optionSelected: { backgroundColor: c.brandNavy, borderColor: c.brandNavy },
  optionDisabled: { opacity: 0.5 },
  optionText: { color: '#0F172A', fontWeight: '600' },
  optionTextSelected: { color: '#FFFFFF' },
});
