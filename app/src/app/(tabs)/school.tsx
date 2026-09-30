import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ClearButton } from '@/components/clear-button';
import { PageHeader } from '@/components/page-header';
import { ReminderCard } from '@/components/reminder-card';
import { place, SchoolPicker } from '@/components/school-picker';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSchools } from '@/hooks/use-schools';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { type School } from '@/lib/api';
import { ALLERGEN, isCustomAllergy, LEVEL } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

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

export default function SchoolScreen() {
  const theme = useTheme();
  const { school, setSchool, allergies, toggleAllergy, resetAll } = useSchool();
  const { schools, error, reload } = useSchools();
  // Bumped after "Xóa dữ liệu": a fresh picker forgets the typed search and the requests sent.
  const [pickerKey, setPickerKey] = useState(0);
  // With a school chosen, the search and the list stay closed until "Đổi trường".
  const [picking, setPicking] = useState(false);
  const [editingAllergies, setEditingAllergies] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [otherAllergy, setOtherAllergy] = useState('');

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  // The saved school may predate newer fields (address): prefer the fresh directory row.
  const current = school ? (schools.find((s) => s.id === school.id) ?? school) : null;
  const showPicker = !current || picking;

  const custom = allergies.filter(isCustomAllergy);
  const allergyNames = allergies.map((a) => ALLERGEN[a] ?? a).join(' · ');
  const addOther = () => {
    const term = otherAllergy.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (term && !allergies.some((a) => a.toLowerCase() === term.toLowerCase())) toggleAllergy(term);
    setOtherAllergy('');
  };

  const chooseSchool = (s: School) => {
    setSchool(s);
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
      </View>

      {showPicker ? (
        <SchoolPicker
          key={pickerKey}
          schools={schools}
          error={error}
          current={current}
          onChoose={chooseSchool}
          onCancel={picking ? () => setPicking(false) : undefined}
          autoFocus={picking}
        />
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
            setPickerKey((k) => k + 1);
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
  allergyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  allergy: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  about: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three, marginTop: Spacing.three, gap: Spacing.one },
});
