import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchSchools, type School } from '@/lib/api';
import { LEVEL } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

// Search without diacritics too: "le van si" finds "Lê Văn Sĩ".
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export default function SchoolScreen() {
  const theme = useTheme();
  const { school, setSchool } = useSchool();
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
      <ThemedText type="subtitle" style={styles.heading}>Chọn trường</ThemedText>
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
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  list: { gap: Spacing.two },
  row: { borderRadius: Spacing.three, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: 2 },
});
