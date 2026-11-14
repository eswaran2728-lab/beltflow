import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../theme/ThemeProvider';
import { BeltBadge, StatusBadge } from './Badges';
import { Card } from './Card';
import { qrPassService, StudentQRPayload } from '../services/qrPassService';
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
  expiresInDays?: number;
  testID?: string;
}

export const StudentDigitalPass: React.FC<StudentDigitalPassProps> = ({
  student,
  isOffline = false,
  expiresInDays = 30,
  testID = 'student-digital-pass',
}) => {
  const { colors, typography } = useTheme();
  const { t } = useI18n();

  const payload: StudentQRPayload = qrPassService.createStudentPassPayload(student, {
    expiresInDays,
  });

  const qrData = qrPassService.serializePayload(payload);
  const issuedDate = new Date(payload.iat * 1000).toLocaleDateString();
  const expiryDate = new Date(payload.exp * 1000).toLocaleDateString();

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
        <QRCode
          value={qrData}
          size={180}
          backgroundColor="#FFFFFF"
          color="#0F172A"
        />
      </View>

      {/* Security notice & Expiry Details */}
      <View style={styles.footerContainer}>
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

        <Text style={[styles.watermarkText, { color: colors.textMuted }]}>
          {t('components.pass.watermark')}
        </Text>

        {isOffline && (
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
