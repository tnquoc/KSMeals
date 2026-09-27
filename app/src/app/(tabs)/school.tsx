import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { fetchSchools, requestSchool, type School } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { ALLERGEN, LEVEL } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

const REQUESTED_KEY = 'ksmeals.requested'; // school code -> number of parents who asked (at request time)
const MAX_RESULTS = 40;

// Search without diacritics too: "le van si" finds "Lê Văn Sĩ".
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Section heading on a tinted band, so the two parts of the profile stand out. */
function SectionTitle({ icon, children }: { icon: string; children: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionTitle, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.sectionIcon}>{icon}</ThemedText>
      <ThemedText style={[styles.sectionText, { color: theme.accent }]}>{children}</ThemedText>
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
  const { school, setSchool, allergies, toggleAllergy } = useSchool();
  const [schools, setSchools] = useState<School[]>([]);
  const [requested, setRequested] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [browsing, setBrowsing] = useState(false); // list every covered school without searching
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
  const shown = useMemo(() => {
    // With a school chosen, the long list only shows on request: searching is the quicker way.
    if (!q) return school && !browsing ? [] : schools.filter((s) => s.active);
    // Covered schools first, then the rest of the directory.
    const hits = schools.filter((s) => fold(`${s.name} ${s.ward}`).includes(q));
    return [...hits.filter((s) => s.active), ...hits.filter((s) => !s.active)].slice(0, MAX_RESULTS);
  }, [schools, q, school, browsing]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Hồ sơ của con" />

      <View style={styles.section}>
        <SectionTitle icon="🛡️">Con dị ứng với</SectionTitle>
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
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle icon="🏫">Trường của con</SectionTitle>
        {current ? (
          <View style={[styles.current, { borderColor: theme.accent, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">✓ {current.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{LEVEL[current.level] ?? current.level}</ThemedText>
            {current.address ? <ThemedText type="small" themeColor="textSecondary">📍 {current.address}</ThemedText> : null}
          </View>
        ) : null}
        <View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={school ? 'Đổi trường: gõ tên trường…' : 'Tìm trong tất cả trường công TP.HCM…'}
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Xóa ô tìm kiếm"
              hitSlop={8}
              style={[styles.clear, { backgroundColor: theme.border }]}>
              <ThemedText type="smallBold" style={styles.clearText}>✕</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? <ThemedText style={{ color: theme.warn }}>Không tải được danh sách trường: {error}</ThemedText> : null}
      {!q && schools.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {activeCount} trường đang có thực đơn. Không thấy trường của con? Gõ tên để tìm trong {schools.length} trường.
        </ThemedText>
      ) : null}
      {!q && school && schools.length ? (
        <Pressable onPress={() => setBrowsing((b) => !b)} accessibilityRole="button">
          <ThemedText type="linkPrimary">
            {browsing ? 'Ẩn danh sách ▴' : `Xem ${activeCount} trường đang có thực đơn ▾`}
          </ThemedText>
        </Pressable>
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
                {s.address ? <ThemedText type="small" themeColor="textSecondary">📍 {s.address}</ThemedText> : null}
                <RequestButton school={s} count={requested[s.code]} onDone={(n) => markRequested(s.code, n)} />
              </View>
            );
          }
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setSchool(s);
                setQuery('');
                setBrowsing(false);
                track('school_selected', s.code);
                router.navigate('/');
              }}
              style={row}>
              <ThemedText type="smallBold">{s.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{LEVEL[s.level] ?? s.level}</ThemedText>
              {s.address ? <ThemedText type="small" themeColor="textSecondary">📍 {s.address}</ThemedText> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.about, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          KSMeals là ứng dụng độc lập, không phải ứng dụng chính thức của Sở GD&ĐT TP.HCM hay nhà trường. Thực đơn lấy từ
          website công khai của các trường.
        </ThemedText>
        <Link href="/privacy">
          <ThemedText type="linkPrimary">Chính sách quyền riêng tư ›</ThemedText>
        </Link>
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
  current: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: 2 },
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
