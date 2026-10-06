import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ClearButton } from '@/components/clear-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { requestSchool, type School } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { fold, LEVEL } from '@/lib/labels';
import { WARD_NAME } from '@/lib/wards';

const REQUESTED_KEY = 'ksmeals.requested'; // school code -> number of parents who asked (at request time)
const MAX_RESULTS = 40;
const FIRST_LIST = 10; // covered schools shown before the parent types anything

// Street address when we have one, otherwise the ward: parents still see where the school is.
export const place = (s: School) => s.address || WARD_NAME[s.ward];

function RequestButton({ school, count, onDone }: { school: School; count?: number; onDone: (n: number) => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (count != null) {
    return (
      <ThemedText type="small" style={{ color: theme.accent }}>
        ✓ Đã ghi nhận{count > 1 ? `, cùng ${count - 1} phụ huynh khác` : ''}. KSMeals sẽ ưu tiên thêm trường này.
      </ThemedText>
    );
  }
  return (
    <Pressable
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        setFailed(false);
        try {
          onDone(await requestSchool(await getDeviceId(), school.code));
          track('school_requested', school.code);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
      style={[styles.request, { borderColor: theme.accent }]}>
      {busy ? (
        <ActivityIndicator size="small" />
      ) : (
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {failed ? 'Chưa gửi được, bấm để thử lại' : '🔔 Báo tôi khi có'}
        </ThemedText>
      )}
    </Pressable>
  );
}

type Props = {
  schools: School[];
  error: string | null;
  onChoose: (s: School) => void;
  current?: School | null; // left out of the list; schools in its ward come first
  onCancel?: () => void; // "Giữ trường hiện tại"
  autoFocus?: boolean;
  source: 'home' | 'profile'; // where the picker is shown, for the search event
};

/** Search box + list of schools: covered ones can be chosen, the others can be asked for. */
export function SchoolPicker({ schools, error, onChoose, current, onCancel, autoFocus, source }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [requested, setRequested] = useState<Record<string, number>>({});
  const searched = useRef(false);

  const onQuery = (text: string) => {
    setQuery(text);
    // Once per picker: someone typed. Only the fact is sent, never the text.
    if (text.trim() && !searched.current) {
      searched.current = true;
      track('school_search', current?.code, { from: source });
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(REQUESTED_KEY)
      .then((raw) => raw && setRequested(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const markRequested = (code: string, count: number) => {
    setRequested((r) => {
      const next = { ...r, [code]: count };
      AsyncStorage.setItem(REQUESTED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const activeCount = schools.filter((s) => s.active).length;
  const q = fold(query.trim());
  const shown = useMemo(() => {
    if (!q) {
      // A short first list, schools in the same ward as the current one first; typing finds the rest.
      const others = schools.filter((s) => s.active && s.id !== current?.id);
      const near = others.filter((s) => s.ward === current?.ward);
      return [...near, ...others.filter((s) => s.ward !== current?.ward)].slice(0, FIRST_LIST);
    }
    // Covered schools first, then the rest of the directory.
    const hits = schools.filter((s) => fold(`${s.name} ${s.ward}`).includes(q));
    return [...hits.filter((s) => s.active), ...hits.filter((s) => !s.active)].slice(0, MAX_RESULTS);
  }, [schools, q, current?.id, current?.ward]);

  return (
    <>
      <View>
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Tìm trường của con…"
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          autoFocus={autoFocus}
          style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        />
        {query ? <ClearButton onPress={() => setQuery('')} /> : null}
      </View>

      {error ? <ThemedText style={{ color: theme.warn }}>Không tải được danh sách trường: {error}</ThemedText> : null}
      {!q && schools.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {activeCount} trường đang có thực đơn{shown.length < activeCount - (current ? 1 : 0) ? `, đang hiện ${shown.length} trường` : ''}.
          Không thấy trường của con? Gõ tên để tìm trong {schools.length} trường.
        </ThemedText>
      ) : null}
      {q && !shown.length && schools.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          Không tìm thấy trường nào. KSMeals hiện có các trường công lập trên hệ thống website của Sở GD&ĐT TP.HCM.
        </ThemedText>
      ) : null}
      {onCancel ? (
        <Pressable onPress={onCancel} accessibilityRole="button">
          <ThemedText type="linkPrimary">Giữ trường hiện tại</ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {shown.map((s) => {
          const row = [styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];
          if (!s.active) {
            return (
              <View key={s.id} style={row}>
                <ThemedText type="smallBold">{s.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {LEVEL[s.level] ?? s.level} · Chưa có thực đơn trên KSMeals
                </ThemedText>
                {place(s) ? <ThemedText type="small" themeColor="textSecondary">📍 {place(s)}</ThemedText> : null}
                <RequestButton school={s} count={requested[s.code]} onDone={(n) => markRequested(s.code, n)} />
              </View>
            );
          }
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setQuery('');
                onChoose(s);
              }}
              style={row}>
              <ThemedText type="smallBold">{s.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{LEVEL[s.level] ?? s.level}</ThemedText>
              {place(s) ? <ThemedText type="small" themeColor="textSecondary">📍 {place(s)}</ThemedText> : null}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.five + Spacing.two, // room for the clear button
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  list: { gap: Spacing.two },
  row: { borderRadius: Spacing.three, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: 2 },
  request: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    marginTop: Spacing.two,
  },
});
