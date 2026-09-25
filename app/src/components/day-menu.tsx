import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { MealCard } from '@/components/meal-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Meal, SourcePost } from '@/lib/api';
import { MEAL_ORDER } from '@/lib/labels';

type Props = {
  meals: Meal[]; // meals of this day only
  sources: Record<number, SourcePost>;
};

const docLabel = (url: string) => {
  const ext = url.split('.').pop()?.toLowerCase();
  return ext === 'pdf' ? 'PDF' : ext?.startsWith('xls') ? 'Excel' : 'Word';
};

/** The school's own menu (image or file), so parents can check what we extracted. */
function OriginalMenu({ posts }: { posts: SourcePost[] }) {
  const theme = useTheme();
  const images = posts.flatMap((p) => p.image_urls);
  const docs = posts.flatMap((p) => p.doc_urls);
  if (!images.length && !docs.length) return null;

  return (
    <View style={styles.original}>
      <ThemedText type="smallBold" themeColor="textSecondary">🗒️ Thực đơn gốc của trường</ThemedText>
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.originalRow}>
          {images.map((url) => (
            <Pressable key={url} onPress={() => openBrowserAsync(url)} accessibilityLabel="Phóng to thực đơn gốc">
              <Image source={url} style={[styles.originalImage, { borderColor: theme.border }]} contentFit="cover" transition={150} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {docs.map((url) => (
        <Pressable key={url} onPress={() => openBrowserAsync(url)}>
          <ThemedText type="linkPrimary">📄 Mở file thực đơn ({docLabel(url)})</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export function DayMenu({ meals, sources }: Props) {
  const sorted = [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type));
  const posts = [...new Set(meals.map((m) => m.source_post_id))]
    .map((id) => (id != null ? sources[id] : undefined))
    .filter((p): p is SourcePost => !!p);

  if (!sorted.length) {
    return (
      <ThemedView type="backgroundElement" style={styles.empty}>
        <ThemedText themeColor="textSecondary">Trường chưa đăng thực đơn ngày này.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <View style={styles.list}>
      {sorted.map((m) => (
        <MealCard key={`${m.date}-${m.meal_type}`} meal={m} />
      ))}
      <OriginalMenu posts={posts.filter((p) => p.kind !== 'tray')} />
      {posts.map((p) => (
        <ExternalLink key={p.id} href={p.url as Href & string}>
          <ThemedText type="linkPrimary">Xem bài đăng trên website trường ↗</ThemedText>
        </ExternalLink>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  empty: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
  },
  original: {
    gap: Spacing.two,
  },
  originalRow: {
    gap: Spacing.two,
  },
  originalImage: {
    width: 200,
    height: 120,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
