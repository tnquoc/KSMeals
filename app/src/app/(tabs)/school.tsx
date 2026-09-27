import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PageHeader } from '@/components/page-header';
import { ReminderCard } from '@/components/reminder-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { fetchSchools, requestSchool, type School } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { ALLERGEN, fold, isCustomAllergy, LEVEL } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';
import { WARD_NAME } from '@/lib/wards';

const REQUESTED_KEY = 'ksmeals.requested'; // school code -> number of parents who asked (at request time)
const MAX_RESULTS = 40;
// Street address when we have one, otherwise the ward: parents still see where the school is.
const place = (s: School) => s.address || WARD_NAME[s.ward];

const FIRST_LIST = 10; // covered schools shown before the parent types anything
const MAX_CUSTOM_ALLERGIES = 5;

const RESET_TITLE = 'Xóa dữ liệu trên máy này?';
const RESET_MESSAGE =
  'Trường đã chọn, danh sách dị ứng và mã thiết bị sẽ bị xóa, ứng dụng trở về như lúc mới cài. Không thể hoàn tác.';

/** Asks before wiping local data (Alert has no buttons on web, so the browser's confirm there). */
function confirmReset(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${RESET_TITLE}\n\n${RESET_MESSAGE}`));
  return new Promise((resolve) =>
    Alert.alert(RESET_TITLE, RESET_MESSAGE, [
      { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Xóa', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

/** ✕ inside the right end of a text box; the box needs right padding for it. */
function ClearButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Xóa chữ đã gõ"
      hitSlop={8}
      style={[styles.clear, { backgroundColor: theme.border }]}>
      <ThemedText type="smallBold" style={styles.clearText}>✕</ThemedText>
    </Pressable>
  );
}

/** Section heading on a tinted band, so the two parts of the profile stand out. */
function SectionTitle({ icon, tone = 'accent', children }: { icon: string; tone?: 'accent' | 'warn'; children: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionTitle, { backgroundColor: tone === 'warn' ? theme.warnSoft : theme.backgroundSelected }]}>
      <ThemedText style={styles.sectionIcon}>{icon}</ThemedText>
      <ThemedText style={[styles.sectionText, { color: tone === 'warn' ? theme.warn : theme.accent }]}>{children}</ThemedText>
    </View>
  );
}

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

export default function SchoolScreen() {
  const theme = useTheme();
  const { school, setSchool, allergies, toggleAllergy, resetAll } = useSchool();
  const [schools, setSchools] = useState<School[]>([]);
  const [requested, setRequested] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  // With a school chosen, the search and the list stay closed until "Đổi trường".
  const [picking, setPicking] = useState(false);
  const [editingAllergies, setEditingAllergies] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [otherAllergy, setOtherAllergy] = useState('');
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
  // The saved school may predate newer fields (address): prefer the fresh directory row.
  const current = school ? (schools.find((s) => s.id === school.id) ?? school) : null;
  const q = fold(query.trim());
  const showPicker = !current || picking;
  const shown = useMemo(() => {
    if (!q) {
      // A short first list, schools in the same ward as the current one first; typing finds the rest.
      const others = schools.filter((s) => s.active && s.id !== school?.id);
      const near = others.filter((s) => s.ward === current?.ward);
      return [...near, ...others.filter((s) => s.ward !== current?.ward)].slice(0, FIRST_LIST);
    }
    // Covered schools first, then the rest of the directory.
    const hits = schools.filter((s) => fold(`${s.name} ${s.ward}`).includes(q));
    return [...hits.filter((s) => s.active), ...hits.filter((s) => !s.active)].slice(0, MAX_RESULTS);
  }, [schools, q, school, current?.ward]);

  const custom = allergies.filter(isCustomAllergy);
  const allergyNames = allergies.map((a) => ALLERGEN[a] ?? a).join(' · ');
  const addOther = () => {
    const term = otherAllergy.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (term && !allergies.some((a) => a.toLowerCase() === term.toLowerCase())) toggleAllergy(term);
    setOtherAllergy('');
  };

  const chooseSchool = (s: School) => {
    setSchool(s);
    setQuery('');
    setPicking(false);
    track('school_selected', s.code);
    router.navigate('/');
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Hồ sơ của con" />

      <View style={styles.section}>
        <SectionTitle icon="🏫">Trường của con</SectionTitle>
        {current && !picking ? (
          <View style={[styles.current, { borderColor: theme.accent, backgroundColor: theme.backgroundSelected }]}>
            <View style={styles.currentText}>
              <ThemedText type="smallBold">{current.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{LEVEL[current.level] ?? current.level}</ThemedText>
              {place(current) ? <ThemedText type="small" themeColor="textSecondary">📍 {place(current)}</ThemedText> : null}
            </View>
            <Pressable
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              style={[styles.change, { borderColor: theme.accent, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>Đổi trường</ThemedText>
            </Pressable>
          </View>
        ) : null}
        {showPicker ? (
          <View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm trường của con…"
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              autoFocus={picking}
              style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
            />
            {query ? <ClearButton onPress={() => setQuery('')} /> : null}
          </View>
        ) : null}
      </View>

      {showPicker ? (
        <>
          {error ? <ThemedText style={{ color: theme.warn }}>Không tải được danh sách trường: {error}</ThemedText> : null}
          {!q && schools.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              {activeCount} trường đang có thực đơn{shown.length < activeCount - (school ? 1 : 0) ? `, đang hiện ${shown.length} trường` : ''}.
              Không thấy trường của con? Gõ tên để tìm trong {schools.length} trường.
            </ThemedText>
          ) : null}
          {q && !shown.length && schools.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              Không tìm thấy trường nào. KSMeals hiện có các trường công lập trên hệ thống website của Sở GD&ĐT TP.HCM.
            </ThemedText>
          ) : null}
          {picking ? (
            <Pressable
              onPress={() => {
                setPicking(false);
                setQuery('');
              }}
              accessibilityRole="button">
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
                <Pressable key={s.id} onPress={() => chooseSchool(s)} style={row}>
                  <ThemedText type="smallBold">{s.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{LEVEL[s.level] ?? s.level}</ThemedText>
                  {place(s) ? <ThemedText type="small" themeColor="textSecondary">📍 {place(s)}</ThemedText> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <ReminderCard />

      {current ? (
        <View style={styles.section}>
          <SectionTitle icon="🛡️" tone="warn">Con dị ứng với</SectionTitle>
          {!editingAllergies ? (
            <Pressable
              onPress={() => setEditingAllergies(true)}
              accessibilityRole="button"
              style={[styles.summary, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <View style={styles.currentText}>
                <ThemedText type="smallBold" style={allergies.length ? { color: theme.danger } : undefined}>
                  {allergies.length ? allergyNames : 'Chưa chọn'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {allergies.length
                    ? 'App tô đỏ những món có thể gây dị ứng cho con.'
                    : 'Chọn nếu con bị dị ứng, app sẽ tô đỏ món cần chú ý.'}
                </ThemedText>
              </View>
              <ThemedText type="linkPrimary">{allergies.length ? 'Sửa' : 'Thêm'}</ThemedText>
            </Pressable>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Chọn để app tô đỏ những món mà con có thể bị dị ứng. Chỉ lưu trên máy của bạn.
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
                {custom.map((term) => (
                  <Pressable
                    key={term}
                    onPress={() => toggleAllergy(term)}
                    accessibilityRole="button"
                    accessibilityLabel={`Bỏ ${term}`}
                    style={[styles.allergy, { borderColor: theme.danger, backgroundColor: theme.dangerSoft }]}>
                    <ThemedText type="smallBold" style={{ color: theme.danger }}>✓ {term}  ✕</ThemedText>
                  </Pressable>
                ))}
              </View>
              {custom.length < MAX_CUSTOM_ALLERGIES ? (
                <View style={styles.otherRow}>
                  <View style={styles.otherBox}>
                    <TextInput
                      value={otherAllergy}
                      onChangeText={setOtherAllergy}
                      onSubmitEditing={addOther}
                      placeholder="Khác, ví dụ: thịt vịt, kiwi…"
                      placeholderTextColor={theme.textSecondary}
                      returnKeyType="done"
                      maxLength={30}
                      style={[styles.other, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
                    />
                    {otherAllergy ? <ClearButton onPress={() => setOtherAllergy('')} /> : null}
                  </View>
                  <Pressable
                    onPress={addOther}
                    disabled={!otherAllergy.trim()}
                    accessibilityRole="button"
                    style={[styles.add, { backgroundColor: theme.accent, opacity: otherAllergy.trim() ? 1 : 0.4 }]}>
                    <ThemedText type="smallBold" style={{ color: theme.onAccent }}>Thêm</ThemedText>
                  </Pressable>
                </View>
              ) : null}
              {custom.length ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Mục tự thêm được dò theo tên món và nguyên liệu thường dùng, nên có thể sót. Hãy xác nhận với nhà trường.
                </ThemedText>
              ) : null}
              <Pressable
                onPress={() => {
                  addOther();
                  setEditingAllergies(false);
                }}
                accessibilityRole="button"
                style={[styles.done, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>Xong</ThemedText>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      <View style={[styles.about, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          KSMeals là ứng dụng độc lập, không phải ứng dụng chính thức của Sở GD&ĐT TP.HCM hay nhà trường. Thực đơn lấy từ
          website công khai của các trường.
        </ThemedText>
        <Link href="/privacy">
          <ThemedText type="linkPrimary">Chính sách quyền riêng tư ›</ThemedText>
        </Link>
        <Pressable
          onPress={async () => {
            if (!(await confirmReset())) return;
            await resetAll();
            setRequested({});
            setQuery('');
            setPicking(false);
            setEditingAllergies(false);
            setOtherAllergy('');
            router.navigate('/');
          }}
          accessibilityRole="button">
          <ThemedText type="small" style={{ color: theme.danger }}>Xóa dữ liệu trên máy này</ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sectionIcon: { fontSize: 18, lineHeight: 24 },
  sectionText: { fontSize: 17, lineHeight: 24, fontWeight: 700 },
  otherRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  otherBox: { flex: 1 },
  other: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.five + Spacing.two, // room for the clear button
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  add: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  currentText: { flex: 1, gap: 2 },
  change: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  done: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  clear: {
    position: 'absolute',
    right: Spacing.two + 2,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 12, lineHeight: 14 },
  allergyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  allergy: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
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
  about: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three, marginTop: Spacing.three, gap: Spacing.one },
  request: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    marginTop: Spacing.two,
  },
});
