import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Download, QrCode } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';

export interface DigitalCertificateCardProps {
  title: string;
  issuedDate: string;
  certificateNumber: string;
  isVerified?: boolean;
  onDownloadPress?: () => void;
  onViewQrPress?: () => void;
  style?: ViewStyle;
}

export const DigitalCertificateCard: React.FC<DigitalCertificateCardProps> = ({
  title,
  issuedDate,
  certificateNumber,
  isVerified = true,
  onDownloadPress,
  onViewQrPress,
  style,
}) => {
  return (
    <View style={[styles.card, style]} testID="digital-certificate-card">
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Digital Certificate</Text>
        {isVerified && (
          <View style={styles.verifiedBadge} testID="qr-verified-badge">
            <Text style={styles.verifiedBadgeText}>QR VERIFIED</Text>
          </View>
        )}
      </View>

      {/* Certificate Details */}
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.subText}>
        Issued {issuedDate} · {certificateNumber}
      </Text>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={onDownloadPress}
          activeOpacity={0.85}
          testID="btn-download-cert"
        >
          <Download size={14} color="#FFFFFF" />
          <Text style={styles.downloadBtnText}>Download PDF Certificate</Text>
        </TouchableOpacity>

        {onViewQrPress && (
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={onViewQrPress}
            activeOpacity={0.8}
            testID="btn-view-cert-qr"
            accessibilityLabel="View Certificate QR"
          >
            <QrCode size={16} color={StitchTokens.colors.brandNavy} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: StitchTokens.colors.colorAccent,
    borderRadius: StitchTokens.radii.cardLarge,
    padding: 16,
    ...StitchTokens.shadows.cardElevated,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLabel: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: StitchTokens.colors.colorAccent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  verifiedBadge: {
    backgroundColor: StitchTokens.colors.bfGreenSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: StitchTokens.radii.tagMini,
  },
  verifiedBadgeText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    color: StitchTokens.colors.bfGreenDark,
  },
  titleText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '800',
    color: StitchTokens.colors.brandNavy,
  },
  subText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    color: StitchTokens.colors.slateTextMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadBtn: {
    flex: 1,
    backgroundColor: StitchTokens.colors.brandNavy,
    borderRadius: StitchTokens.radii.btn,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  downloadBtnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrBtn: {
    width: 44,
    height: 44,
    borderRadius: StitchTokens.radii.btn,
    borderWidth: 1,
    borderColor: StitchTokens.colors.slateBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
