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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { NoSchool } from '@/components/no-school';
import { PageHeader } from '@/components/page-header';
import { SchoolPill } from '@/components/school-pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { askAssistant, type ChatMessage } from '@/lib/chat';
import { useSchool } from '@/lib/school-store';

const SUGGESTIONS = [
  'Hôm nay con ăn gì?',
  'Tuần này có mấy bữa cá?',
  'Tối nay nên nấu gì để bù cho bữa trưa ở trường?',
  'Thực đơn tuần này có món nào có tôm không?',
];

const ASSISTANT_NAME = 'Trợ lý KSMeals';

/** An assistant bubble with the KSMeals icon beside it; the name only above the first one. */
function AssistantRow({ first, children }: { first?: boolean; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.assistantRow}>
      <Logo size={30} />
      <View style={styles.assistantBody}>
        {first ? (
          <ThemedText type="smallBold" style={[styles.assistantName, { color: theme.accent }]}>
            {ASSISTANT_NAME}
          </ThemedText>
        ) : null}
        <View style={[styles.bubble, styles.theirs, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {children}
        </View>
      </View>
    </View>
  );
}

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

  const messages = school ? (chats[school.id] ?? []) : [];

  const send = async (text: string) => {
    const question = text.trim();
    if (!school || !question || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setChats((c) => ({ ...c, [school.id]: next }));
    setInput('');
    setBusy(true);
    track('chat_sent', school.code, { suggested: SUGGESTIONS.includes(question), turn: next.length });
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

  // Opened from "Gợi ý bữa tối" on the Today tab: ask that question once, then drop it from the URL.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!q || !school || busy || asked.current === q) return;
    asked.current = q;
    send(q);
    router.setParams({ q: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, school, busy]);

  // Local data was cleared (dev reset): forget the conversations too.
  if (loaded && !school && Object.keys(chats).length) {
    setChats({});
    setRemaining(null);
  }

  if (!loaded) return <Screen>{null}</Screen>;
  if (!school) {
    return (
      <Screen>
        <NoSchool message="Chọn trường của con để hỏi trợ lý AI về thực đơn, dinh dưỡng và các món có thể gây dị ứng." />
      </Screen>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            <PageHeader title="Hỏi AI">
              <ThemedText type="small" themeColor="textSecondary">Hỏi về thực đơn của trường:</ThemedText>
              <SchoolPill />
            </PageHeader>

            {!messages.length ? (
              <AssistantRow first>
                <ThemedText>
                  Chào ba mẹ, em là trợ lý của KSMeals. Em trả lời theo thực đơn {school.name} đăng, về món ăn, dinh dưỡng, món
                  cần tránh khi bé dị ứng, hay gợi ý bữa tối ở nhà.
                </ThemedText>
              </AssistantRow>
            ) : null}

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

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <View key={i} style={[styles.bubble, styles.mine, { backgroundColor: theme.accent }]}>
                  <ThemedText style={{ color: theme.onAccent }}>{plain(m.content)}</ThemedText>
                </View>
              ) : (
                <AssistantRow key={i} first={i === messages.findIndex((x) => x.role === 'assistant')}>
                  <ThemedText>{plain(m.content)}</ThemedText>
                </AssistantRow>
              ),
            )}
            {busy ? (
              <AssistantRow first={!messages.some((m) => m.role === 'assistant')}>
                <View style={styles.typing}>
                  <ActivityIndicator size="small" />
                  <ThemedText type="small" themeColor="textSecondary">Đang trả lời…</ThemedText>
                </View>
              </AssistantRow>
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
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  assistantBody: { flex: 1, gap: 2 },
  assistantName: { fontSize: 12, marginLeft: Spacing.one },
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
