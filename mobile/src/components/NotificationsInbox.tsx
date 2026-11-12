import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { StitchTokens } from '../theme/tokens';
import { useI18n } from '../i18n';
import { Button } from './Button';
import { AppNotification, notificationsService } from '../services/notificationsService';

type T = (key: string, params?: Record<string, string | number>) => string;

/** Title and body for a notification, in the app language. Unknown events get a generic text. */
export function notificationText(t: T, n: Pick<AppNotification, 'eventType' | 'params'>): { title: string; body: string } {
  const titleKey = `notifications.${n.eventType}.title`;
  const known = t(titleKey) !== titleKey;
  const base = known ? `notifications.${n.eventType}` : 'notifications.generic';
  // A missing value never shows as a raw {placeholder}.
  const body = t(`${base}.body`, n.params || {}).replace(/\{\w+\}/g, '—');
  return { title: t(`${base}.title`), body };
}

/**
 * In-app notification inbox for the signed-in user. Pass `enabled` once the
 * screen's own data has loaded, so the inbox request comes after it.
 * Returns the bell props and the inbox element to render.
 */
export function useNotificationInbox(enabled: boolean) {
  const { t } = useI18n();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsService.list();
      setItems(res.notifications);
      setUnreadCount(res.unreadCount);
      setFailed(false);
    } catch {
      // Offline or older server: keep what we have, the bell just shows no dot.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    notificationsService
      .list()
      .then(res => {
        if (!active) return;
        setItems(res.notifications);
        setUnreadCount(res.unreadCount);
        setFailed(false);
      })
      .catch(() => {
        // Offline or older server: the bell just shows no dot.
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const markRead = async (n: AppNotification) => {
    if (n.read) return;
    setItems(list => list.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await notificationsService.markRead(n.id);
    } catch {
      refresh();
    }
  };

  const markAllRead = async () => {
    setItems(list => list.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
    try {
      await notificationsService.markAllRead();
    } catch {
      refresh();
    }
  };

  const openInbox = () => {
    setVisible(true);
    refresh();
  };

  const element = (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="notifications-inbox">
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{t('notifications.title')}</Text>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.close')}
              testID="notifications-close"
            >
              <Text style={styles.closeText}>{t('notifications.close')}</Text>
            </TouchableOpacity>
          </View>

          {unreadCount > 0 ? (
            <Button label={t('notifications.markAllRead')} onPress={markAllRead} variant="outline" size="md" testID="notifications-mark-all" />
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }}>
            {items.length === 0 ? (
              <Text style={styles.empty} testID="notifications-empty">
                {loading ? t('notifications.loading') : failed ? t('notifications.loadError') : t('notifications.empty')}
              </Text>
            ) : (
              items.map(n => {
                const { title, body } = notificationText(t, n);
                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => markRead(n)}
                    style={[styles.item, !n.read && styles.itemUnread]}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.read ? '' : `${t('notifications.unread')}. `}${title}. ${body}`}
                    testID={`notification-${n.id}`}
                  >
                    <View style={styles.itemIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      <Bell size={16} color={StitchTokens.colors.brandNavy} />
                    </View>
                    <View style={styles.itemText}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemTitle}>{title}</Text>
                        {!n.read ? (
                          <Text style={styles.unreadTag} testID={`notification-unread-${n.id}`}>{t('notifications.unread')}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.itemBody}>{body}</Text>
                      <Text style={styles.itemDate}>{new Date(n.createdAt).toLocaleString()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return {
    unreadCount,
    openInbox,
    element,
    bellLabel: t('notifications.bellA11y', { count: unreadCount }),
  };
}

const c = StitchTokens.colors;
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(9,30,50,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: c.brandNavy, flexShrink: 1 },
  close: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: c.brandNavy, fontWeight: '600' },
  list: { flexGrow: 0 },
  empty: { color: '#475569', paddingVertical: 24, textAlign: 'center' },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', minHeight: 44 },
  itemUnread: { backgroundColor: '#EAF1F7', borderRadius: 8 },
  itemIcon: { paddingTop: 2 },
  itemText: { flex: 1 },
  itemTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  itemTitle: { fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  unreadTag: { fontSize: 12, fontWeight: '700', color: c.brandNavy, backgroundColor: '#FFFFFF', borderRadius: 4, paddingHorizontal: 6, overflow: 'hidden' },
  itemBody: { color: '#334155', marginTop: 2 },
  itemDate: { color: '#64748B', fontSize: 12, marginTop: 4 },
});
