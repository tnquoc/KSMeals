import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchSchools, requestSchool, type School } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { ALLERGEN, LEVEL } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

const REQUESTED_KEY = 'ksmeals.requested'; // school code -> number of parents who asked (at request time)
const MAX_RESULTS = 40;

// Search without diacritics too: "le van si" finds "Lê Văn Sĩ".
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

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

export default function SchoolScreen() {
  const theme = useTheme();
  const { school, setSchool, allergies, toggleAllergy } = useSchool();
  const [schools, setSchools] = useState<School[]>([]);
  const [requested, setRequested] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (p: Promise<School[]>) =>
    p
      .then((rows) => {
        setSchools(rows);
        setError(null);
      })
      .catch((e) => setError(String(e?.message ?? e)));

  useEffect(() => {
    apply(fetchSchools());
    AsyncStorage.getItem(REQUESTED_KEY)
      .then((raw) => raw && setRequested(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await apply(fetchSchools());
    setRefreshing(false);
  };

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
    if (!q) return schools.filter((s) => s.active);
    // Covered schools first, then the rest of the directory.
    const hits = schools.filter((s) => fold(`${s.name} ${s.ward}`).includes(q));
    return [...hits.filter((s) => s.active), ...hits.filter((s) => !s.active)].slice(0, MAX_RESULTS);
  }, [schools, q]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ThemedText type="subtitle" style={styles.heading}>Hồ sơ của con</ThemedText>

      <View style={styles.section}>
        <ThemedText type="smallBold">Con dị ứng với</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Chọn để app tô đỏ những món có thể chứa các chất này. Chỉ lưu trên máy của bạn.
        </ThemedText>
        <View style={styles.allergyGrid}>
          {Object.entries(ALLERGEN).map(([id, label]) => {
            const on = allergies.includes(id);
            return (
              <Pressable
                key={id}
                onPress={() => toggleAllergy(id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[
                  styles.allergy,
                  { borderColor: on ? theme.danger : theme.border, backgroundColor: on ? theme.dangerSoft : theme.backgroundElement },
                ]}>
                <ThemedText type="smallBold" style={{ color: on ? theme.danger : theme.text }}>
                  {on ? '✓ ' : ''}
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ThemedText type="smallBold">Trường của con{school ? `: ${school.name}` : ''}</ThemedText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Tìm trong tất cả trường công TP.HCM…"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      />
      {error ? <ThemedText style={{ color: theme.warn }}>Không tải được danh sách trường: {error}</ThemedText> : null}
      {!q && schools.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {activeCount} trường đang có thực đơn. Không thấy trường của con? Gõ tên để tìm trong {schools.length} trường.
        </ThemedText>
      ) : null}
      {q && !shown.length && schools.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          Không tìm thấy trường nào. KSMeals hiện có các trường công lập trên hệ thống website của Sở GD&ĐT TP.HCM.
        </ThemedText>
      ) : null}

      <View style={styles.list}>
        {shown.map((s) => {
          const on = s.id === school?.id;
          const row = [styles.row, { backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement, borderColor: theme.border }];
          if (!s.active) {
            return (
              <View key={s.id} style={row}>
                <ThemedText type="smallBold">{s.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {LEVEL[s.level] ?? s.level} · Chưa có thực đơn trên KSMeals
                </ThemedText>
                <RequestButton school={s} count={requested[s.code]} onDone={(n) => markRequested(s.code, n)} />
              </View>
            );
          }
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setSchool(s);
                router.navigate('/');
              }}
              style={row}>
              <ThemedText type="smallBold">{s.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{LEVEL[s.level] ?? s.level}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 28, lineHeight: 36 },
  section: { gap: Spacing.two },
  allergyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  allergy: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
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
