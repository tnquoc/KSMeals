import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchSchools, type School } from '@/lib/api';
import { ALLERGEN, LEVEL } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

// Search without diacritics too: "le van si" finds "Lê Văn Sĩ".
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export default function SchoolScreen() {
  const theme = useTheme();
  const { school, setSchool, allergies, toggleAllergy } = useSchool();
  const [schools, setSchools] = useState<School[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (p: Promise<School[]>) =>
    p.then((rows) => {
      setSchools(rows);
      setError(null);
    }).catch((e) => setError(String(e?.message ?? e)));

  useEffect(() => {
    apply(fetchSchools());
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await apply(fetchSchools());
    setRefreshing(false);
  };

  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? schools.filter((s) => fold(`${s.name} ${s.ward}`).includes(q)) : schools;
  }, [schools, query]);

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
        placeholder="Tìm theo tên trường…"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      />
      {error ? <ThemedText style={{ color: theme.warn }}>Không tải được danh sách trường: {error}</ThemedText> : null}

      <View style={styles.list}>
        {shown.map((s) => {
          const on = s.id === school?.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setSchool(s);
                router.navigate('/');
              }}
              style={[styles.row, { backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="smallBold">{s.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{LEVEL[s.level] ?? s.level}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        KSMeals đang có thực đơn của {schools.length} trường ở TP.HCM và sẽ thêm dần. Chưa thấy trường của con bạn? Tính năng
        “Báo tôi khi có” sẽ có trong bản tới.
      </ThemedText>
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
});
