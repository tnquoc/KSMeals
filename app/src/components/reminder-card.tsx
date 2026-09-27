import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { useSchool } from '@/lib/school-store';

/** "Nhắc thực đơn mỗi sáng" switch (web app only; hidden where Web Push is not available). */
export function ReminderCard() {
  const theme = useTheme();
  const { school, allergies } = useSchool();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  if (!school || !state || state === 'unsupported') return null;

  const toggle = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (state === 'on') {
        await disablePush();
        setState('off');
        track('push_off', school.code);
      } else {
        const next = await enablePush(school.id, allergies);
        setState(next);
        if (next === 'on') track('push_on', school.code);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        🔔 Nhắc thực đơn mỗi sáng
      </ThemedText>
      {state === 'needs-install' ? (
        <ThemedText type="small">
          Trên iPhone, thông báo chỉ hoạt động khi KSMeals đã ở màn hình chính: mở trang này bằng Safari, bấm nút Chia sẻ
          (ô vuông có mũi tên lên) → “Thêm vào MH chính”, rồi mở KSMeals từ màn hình chính để bật.
        </ThemedText>
      ) : state === 'blocked' ? (
        <ThemedText type="small">
          Trình duyệt đang chặn thông báo của KSMeals. Mở cài đặt trang web (biểu tượng bên trái thanh địa chỉ) → Thông báo →
          Cho phép, rồi quay lại đây.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small">
            {state === 'on'
              ? `Đã bật. 6h30 mỗi ngày đi học, KSMeals báo bé ăn gì ở ${school.name}${allergies.length ? ' và nhắc món cần chú ý' : ''}.`
              : '6h30 mỗi ngày đi học, nhận thông báo bé ăn gì ở trường, kèm nhắc món có thể gây dị ứng.'}
          </ThemedText>
          <Pressable
            onPress={toggle}
            disabled={busy}
            accessibilityRole="button"
            style={[
              styles.button,
              state === 'on' ? { borderColor: theme.accent, borderWidth: 1 } : { backgroundColor: theme.accent },
            ]}>
            {busy ? (
              <ActivityIndicator size="small" color={state === 'on' ? theme.accent : theme.onAccent} />
            ) : (
              <ThemedText type="smallBold" style={{ color: state === 'on' ? theme.accent : theme.onAccent }}>
                {state === 'on' ? 'Tắt nhắc' : 'Bật nhắc mỗi sáng'}
              </ThemedText>
            )}
          </Pressable>
          {failed ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Chưa bật được, bạn thử lại sau nhé.
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  button: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minWidth: 150, alignItems: 'center' },
});
