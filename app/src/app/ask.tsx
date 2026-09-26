import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoSchool } from '@/components/no-school';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { askAssistant, type ChatMessage } from '@/lib/chat';
import { useSchool } from '@/lib/school-store';

const SUGGESTIONS = [
  'Hôm nay con ăn gì?',
  'Tuần này có mấy bữa cá?',
  'Tối nay nên nấu gì để bù cho bữa trưa ở trường?',
  'Thực đơn tuần này có món nào có tôm không?',
];

// Replies may use light markdown; show it as plain text.
const plain = (s: string) =>
  s
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(\S(?:.*?\S)?)\*/g, '$1');

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export default function AskScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const { school, loaded, allergies } = useSchool();
  const [chats, setChats] = useState<Record<number, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);

  if (!loaded) return <Screen>{null}</Screen>;
  if (!school) {
    return (
      <Screen>
        <NoSchool />
      </Screen>
    );
  }

  const messages = chats[school.id] ?? [];

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setChats((c) => ({ ...c, [school.id]: next }));
    setInput('');
    setBusy(true);
    try {
      const { reply, remaining: left } = await askAssistant(school.id, next, allergies);
      setChats((c) => ({ ...c, [school.id]: [...next, { role: 'assistant', content: reply }] }));
      if (left != null) setRemaining(left);
    } catch {
      setChats((c) => ({
        ...c,
        [school.id]: [...next, { role: 'assistant', content: 'Không kết nối được trợ lý. Bạn kiểm tra mạng rồi thử lại nhé.' }],
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            <View>
              <ThemedText type="subtitle" style={styles.heading}>Hỏi AI</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Về thực đơn của {school.name}
              </ThemedText>
            </View>

            {!messages.length ? (
              <View style={styles.suggestions}>
                <ThemedText type="small" themeColor="textSecondary">Gợi ý câu hỏi:</ThemedText>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => send(s)}
                    style={[styles.suggestion, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">{s}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {messages.map((m, i) => {
              const mine = m.role === 'user';
              return (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    mine
                      ? [styles.mine, { backgroundColor: theme.accent }]
                      : [styles.theirs, { backgroundColor: theme.backgroundElement, borderColor: theme.border }],
                  ]}>
                  <ThemedText style={mine ? { color: theme.onAccent } : undefined}>{plain(m.content)}</ThemedText>
                </View>
              );
            })}
            {busy ? (
              <View style={[styles.bubble, styles.theirs, styles.typing, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ActivityIndicator size="small" />
                <ThemedText type="small" themeColor="textSecondary">Đang trả lời…</ThemedText>
              </View>
            ) : null}

            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Trợ lý AI trả lời dựa trên thực đơn trường đăng và có thể sai. Về dị ứng, hãy luôn xác nhận với nhà trường.
              {remaining != null ? ` Còn ${remaining} câu hỏi hôm nay.` : ''}
            </ThemedText>
          </ScrollView>

          <View
            style={[
              styles.inputBar,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.background,
                paddingBottom: keyboard ? Spacing.two : BottomTabInset + insets.bottom + Spacing.two,
              },
            ]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Hỏi về bữa ăn của con…"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
            />
            <Pressable
              onPress={() => send(input)}
              disabled={busy || !input.trim()}
              style={[styles.send, { backgroundColor: theme.accent, opacity: busy || !input.trim() ? 0.4 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>Gửi</ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  heading: { fontSize: 28, lineHeight: 36 },
  suggestions: { gap: Spacing.two, marginTop: Spacing.two },
  suggestion: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubble: { maxWidth: '88%', borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth },
  typing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  note: { marginTop: Spacing.two },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  send: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
});
