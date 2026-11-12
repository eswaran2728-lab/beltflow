import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Video as VideoIcon,
  Play,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Clock,
  Star,
  ShieldAlert,
  UploadCloud,
  X,
  MessageSquare,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { BrandColors } from '../../../theme/colors';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import {
  mediaFeedbackService,
  VideoSubmission,
  VideoPlaybackResult,
  VideoAnnotation,
} from '../../../services/mediaFeedbackService';
import { useI18n } from '../../../i18n';

export interface VideoFeedbackScreenProps {
  studentId: string;
  studentName?: string;
  userRole?: 'STUDENT' | 'PARENT' | 'MASTER' | 'ADMIN_PERSATUAN' | 'SUPER_ADMIN';
  isOffline?: boolean;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const VideoFeedbackScreen: React.FC<VideoFeedbackScreenProps> = ({
  studentId,
  studentName: studentNameProp,
  userRole = 'STUDENT',
  isOffline = false,
}) => {
  const { t } = useI18n();
  const studentName = studentNameProp ?? t('studentFlows.video.studentFallback');
  const { colors } = useTheme();

  // State
  const [videos, setVideos] = useState<VideoSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('Kata Form Submission');
  const [uploadCategory, setUploadCategory] = useState<string>('POOMSAE');
  const [uploadFileSizeMB, setUploadFileSizeMB] = useState<string>('15');
  const [uploadMimeType, setUploadMimeType] = useState<string>('video/mp4');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Playback Modal State
  const [selectedVideo, setSelectedVideo] = useState<VideoPlaybackResult | null>(null);

  // Master Annotation Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [activeFeedbackVideoId, setActiveFeedbackVideoId] = useState<string | null>(null);
  const [feedbackTimestamp, setFeedbackTimestamp] = useState<string>('00:15');
  const [feedbackAnnotation, setFeedbackAnnotation] = useState<string>('');
  const [feedbackRating, setFeedbackRating] = useState<number>(4);
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);

  // Consent State
  const [isConsentRevoked, setIsConsentRevoked] = useState<boolean>(false);
  const [revokingConsent, setRevokingConsent] = useState<boolean>(false);

