import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  X,
  Zap,
  ZapOff,
  Camera,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react-native';
import { AuthUser } from '../../../types/auth';
import {
  CachedSession,
  CachedStudent,
  AttendanceStatus,
} from '../../../database/types';
import { qrPassService, QRScanResult } from '../../../services/qrPassService';
import { masterAttendanceService } from '../../../services/masterAttendanceService';
import { offlineSyncService } from '../../../services/offlineSyncService';
import { networkService } from '../../../services/networkService';
import { BeltBadge } from '../../../components/Badges';
import { Button } from '../../../components/Button';
import { useI18n } from '../../../i18n';

const STATUS_LABEL_KEYS: Record<AttendanceStatus, string> = {
  Present: 'status.present',
  Late: 'status.late',
  Absent: 'status.absent',
  Excused: 'status.excused',
};

export interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  user: AuthUser;
  activeSession: CachedSession | null;
  roster: CachedStudent[];
  attendanceMap: Record<string, AttendanceStatus | null>;
  onAttendanceRecorded: (studentId: string, status: AttendanceStatus) => void;
  isOffline?: boolean;
  isCameraAvailable?: boolean; // prop override for testing or hardware failure
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  user,
  activeSession,
  roster,
  attendanceMap,
  onAttendanceRecorded,
  isOffline = false,
  isCameraAvailable = true,
}) => {
  const { t } = useI18n();
  const statusLabel = (status: AttendanceStatus) => t(STATUS_LABEL_KEYS[status] ?? status);
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanningLocked, setScanningLocked] = useState(false);

  // Scanned Student State for Confirmation
  const [scannedStudent, setScannedStudent] = useState<CachedStudent | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('Present');
  const [duplicateWarning, setDuplicateWarning] = useState<AttendanceStatus | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const resetTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  // Handle barcode scanned event from CameraView
  const handleBarcodeScanned = (event: { data: string }) => {
    if (scanningLocked || scannedStudent) return;
    setScanningLocked(true);
    setScanError(null);

    const validation: QRScanResult = qrPassService.validateScannedPass(event.data, {
      currentOrgId: user.organizationId || '',
      session: activeSession,
      roster,
    });

    if (!validation.isValid || !validation.student) {
      setScanError(validation.errorMessage || t('masterOps.qr.invalidPass'));
      // Unlock after delay to allow re-scan
      setTimeout(() => {
        setScanningLocked(false);
      }, 2000);
      return;
    }

    const matched = validation.student;
    const dupCheck = qrPassService.checkDuplicateScan(matched.id, attendanceMap);

    if (dupCheck.isDuplicate) {
      setDuplicateWarning(dupCheck.existingStatus);
      setSelectedStatus(dupCheck.existingStatus || 'Present');
    } else {
      setDuplicateWarning(null);
      setSelectedStatus('Present');
    }

    setScannedStudent(matched);
  };

  // Confirm attendance record from confirmation card
  const handleConfirmAttendance = async () => {
    if (!scannedStudent || !activeSession) return;
    setSavingAttendance(true);
    setScanError(null);

    try {
      await masterAttendanceService.recordAttendanceMark(user, {
        sessionId: activeSession.id,
        studentId: scannedStudent.id,
        status: selectedStatus,
      });

      onAttendanceRecorded(scannedStudent.id, selectedStatus);
      setSaveSuccessMsg(t('masterOps.qr.markedAs', { name: scannedStudent.full_name, status: statusLabel(selectedStatus) }));

      // Trigger background sync if online
      if (!isOffline && networkService.isConnected()) {
        void offlineSyncService.syncNow(user, { silent: true });
      }

      // Reset for next scan
      resetTimerRef.current = setTimeout(() => {
        setScannedStudent(null);
        setDuplicateWarning(null);
        setSaveSuccessMsg(null);
        setScanningLocked(false);
        setSavingAttendance(false);
      }, 1200);
    } catch (err: any) {
      setSavingAttendance(false);
      setScanError(err.message || t('masterOps.qr.saveFailed'));
    }
  };

  const handleCancelConfirmation = () => {
    setScannedStudent(null);
    setDuplicateWarning(null);
    setScanError(null);
    setScanningLocked(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      testID="modal-qr-scanner"
    >
      <View style={[styles.container, { backgroundColor: '#0B0F19' }]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="btn-manual-fallback"
            onPress={onClose}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('masterOps.qr.closeA11y')}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>{t('masterOps.qr.title')}</Text>

          <TouchableOpacity
            testID="btn-toggle-torch"
            onPress={() => setTorchOn(!torchOn)}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={torchOn ? t('masterOps.qr.torchOffA11y') : t('masterOps.qr.torchOnA11y')}
          >
            {torchOn ? <Zap size={22} color="#FBBF24" /> : <ZapOff size={22} color="#94A3B8" />}
          </TouchableOpacity>
        </View>

        {/* Camera or Fallback View */}
        {!isCameraAvailable ? (
          <View testID="camera-hardware-unavailable-state" style={styles.centerMessage}>
            <Camera size={48} color="#EF4444" />
            <Text style={styles.errorTitle}>{t('masterOps.qr.cameraUnavailableTitle')}</Text>
            <Text style={styles.errorSubtitle}>
              {t('masterOps.qr.cameraUnavailableMessage')}
            </Text>
            <Button
              label={t('masterOps.qr.switchToManual')}
              onPress={onClose}
              variant="primary"
              size="md"
              testID="btn-fallback-manual-list"
              style={{ marginTop: 16 }}
            />
          </View>
        ) : !permission ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>{t('masterOps.qr.initializingCamera')}</Text>
          </View>
        ) : !permission.granted ? (
          <View testID="camera-permission-denied-state" style={styles.centerMessage}>
            <AlertTriangle size={48} color="#F59E0B" />
            <Text style={styles.errorTitle}>{t('masterOps.qr.permissionTitle')}</Text>
            <Text style={styles.errorSubtitle}>
              {t('masterOps.qr.permissionMessage')}
            </Text>
            <View style={{ gap: 12, marginTop: 16, width: '100%', maxWidth: 280 }}>
              <Button
                label={t('masterOps.qr.grantPermission')}
                onPress={requestPermission}
                variant="primary"
                size="md"
                testID="btn-grant-camera-permission"
              />
              <Button
                label={t('masterOps.qr.manualRollCall')}
                onPress={onClose}
                variant="outline"
                size="md"
                testID="btn-permission-manual-fallback"
              />
            </View>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torchOn}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scannedStudent ? undefined : handleBarcodeScanned}
              testID="camera-view"
            />

            {/* Viewfinder Target Reticle */}
            <View testID="qr-scanner-viewfinder" style={styles.viewfinderOverlay}>
              <View style={styles.reticleBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.reticleInstructions}>
                {t('masterOps.qr.alignInstructions')}
              </Text>
            </View>

            {/* Error Message Toast */}
            {scanError && (
              <View testID="scan-error-banner" style={styles.errorToast}>
                <AlertTriangle size={18} color="#EF4444" />
                <Text style={styles.errorToastText}>{scanError}</Text>
              </View>
            )}

            {/* Success Toast */}
            {saveSuccessMsg && (
              <View testID="scan-success-banner" style={styles.successToast}>
                <CheckCircle size={18} color="#10B981" />
                <Text style={styles.successToastText}>{saveSuccessMsg}</Text>
              </View>
            )}

            {/* Student Confirmation Card */}
            {scannedStudent && (
              <View testID="qr-confirmation-card" style={styles.confirmationCard}>
                <View style={styles.confirmationHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName} testID="scanned-student-name">
                      {scannedStudent.full_name}
                    </Text>
                    <Text style={styles.studentMeta}>
                      {t('masterOps.qr.studentId', { id: scannedStudent.id })}
                    </Text>
                  </View>
                  <BeltBadge beltName={scannedStudent.belt_rank} size="sm" />
                </View>

                {/* Duplicate Scan Warning */}
                {duplicateWarning && (
                  <View testID="dialog-duplicate-scan" style={styles.duplicateWarningBox}>
                    <Clock size={16} color="#B45309" />
                    <Text style={styles.duplicateWarningText}>
                      {t('masterOps.qr.alreadyMarked', { status: statusLabel(duplicateWarning) })}
                    </Text>
                  </View>
                )}

                {/* Status Selector */}
                <Text style={styles.statusLabel}>{t('masterOps.qr.statusLabel')}</Text>
                <View style={styles.statusRow}>
                  {(['Present', 'Late', 'Absent', 'Excused'] as AttendanceStatus[]).map(status => {
                    const isSelected = selectedStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        testID={`btn-qr-status-${status.toLowerCase()}`}
                        onPress={() => setSelectedStatus(status)}
                        style={[
                          styles.statusBtn,
                          isSelected && styles.statusBtnSelected,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.statusBtnText,
                            isSelected && styles.statusBtnTextSelected,
                          ]}
                        >
                          {statusLabel(status)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActionRow}>
                  <Button
                    label={t('masterOps.qr.cancel')}
                    onPress={handleCancelConfirmation}
                    variant="outline"
                    size="sm"
                    testID="btn-cancel-qr-attendance"
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={savingAttendance ? t('masterOps.qr.saving') : t('masterOps.qr.confirm')}
                    onPress={handleConfirmAttendance}
                    variant="primary"
                    size="sm"
                    disabled={savingAttendance}
                    testID="btn-confirm-qr-attendance"
                    style={{ flex: 2 }}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
    zIndex: 10,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  viewfinderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  reticleInstructions: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  errorToast: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  errorToastText: {
    color: '#FEE2E2',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  successToast: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  successToastText: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  confirmationCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 18,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  studentName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  studentMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  duplicateWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#451A03',
    borderColor: '#F59E0B',
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  duplicateWarningText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  statusLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#0F172A',
    alignItems: 'center',
  },
  statusBtnSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  statusBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
