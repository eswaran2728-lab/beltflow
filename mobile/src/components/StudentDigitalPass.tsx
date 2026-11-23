import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../theme/ThemeProvider';
import { BeltBadge, StatusBadge } from './Badges';
import { Card } from './Card';
import { signedPassService, SignedPass } from '../services/signedPassService';
import { ShieldCheck, Calendar, Clock, AlertTriangle } from 'lucide-react-native';
import { useI18n } from '../i18n';

export interface StudentDigitalPassProps {
  student: {
    id: string;
    organizationId: string;
    fullName: string;
    beltRank: string;
    status: string;
    persatuanName?: string;
  };
  isOffline?: boolean;
  /** Not used: the server sets the pass validity. Kept for older callers. */
  expiresInDays?: number;
  testID?: string;
}

export const StudentDigitalPass: React.FC<StudentDigitalPassProps> = ({
  student,
  isOffline = false,
  testID = 'student-digital-pass',
}) => {
  const { colors, typography } = useTheme();
  const { t } = useI18n();

  // Only a pass signed by the server is shown: scanners refuse anything else.
  const [pass, setPass] = useState<SignedPass | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    signedPassService.getCached(student.id).then(cached => {
      if (active && cached) setPass(cached);
    });
    if (!isOffline) {
      signedPassService.fetch(student.id).then(
        fresh => {
          if (!active) return;
          setPass(fresh);
          setFailed(false);
        },
        () => {
          if (active) setFailed(true);
        }
      );
    }
    return () => {
      active = false;
    };
  }, [student.id, isOffline]);

  const issuedDate = pass ? new Date(pass.issuedAt).toLocaleDateString() : '';
  const expiryDate = pass ? new Date(pass.expiresAt).toLocaleDateString() : '';

  return (
    <Card
      variant="elevated"
      testID={testID}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={t('components.pass.a11y', { name: student.fullName, belt: student.beltRank })}
    >
      {/* Header with Academy & Shield */}
      <View style={styles.headerRow}>
        <View style={styles.academyInfo}>
          <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '700', textTransform: 'uppercase' }]}>
            {student.persatuanName || t('components.pass.defaultAcademy')}
          </Text>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 2 }]} testID="pass-student-name">
            {student.fullName}
          </Text>
        </View>
        <ShieldCheck size={28} color={colors.buttonPrimaryBg} />
      </View>

      {/* Belt Badge and Membership Status */}
      <View style={styles.badgesRow}>
        <BeltBadge beltName={student.beltRank} size="md" testID="pass-belt-badge" />
        <StatusBadge
          status={student.status}
          label={student.status === 'ACTIVE' ? t('components.pass.activeStudent') : t('status.inactive')}
          variant={student.status === 'ACTIVE' ? 'success' : 'danger'}
          testID="pass-status-badge"
        />
      </View>

      {/* QR Code Container */}
      <View
        style={[styles.qrContainer, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}
        testID="pass-qr-container"
        accessibilityLabel={t('components.pass.qrA11y')}
      >
        {pass ? (
          <QRCode value={pass.qrString} size={180} backgroundColor="#FFFFFF" color="#0F172A" />
        ) : (
          <View style={styles.qrPlaceholder} testID="pass-not-ready">
            <Text style={[typography.caption, { color: '#334155', textAlign: 'center' }]}>
              {failed || isOffline ? t('components.pass.unavailable') : t('components.pass.preparing')}
            </Text>
          </View>
        )}
      </View>

      {/* Security notice & Expiry Details */}
      <View style={styles.footerContainer}>
        {pass ? (
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Calendar size={13} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              {t('components.pass.issued', { date: issuedDate })}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={13} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              {t('components.pass.validUntil', { date: expiryDate })}
            </Text>
          </View>
        </View>
        ) : null}

        <Text style={[styles.watermarkText, { color: colors.textMuted }]}>
          {t('components.pass.watermark')}
        </Text>

        {isOffline && pass && (
          <View style={[styles.offlineBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <AlertTriangle size={14} color="#B45309" />
            <Text style={[styles.offlineBannerText, { color: '#B45309' }]}>
              {t('components.pass.offline')}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  qrPlaceholder: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', padding: 12 },
  container: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  academyInfo: {
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  footerContainer: {
    width: '100%',
    marginTop: 18,
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watermarkText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    gap: 6,
  },
  offlineBannerText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