  // Helper to refresh student videos on demand
  const loadVideos = useCallback(async () => {
    if (userRole === 'SUPER_ADMIN') {
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await mediaFeedbackService.getStudentVideos(studentId);
      setVideos(data || []);
    } catch (err: any) {
      const msg = err?.message || t('studentFlows.video.loadFailed');
      setErrorMsg(msg);
      if (msg.includes('wrong_Master_or_guardian_denied')) {
        setErrorMsg(t('studentFlows.video.accessDenied'));
      }
    } finally {
      setLoading(false);
    }
  }, [studentId, userRole, t]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    if (userRole === 'SUPER_ADMIN') {
      return;
    }

    mediaFeedbackService
      .getStudentVideos(studentId)
      .then((data) => {
        if (isMounted) setVideos(data || []);
      })
      .catch((err: any) => {
        if (isMounted) {
          const msg = err?.message || t('studentFlows.video.loadFailed');
          setErrorMsg(msg);
          if (msg.includes('wrong_Master_or_guardian_denied')) {
            setErrorMsg(t('studentFlows.video.accessDenied'));
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId, userRole, t]);

  // Handle Video Upload Request
  const handleUploadSubmit = async () => {
    setUploadError(null);

    const sizeInBytes = Math.round(parseFloat(uploadFileSizeMB || '0') * 1024 * 1024);

    // Acceptance test: oversized_invalid_upload_rejected
    if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
      setUploadError(t('studentFlows.video.oversized', { size: (sizeInBytes / (1024 * 1024)).toFixed(1) }));
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(uploadMimeType.toLowerCase())) {
      setUploadError(t('studentFlows.video.invalidFormat', { mime: uploadMimeType }));
      return;
    }

    if (isConsentRevoked) {
      setUploadError(t('studentFlows.video.consentBlocksUpload'));
      return;
    }

    if (!uploadTitle.trim()) {
      setUploadError(t('studentFlows.video.titleRequired'));
      return;
    }

    try {
      setUploading(true);
      const reqRes = await mediaFeedbackService.requestUpload({
        studentId,
        title: uploadTitle.trim(),
        fileSize: sizeInBytes,
        mimeType: uploadMimeType,
        techniqueCategory: uploadCategory,
        durationSeconds: 60,
      });

      // Finalize upload
      if (reqRes?.videoId) {
        await mediaFeedbackService.finalizeUpload(reqRes.videoId, reqRes.presignedToken);
      }

      setShowUploadModal(false);
      setUploadTitle('');
      setUploadError(null);
      await loadVideos();
      Alert.alert(t('studentFlows.video.uploadCompleteTitle'), t('studentFlows.video.uploadCompleteBody'));
    } catch (err: any) {
      const msg = err?.message || t('studentFlows.video.uploadFailed');
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  // Open Playback
  const handleOpenPlayback = async (videoId: string) => {
    try {
      const res = await mediaFeedbackService.getPlayback(videoId);
      setSelectedVideo(res);
    } catch (err: any) {
      const msg = err?.message || t('studentFlows.video.playbackFailed');
      if (msg.includes('expired_URL_denied')) {
        Alert.alert(t('studentFlows.video.expiredTitle'), t('studentFlows.video.expiredBody'));
      } else if (msg.includes('consent_revocation_blocks_new_access')) {
        Alert.alert(t('studentFlows.video.consentRevokedTitle'), t('studentFlows.video.playbackConsentRevoked'));
      } else {
        Alert.alert(t('studentFlows.video.playbackErrorTitle'), msg);
      }
    }
  };

  // Open Master Feedback Modal
  const handleOpenAddFeedback = (videoId: string) => {
    setActiveFeedbackVideoId(videoId);
    setFeedbackAnnotation('');
    setFeedbackTimestamp('00:15');
    setFeedbackRating(4);
    setShowFeedbackModal(true);
  };

  // Submit Feedback
  const handleSubmitFeedback = async () => {
    if (!activeFeedbackVideoId || !feedbackAnnotation.trim()) {
      Alert.alert(t('studentFlows.video.inputRequiredTitle'), t('studentFlows.video.inputRequiredBody'));
      return;
    }

    try {
      setSubmittingFeedback(true);
      const [minStr, secStr] = feedbackTimestamp.split(':');
      const timestampSec = (parseInt(minStr, 10) || 0) * 60 + (parseInt(secStr, 10) || 0);

      await mediaFeedbackService.addVideoFeedback(activeFeedbackVideoId, {
        timestampSeconds: timestampSec,
        annotationText: feedbackAnnotation.trim(),
        techniqueRating: feedbackRating,
      });

      setShowFeedbackModal(false);
      Alert.alert(t('studentFlows.video.feedbackAddedTitle'), t('studentFlows.video.feedbackAddedBody'));
      if (selectedVideo && selectedVideo.id === activeFeedbackVideoId) {
        handleOpenPlayback(activeFeedbackVideoId);
      }
      await loadVideos();
    } catch (err: any) {
      Alert.alert(t('studentFlows.video.errorTitle'), err?.message || t('studentFlows.video.submitFeedbackFailed'));
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Revoke Consent
  const handleRevokeConsent = async () => {
    Alert.alert(
      t('studentFlows.video.revokeTitle'),
      t('studentFlows.video.revokeConfirm'),
      [
        { text: t('studentFlows.video.cancel'), style: 'cancel' },
        {
          text: t('studentFlows.video.revokeConsent'),
          style: 'destructive',
          onPress: async () => {
            try {
              setRevokingConsent(true);
              await mediaFeedbackService.revokeMediaConsent(studentId, 'Guardian opted out of video analysis.');
              setIsConsentRevoked(true);
              Alert.alert(t('studentFlows.video.consentRevokedTitle'), t('studentFlows.video.consentRevokedBody'));
            } catch (err: any) {
              Alert.alert(t('studentFlows.video.errorTitle'), err?.message || t('studentFlows.video.revokeFailed'));
            } finally {
              setRevokingConsent(false);
            }
          },
        },
      ]
    );
  };

  // Delete Video
  const handleDeleteVideo = async (videoId: string) => {
    Alert.alert(
      t('studentFlows.video.deleteTitle'),
      t('studentFlows.video.deleteConfirm'),
      [
        { text: t('studentFlows.video.cancel'), style: 'cancel' },
        {
          text: t('studentFlows.video.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await mediaFeedbackService.deleteVideo(videoId);
              if (selectedVideo?.id === videoId) {
                setSelectedVideo(null);
              }
              await loadVideos();
              Alert.alert(t('studentFlows.video.deletedTitle'), t('studentFlows.video.deletedBody'));
            } catch (err: any) {
              Alert.alert(t('studentFlows.video.deleteFailedTitle'), err?.message || t('studentFlows.video.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  if (userRole === 'SUPER_ADMIN') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]} testID="superadmin-denial-view">
        <Lock size={48} color={BrandColors.DeepNavy} />
        <Text style={[styles.denialTitle, { color: colors.text }]}>{t('studentFlows.video.zeroAccessTitle')}</Text>
        <Text style={[styles.denialSubtitle, { color: colors.textSecondary }]}>
          {t('studentFlows.video.zeroAccessBody')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="video-feedback-screen">
      {/* Header Banner */}
      <View style={[styles.headerBanner, { backgroundColor: BrandColors.PrimaryNavy }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t('studentFlows.video.headerTitle')}</Text>
            <Text style={styles.headerSubtitle}>{t('studentFlows.video.headerSubtitle', { name: studentName })}</Text>
          </View>
          {isConsentRevoked ? (
            <View style={styles.consentRevokedBadge} testID="consent-revoked-badge">
              <ShieldAlert size={14} color="#FFF" />
              <Text style={styles.consentRevokedText}>{t('studentFlows.video.consentRevokedTitle')}</Text>
            </View>
          ) : (
            <View style={styles.consentActiveBadge}>
              <CheckCircle2 size={14} color="#FFF" />
              <Text style={styles.consentActiveText}>{t('studentFlows.video.consentActive')}</Text>
            </View>
          )}
        </View>

        {/* Action Controls */}
        <View style={styles.headerActionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, isConsentRevoked && styles.disabledBtn]}
            disabled={isConsentRevoked || isOffline}
            onPress={() => setShowUploadModal(true)}
            testID="upload-video-button"
          >
            <Plus size={16} color="#FFF" />
            <Text style={styles.actionBtnText}>{t('studentFlows.video.newVideo')}</Text>
          </TouchableOpacity>

          {(userRole === 'PARENT' || userRole === 'STUDENT') && !isConsentRevoked && (
            <TouchableOpacity
              style={styles.revokeBtn}
              onPress={handleRevokeConsent}
              disabled={revokingConsent}
              testID="revoke-consent-button"
            >
              <ShieldAlert size={16} color="#EF4444" />
              <Text style={styles.revokeBtnText}>{t('studentFlows.video.revokeConsent')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {errorMsg && (
          <View style={styles.errorAlert} testID="video-error-alert">
            <AlertCircle size={20} color="#EF4444" />
            <Text style={styles.errorAlertText}>{errorMsg}</Text>
          </View>
        )}

        {isConsentRevoked && (
          <View style={styles.warningBanner} testID="revocation-warning-banner">
            <ShieldAlert size={20} color="#B45309" />
            <Text style={styles.warningBannerText}>
              {t('studentFlows.video.revocationBanner')}
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loaderArea}>
            <ActivityIndicator size="large" color={BrandColors.Amber} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('studentFlows.video.loadingSubmissions')}</Text>
          </View>
        ) : videos.length === 0 ? (
          <View style={styles.emptyCard} testID="empty-videos-state">
            <VideoIcon size={44} color={BrandColors.SecondaryNavy} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('studentFlows.video.emptyTitle')}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {t('studentFlows.video.emptyBody')}
            </Text>
          </View>
        ) : (
          videos.map((vid) => (
            <View key={vid.id} testID={`video-card-${vid.id}`}>
              <Card style={styles.videoCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{vid.title}</Text>
                    <Text style={[styles.cardCategory, { color: BrandColors.Amber }]}>{vid.technique_category}</Text>
                  </View>
                  <StatusBadge
                    status={vid.upload_status === 'FEEDBACK_PROVIDED' ? 'ACTIVE' : vid.upload_status === 'UPLOADED' ? 'PENDING' : 'SUSPENDED'}
                    label={vid.upload_status.replace('_', ' ')}
                  />
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{vid.duration_seconds}s</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <UploadCloud size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {(vid.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                  </View>
                  {vid.annotation_count !== undefined && (
                    <View style={styles.metaItem}>
                      <MessageSquare size={14} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {t('studentFlows.video.critiqueCount', { count: vid.annotation_count })}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    style={[styles.playButton, isConsentRevoked && styles.disabledBtn]}
                    disabled={isConsentRevoked}
                    onPress={() => handleOpenPlayback(vid.id)}
                    testID={`play-video-${vid.id}`}
                  >
                    <Play size={16} color="#FFF" />
                    <Text style={styles.playButtonText}>{t('studentFlows.video.watchFeedback')}</Text>
                  </TouchableOpacity>

                  {userRole === 'MASTER' && (
                    <TouchableOpacity
                      style={styles.critiqueBtn}
                      onPress={() => handleOpenAddFeedback(vid.id)}
                      testID={`add-critique-${vid.id}`}
                    >
                      <Star size={16} color={BrandColors.Amber} />
                      <Text style={styles.critiqueBtnText}>{t('studentFlows.video.addCritique')}</Text>
                    </TouchableOpacity>
                  )}

                  {(userRole === 'PARENT' || userRole === 'MASTER') && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteVideo(vid.id)}
                      testID={`delete-video-${vid.id}`}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            </View>
          ))
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showUploadModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('studentFlows.video.uploadModalTitle')}</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)} testID="upload-close-btn">
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {uploadError && (
              <View style={styles.modalErrorAlert} testID="upload-modal-error">
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.modalErrorText}>{uploadError}</Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('studentFlows.video.videoTitleLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={uploadTitle}
              onChangeText={setUploadTitle}
              placeholder={t('studentFlows.video.videoTitlePlaceholder')}
              placeholderTextColor="#94A3B8"
              testID="upload-title-input"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('studentFlows.video.categoryLabel')}</Text>
            <View style={styles.categoryPickerRow}>
              {['POOMSAE', 'SPARRING', 'SELF_DEFENSE'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catOption,
                    uploadCategory === cat && { backgroundColor: BrandColors.Amber, borderColor: BrandColors.Amber },
                  ]}
                  onPress={() => setUploadCategory(cat)}
                >
                  <Text style={[styles.catOptionText, uploadCategory === cat && { color: '#FFF' }]}>{t(`studentFlows.video.category.${cat}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('studentFlows.video.fileSizeLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={uploadFileSizeMB}
              onChangeText={setUploadFileSizeMB}
              keyboardType="numeric"
              placeholder="15"
              placeholderTextColor="#94A3B8"
              testID="upload-size-input"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('studentFlows.video.mimeLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={uploadMimeType}
              onChangeText={setUploadMimeType}
              placeholder="video/mp4"
              placeholderTextColor="#94A3B8"
              testID="upload-mime-input"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleUploadSubmit}
                testID="upload-submit-btn"
              >
                <Text style={styles.actionBtnText}>{uploading ? t('studentFlows.video.uploading') : t('studentFlows.video.submitVideo')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Playback & Critiques Modal */}
      <Modal visible={!!selectedVideo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCardWide, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedVideo?.title}</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {selectedVideo?.techniqueCategory} • {selectedVideo?.durationSeconds}s
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedVideo(null)}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Video Player Placeholder */}
            <View style={styles.playerContainer} testID="video-player-container">
              <Play size={44} color="#FFF" />
              <Text style={styles.playerUrlText} numberOfLines={1}>
                {selectedVideo?.playbackUrl}
              </Text>
              <Text style={styles.playerExpiryText}>{t('studentFlows.video.tokenExpires', { expiresAt: selectedVideo?.expiresAt ?? '' })}</Text>
            </View>

            {/* Critique Annotations List */}
            <Text style={[styles.annotationsHeader, { color: colors.text }]}>{t('studentFlows.video.annotationsHeader')}</Text>
            <ScrollView style={styles.annotationsList} testID="annotations-list">
              {selectedVideo?.annotations?.length === 0 ? (
                <Text style={[styles.noFeedbackText, { color: colors.textSecondary }]}>
                  {t('studentFlows.video.noFeedback')}
                </Text>
              ) : (
                selectedVideo?.annotations?.map((ann: VideoAnnotation) => (
                  <View key={ann.id} style={styles.annotationItem} testID={`annotation-item-${ann.id}`}>
                    <View style={styles.annotationTop}>
                      <View style={styles.annotationTimestamp}>
                        <Clock size={12} color="#FFF" />
                        <Text style={styles.annotationTimestampText}>{ann.timestamp_seconds}s</Text>
                      </View>
                      {ann.technique_rating && (
                        <View style={styles.ratingBadge}>
                          <Star size={12} color="#F59E0B" fill="#F59E0B" />
                          <Text style={styles.ratingText}>{ann.technique_rating}/5</Text>
                        </View>
                      )}
                      <Text style={[styles.annotatorName, { color: colors.textSecondary }]}>
                        {ann.master_name || t('studentFlows.video.masterFallback')}
                      </Text>
                    </View>
                    <Text style={[styles.annotationBody, { color: colors.text }]}>{ann.annotation_text}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalBottomActions}>
              {userRole === 'MASTER' && (
                <TouchableOpacity
                  style={styles.addCritiqueModalBtn}
                  onPress={() => handleOpenAddFeedback(selectedVideo!.id)}
                >
                  <Plus size={16} color="#FFF" />
                  <Text style={styles.addCritiqueModalBtnText}>{t('studentFlows.video.addTimestamped')}</Text>
                </TouchableOpacity>
              )}
              <Button title={t('studentFlows.video.close')} variant="secondary" onPress={() => setSelectedVideo(null)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Master Add Feedback Modal */}
      <Modal visible={showFeedbackModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('studentFlows.video.addInstructorCritique')}</Text>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('studentFlows.video.timestampLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={feedbackTimestamp}
              onChangeText={setFeedbackTimestamp}
              placeholder="00:15"
              placeholderTextColor="#94A3B8"
              testID="feedback-timestamp-input"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('studentFlows.video.ratingLabel')}</Text>
            <View style={styles.ratingSelectorRow}>
              {[1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.ratingStarBtn,
                    feedbackRating >= num && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
                  ]}
                  onPress={() => setFeedbackRating(num)}
                  testID={`rating-star-${num}`}
                >
                  <Star size={18} color="#F59E0B" fill={feedbackRating >= num ? '#F59E0B' : 'none'} />
                  <Text style={styles.ratingNumber}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('studentFlows.video.notesLabel')}</Text>
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.text }]}
              value={feedbackAnnotation}
              onChangeText={setFeedbackAnnotation}
              multiline
              numberOfLines={4}
              placeholder={t('studentFlows.video.notesPlaceholder')}
              placeholderTextColor="#94A3B8"
              testID="feedback-notes-input"
            />

            <View style={styles.modalBtnRow}>
              <Button
                title={submittingFeedback ? t('studentFlows.video.submitting') : t('studentFlows.video.saveCritique')}
                onPress={handleSubmitFeedback}
                loading={submittingFeedback}
                testID="feedback-submit-btn"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  denialTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  denialSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerBanner: {
    padding: 16,
    paddingTop: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  consentActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  consentActiveText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  consentRevokedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  consentRevokedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.Amber,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  revokeBtnText: {
    color: '#9F1239',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  errorAlertText: {
    color: '#991B1B',
    fontSize: 13,
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  warningBannerText: {
    color: '#92400E',
    fontSize: 13,
    flex: 1,
    fontWeight: '600',
  },
  loaderArea: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  videoCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.PrimaryNavy,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  playButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  critiqueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  critiqueBtnText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 9,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
  },
  modalCardWide: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalErrorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    gap: 8,
  },
  modalErrorText: {
    color: '#991B1B',
    fontSize: 12,
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  catOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  catOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  modalBtnRow: {
    marginTop: 20,
  },
  playerContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  playerUrlText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 10,
    maxWidth: '90%',
  },
  playerExpiryText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
  },
  annotationsHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  annotationsList: {
    maxHeight: 200,
  },
  noFeedbackText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  annotationItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  annotationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  annotationTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.PrimaryNavy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  annotationTimestampText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  ratingText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
  },
  annotatorName: {
    fontSize: 11,
    fontWeight: '600',
  },
  annotationBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalBottomActions: {
    marginTop: 16,
    gap: 8,
  },
  addCritiqueModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.Amber,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addCritiqueModalBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  ratingSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  ratingStarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 4,
  },
  ratingNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
