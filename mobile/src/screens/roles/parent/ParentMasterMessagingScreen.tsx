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
  MessageSquare,
  Send,
  Paperclip,
  ShieldAlert,
  CheckCheck,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { BrandColors } from '../../../theme/colors';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import {
  messagingService,
  MessageThread,
  ThreadMessage,
} from '../../../services/messagingService';
import { useI18n } from '../../../i18n';

export interface ParentMasterMessagingScreenProps {
  userRole?: 'PARENT' | 'MASTER' | 'ADMIN_PERSATUAN' | 'SUPER_ADMIN' | 'STUDENT';
  studentId?: string;
  studentName?: string;
  classId?: string;
  isOffline?: boolean;
}

const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.bin',
  '.msi',
  '.dll',
  '.scr',
  '.vbs',
  '.js',
  '.zip',
  '.tar',
  '.gz',
];
const MAX_ATTACHMENT_SIZE_MB = 10;

export const ParentMasterMessagingScreen: React.FC<ParentMasterMessagingScreenProps> = ({
  userRole = 'PARENT',
  studentId,
  studentName,
  classId,
  isOffline = false,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();

  // Threads State
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    userRole === 'SUPER_ADMIN' ? t('parentLifecycle.messaging.superAdminNotice') : userRole === 'STUDENT' ? t('parentLifecycle.messaging.minorNotice') : null
  );

  // New Message State
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [lastClientMessageId, setLastClientMessageId] = useState<string | null>(null);

  // Attachment Simulation Modal State
  const [showAttachModal, setShowAttachModal] = useState<boolean>(false);
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const [attachedFileSizeMB, setAttachedFileSizeMB] = useState<string>('2');
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Create Thread Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newThreadChildId, setNewThreadChildId] = useState<string>(studentId || '');
  const [newThreadClassId, setNewThreadClassId] = useState<string>(classId || '');
  const [newThreadSubject, setNewThreadSubject] = useState<string>('General Inquiry');
  const [creatingThread, setCreatingThread] = useState<boolean>(false);

  // Load Messages for selected thread
  const loadMessages = useCallback(async (threadId: string) => {
    try {
      setLoadingMessages(true);
      const res = await messagingService.getThreadMessages(threadId);
      setMessages(res.messages || []);
    } catch (err: any) {
      setErrorMsg(err?.message || t('parentLifecycle.messaging.error.loadMessages'));
    } finally {
      setLoadingMessages(false);
    }
  }, [t]);

  // Load Threads for pull-to-refresh
  const loadThreads = useCallback(async () => {
    if (userRole === 'SUPER_ADMIN' || userRole === 'STUDENT') {
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await messagingService.listThreads();
      const list = data || [];
      setThreads(list);
      if (list.length > 0) {
        setSelectedThread(list[0]);
        await loadMessages(list[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('parentLifecycle.messaging.error.loadThreads'));
    } finally {
      setLoading(false);
    }
  }, [userRole, loadMessages, t]);

  useEffect(() => {
    let isMounted = true;
    if (userRole === 'SUPER_ADMIN' || userRole === 'STUDENT') {
      return;
    }

    messagingService
      .listThreads()
      .then(async (data) => {
        if (!isMounted) return;
        const list = data || [];
        setThreads(list);
        if (list.length > 0) {
          setSelectedThread(list[0]);
          await loadMessages(list[0].id);
        }
      })
      .catch((err: any) => {
        if (isMounted) setErrorMsg(err?.message || t('parentLifecycle.messaging.error.loadThreads'));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userRole, loadMessages, t]);

  // Handle Send Message
  const handleSendMessage = async (isRetry = false) => {
    if (!selectedThread || !inputText.trim()) {
      return;
    }

    const clientMsgId = isRetry && lastClientMessageId ? lastClientMessageId : messagingService.generateClientMessageId();
    setLastClientMessageId(clientMsgId);

    try {
      setSending(true);
      setErrorMsg(null);

      const newMsg = await messagingService.sendMessage(selectedThread.id, {
        content: inputText.trim(),
        clientMessageId: clientMsgId,
        attachmentName: attachedFileName || undefined,
        attachmentSizeBytes: attachedFileName ? Number(attachedFileSizeMB) * 1024 * 1024 : undefined,
      });

      setInputText('');
      setAttachedFileName('');
      // Append if not already in list
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
    } catch (err: any) {
      setErrorMsg(err?.message || t('parentLifecycle.messaging.error.send'));
    } finally {
      setSending(false);
    }
  };

  // Handle Attachment Validation
  const handleConfirmAttachment = () => {
    setAttachmentError(null);
    const lowerName = attachedFileName.toLowerCase().trim();

    const isBlocked = BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (isBlocked) {
      setAttachmentError(t('parentLifecycle.messaging.blockedAttachment'));
      return;
    }

    const size = Number(attachedFileSizeMB);
    if (isNaN(size) || size > MAX_ATTACHMENT_SIZE_MB || size <= 0) {
      setAttachmentError(t('parentLifecycle.messaging.error.attachmentSize', { max: MAX_ATTACHMENT_SIZE_MB }));
      return;
    }

    setShowAttachModal(false);
  };

  // Handle Thread Creation
  const handleCreateThread = async () => {
    if (!newThreadChildId || !newThreadClassId) {
      Alert.alert(
        t('parentLifecycle.messaging.alert.validationTitle'),
        t('parentLifecycle.messaging.alert.validationIds')
      );
      return;
    }

    try {
      setCreatingThread(true);
      const thread = await messagingService.createThread({
        childId: newThreadChildId,
        classId: newThreadClassId,
        subject: newThreadSubject,
      });
      setShowCreateModal(false);
      setThreads((prev) => [thread, ...prev]);
      setSelectedThread(thread);
    } catch (err: any) {
      Alert.alert(t('parentLifecycle.messaging.alert.threadDeniedTitle'), err?.message || t('parentLifecycle.messaging.studentNotEnrolled'));
    } finally {
      setCreatingThread(false);
    }
  };

  // Handle Report Message
  const handleReportMessage = async (messageId: string) => {
    try {
      const res = await messagingService.reportMessage(messageId, 'Inappropriate communication content');
      if (res.success) {
        Alert.alert(t('parentLifecycle.messaging.alert.reportSubmittedTitle'), t('parentLifecycle.messaging.reportSuccess'));
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_reported: true } : m))
        );
      }
    } catch (err: any) {
      Alert.alert(
        t('parentLifecycle.messaging.alert.reportErrorTitle'),
        err?.message || t('parentLifecycle.messaging.alert.reportFailed')
      );
    }
  };

  if (userRole === 'SUPER_ADMIN') {
    return (
      <View style={[styles.noThreadSelected, { backgroundColor: colors.background }]} testID="superadmin-denial-view">
        <Lock size={48} color={BrandColors.PrimaryNavy} />
        <Text style={[styles.title, { color: colors.textPrimary, marginTop: 12 }]}>{t('parentLifecycle.messaging.zeroAccessTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
          {t('parentLifecycle.messaging.superAdminNotice')}
        </Text>
        <View style={styles.errorBanner} testID="messaging-error-banner">
          <AlertCircle size={16} color="#ef4444" />
          <Text style={styles.errorBannerText}>{t('parentLifecycle.messaging.superAdminNotice')}</Text>
        </View>
      </View>
    );
  }

  if (userRole === 'STUDENT') {
    return (
      <View style={[styles.noThreadSelected, { backgroundColor: colors.background }]} testID="student-denial-view">
        <Lock size={48} color={BrandColors.PrimaryNavy} />
        <Text style={[styles.title, { color: colors.textPrimary, marginTop: 12 }]}>{t('parentLifecycle.messaging.minorPolicyTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
          {t('parentLifecycle.messaging.minorNotice')}
        </Text>
        <View style={styles.errorBanner} testID="messaging-error-banner">
          <AlertCircle size={16} color="#ef4444" />
          <Text style={styles.errorBannerText}>{t('parentLifecycle.messaging.minorNotice')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="parent-master-messaging-screen">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <MessageSquare size={22} color={BrandColors.Amber} style={styles.headerIcon} />
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('parentLifecycle.messaging.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('parentLifecycle.messaging.subtitle')}</Text>
          </View>
        </View>

        {userRole === 'PARENT' && (
          <Button
            label={t('parentLifecycle.messaging.newThread')}
            variant="primary"
            size="sm"
            onPress={() => setShowCreateModal(true)}
            testID="btn-new-thread"
            accessibilityLabel={t('parentLifecycle.messaging.newThread')}
            leftIcon={<Plus size={16} color="#FFFFFF" />}
          />
        )}
      </View>

      {/* Child safety banner: lock-screen content minimized */}
      <View style={styles.lockScreenBanner} testID="lock-screen-privacy-banner">
        <Lock size={14} color="#0284c7" />
        <Text style={styles.lockScreenText}>{t('parentLifecycle.messaging.lockScreenNotice')}</Text>
      </View>

      {/* Error state */}
      {errorMsg && (
        <View style={styles.errorBanner} testID="messaging-error-banner">
          <AlertCircle size={16} color="#ef4444" />
          <Text style={styles.errorBannerText}>{errorMsg}</Text>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.contentRow}>
        {/* Thread List Sidebar / Selector */}
        <View style={[styles.threadListContainer, { borderRightColor: colors.border }]}>
          <Text style={[styles.sidebarHeading, { color: colors.textSecondary }]}>{t('parentLifecycle.messaging.conversations')}</Text>
          {loading ? (
            <ActivityIndicator size="small" color={BrandColors.Amber} style={{ marginTop: 20 }} />
          ) : threads.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('parentLifecycle.messaging.noThreads')}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {threads.map((thr) => {
                const isSelected = selectedThread?.id === thr.id;
                return (
                  <TouchableOpacity
                    key={thr.id}
                    style={[
                      styles.threadCard,
                      {
                        backgroundColor: isSelected ? '#1e293b' : colors.surface,
                        borderColor: isSelected ? BrandColors.Amber : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedThread(thr);
                      loadMessages(thr.id);
                    }}
                    testID={`thread-item-${thr.id}`}
                    accessibilityLabel={t('parentLifecycle.messaging.threadA11y', {
                      master: thr.master_name || t('parentLifecycle.messaging.fallbackMaster'),
                      student: thr.student_name || t('parentLifecycle.messaging.fallbackStudent'),
                    })}
                  >
                    <View style={styles.threadCardHeader}>
                      <Text style={[styles.threadSubject, { color: colors.textPrimary }]} numberOfLines={1}>
                        {thr.subject}
                      </Text>
                      {thr.unread_count && thr.unread_count > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{thr.unread_count}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.threadStudent, { color: colors.textSecondary }]}>
                      {t('parentLifecycle.messaging.threadStudent', {
                        name: thr.student_name || studentName || t('parentLifecycle.messaging.fallbackStudent'),
                      })}
                    </Text>
                    <Text style={[styles.threadMaster, { color: colors.textSecondary }]}>
                      {t('parentLifecycle.messaging.threadInstructor', {
                        name: thr.master_name || t('parentLifecycle.messaging.fallbackAssignedMaster'),
                      })}
                    </Text>
                    {thr.last_message_content && (
                      <Text style={[styles.threadSnippet, { color: colors.textSecondary }]} numberOfLines={1}>
                        {thr.last_message_content}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Message Thread History & Input */}
        <View style={styles.chatContainer}>
          {selectedThread ? (
            <>
              {/* Thread Info Bar */}
              <View style={[styles.threadInfoBar, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.threadInfoTitle, { color: colors.textPrimary }]}>
                    {selectedThread.subject} — {selectedThread.class_name || t('parentLifecycle.messaging.fallbackClassSession')}
                  </Text>
                  <Text style={[styles.threadInfoSubtitle, { color: colors.textSecondary }]}>
                    {userRole === 'PARENT'
                      ? t('parentLifecycle.messaging.threadInstructor', {
                          name: selectedThread.master_name || t('parentLifecycle.messaging.fallbackMaster'),
                        })
                      : t('parentLifecycle.messaging.threadParent', {
                          name: selectedThread.parent_name || t('parentLifecycle.messaging.fallbackGuardian'),
                          child: selectedThread.student_name || t('parentLifecycle.messaging.fallbackChild'),
                        })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    loadThreads();
                    if (selectedThread) loadMessages(selectedThread.id);
                  }}
                  style={styles.refreshBtn}
                  testID="btn-refresh-threads"
                  accessibilityLabel={t('parentLifecycle.messaging.refreshA11y')}
                >
                  <RefreshCw size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Messages ScrollView */}
              <ScrollView
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
              >
                {loadingMessages ? (
                  <ActivityIndicator size="small" color={BrandColors.Amber} style={{ marginTop: 20 }} />
                ) : messages.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('parentLifecycle.messaging.noMessages')}</Text>
                ) : (
                  messages.map((msg) => {
                    const isOwnMessage =
                      (userRole === 'PARENT' && msg.sender_role === 'PARENT') ||
                      (userRole === 'MASTER' && msg.sender_role === 'MASTER');

                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageBubbleContainer,
                          isOwnMessage ? styles.ownMessageAlign : styles.otherMessageAlign,
                        ]}
                        testID={`message-bubble-${msg.id}`}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            isOwnMessage
                              ? { backgroundColor: BrandColors.PrimaryNavy }
                              : { backgroundColor: '#1e293b', borderColor: colors.border, borderWidth: 1 },
                          ]}
                        >
                          {/* Sender badge */}
                          <View style={styles.senderHeader}>
                            <Text
                              style={[
                                styles.senderRoleBadge,
                                { color: isOwnMessage ? '#fee2e2' : '#93c5fd' },
                              ]}
                            >
                              {msg.sender_role === 'MASTER' ? t('parentLifecycle.messaging.instructorBadge') : t('parentLifecycle.messaging.guardianBadge')}
                            </Text>

                            {!isOwnMessage && !msg.is_reported && (
                              <TouchableOpacity
                                onPress={() => handleReportMessage(msg.id)}
                                testID={`btn-report-${msg.id}`}
                                accessibilityLabel={t('parentLifecycle.messaging.reportA11y', { id: msg.id })}
                                style={styles.reportBtn}
                              >
                                <ShieldAlert size={12} color="#f87171" />
                                <Text style={styles.reportText}>{t('parentLifecycle.messaging.report')}</Text>
                              </TouchableOpacity>
                            )}

                            {msg.is_reported && (
                              <View style={styles.reportedPill}>
                                <Text style={styles.reportedPillText}>{t('parentLifecycle.messaging.reported')}</Text>
                              </View>
                            )}
                          </View>

                          <Text style={[styles.messageContent, { color: '#FFFFFF' }]}>{msg.content}</Text>

                          {/* Attachment preview if any */}
                          {msg.attachment_name && (
                            <View style={styles.attachmentPill}>
                              <Paperclip size={12} color="#38bdf8" />
                              <Text style={styles.attachmentName} numberOfLines={1}>
                                {msg.attachment_name}
                              </Text>
                            </View>
                          )}

                          {/* Footer: timestamp + delivery status */}
                          <View style={styles.messageFooter}>
                            <Text style={styles.timestampText}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {isOwnMessage && (
                              <View style={styles.deliveryStatusRow}>
                                {msg.delivery_status === 'READ' ? (
                                  <CheckCheck size={14} color="#38bdf8" />
                                ) : (
                                  <Check size={14} color="#cbd5e1" />
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Message Composer */}
              <View style={[styles.composerContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                {attachedFileName ? (
                  <View style={styles.attachmentBar}>
                    <Paperclip size={14} color="#0284c7" />
                    <Text style={styles.attachedFileLabel} numberOfLines={1}>
                      {attachedFileName} ({attachedFileSizeMB} MB)
                    </Text>
                    <TouchableOpacity onPress={() => setAttachedFileName('')}>
                      <X size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={() => setShowAttachModal(true)}
                    testID="btn-open-attach"
                    accessibilityLabel={t('parentLifecycle.messaging.attach')}
                  >
                    <Paperclip size={20} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder={t('parentLifecycle.messaging.typeMessage')}
                    placeholderTextColor={colors.textSecondary}
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    testID="input-message-content"
                    accessibilityLabel={t('parentLifecycle.messaging.typeMessage')}
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      { backgroundColor: inputText.trim() ? BrandColors.PrimaryNavy : '#475569' },
                    ]}
                    onPress={() => handleSendMessage(false)}
                    disabled={!inputText.trim() || sending}
                    testID="btn-send-message"
                    accessibilityLabel={t('parentLifecycle.messaging.send')}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Send size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.noThreadSelected}>
              <Text style={[styles.selectThreadNotice, { color: colors.textSecondary }]}>
                {t('parentLifecycle.messaging.selectThread')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Attachment Modal */}
      <Modal visible={showAttachModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('parentLifecycle.messaging.attachTitle')}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t('parentLifecycle.messaging.attachDesc')}
            </Text>

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={t('parentLifecycle.messaging.filenamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={attachedFileName}
              onChangeText={setAttachedFileName}
              testID="input-attachment-name"
            />

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={t('parentLifecycle.messaging.sizePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={attachedFileSizeMB}
              onChangeText={setAttachedFileSizeMB}
              keyboardType="numeric"
              testID="input-attachment-size"
            />

            {attachmentError && (
              <Text style={styles.attachmentErrorText} testID="attachment-error-message">
                {attachmentError}
              </Text>
            )}

            <View style={styles.modalBtnRow}>
              <Button
                label={t('parentLifecycle.messaging.cancel')}
                variant="outline"
                size="sm"
                onPress={() => setShowAttachModal(false)}
              />
              <Button
                label={t('parentLifecycle.messaging.attach')}
                variant="primary"
                size="sm"
                onPress={handleConfirmAttachment}
                testID="btn-confirm-attach"
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* New Thread Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('parentLifecycle.messaging.newThread')}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t('parentLifecycle.messaging.newThreadDesc')}
            </Text>

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={t('parentLifecycle.messaging.studentIdPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={newThreadChildId}
              onChangeText={setNewThreadChildId}
              testID="input-thread-student-id"
            />

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={t('parentLifecycle.messaging.classIdPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={newThreadClassId}
              onChangeText={setNewThreadClassId}
              testID="input-thread-class-id"
            />

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={t('parentLifecycle.messaging.subjectPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={newThreadSubject}
              onChangeText={setNewThreadSubject}
              testID="input-thread-subject"
            />

            <View style={styles.modalBtnRow}>
              <Button
                label={t('parentLifecycle.messaging.cancel')}
                variant="outline"
                size="sm"
                onPress={() => setShowCreateModal(false)}
              />
              <Button
                label={creatingThread ? t('parentLifecycle.messaging.creating') : t('parentLifecycle.messaging.createThread')}
                variant="primary"
                size="sm"
                onPress={handleCreateThread}
                disabled={creatingThread}
                testID="btn-submit-new-thread"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    marginTop: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  lockScreenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2, 132, 199, 0.2)',
  },
  lockScreenText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
  },
  threadListContainer: {
    width: 260,
    borderRightWidth: 1,
    padding: 12,
  },
  sidebarHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  threadCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  threadCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  threadSubject: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: BrandColors.Amber,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  unreadText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  threadStudent: {
    fontSize: 11,
    marginTop: 4,
  },
  threadMaster: {
    fontSize: 11,
    marginTop: 2,
  },
  threadSnippet: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  chatContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  threadInfoBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  threadInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  threadInfoSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    padding: 6,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageBubbleContainer: {
    maxWidth: '80%',
  },
  ownMessageAlign: {
    alignSelf: 'flex-end',
  },
  otherMessageAlign: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 14,
  },
  senderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  senderRoleBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportText: {
    fontSize: 10,
    color: '#f87171',
  },
  reportedPill: {
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reportedPillText: {
    fontSize: 9,
    color: '#fecaca',
    fontWeight: '600',
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  attachmentName: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '500',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  timestampText: {
    fontSize: 10,
    color: '#cbd5e1',
  },
  deliveryStatusRow: {
    flexDirection: 'row',
  },
  composerContainer: {
    padding: 12,
    borderTopWidth: 1,
  },
  attachmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  attachedFileLabel: {
    flex: 1,
    fontSize: 12,
    color: '#0284c7',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachBtn: {
    padding: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noThreadSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  selectThreadNotice: {
    fontSize: 14,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  attachmentErrorText: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 10,
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
});
