import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CONTACT_EMAIL, PRIVACY_UPDATED } from '@/lib/app-info';
import { getDeviceId } from '@/lib/device';

// Keep this page in sync with what the code actually does (lib/analytics.ts, lib/chat.ts,
// lib/school-store.tsx, supabase/functions/chat).
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'KSMeals là gì',
    body: [
      'KSMeals là ứng dụng độc lập do một nhà phát triển cá nhân xây dựng, giúp phụ huynh xem thực đơn bán trú của trường con.',
      'KSMeals không phải ứng dụng chính thức của Sở Giáo dục và Đào tạo TP.HCM hay của nhà trường.',
      'Thực đơn và hình ảnh được lấy từ website công khai của các trường. Bản quyền nội dung và hình ảnh thuộc về nhà trường; mỗi thực đơn đều có liên kết về bài gốc.',
    ],
  },
  {
    title: 'KSMeals không thu thập',
    body: ['Không có tài khoản. KSMeals không hỏi và không lưu tên, số điện thoại, email, danh bạ, vị trí hay ảnh của bạn và con bạn.'],
  },
  {
    title: 'Lưu trên thiết bị của bạn',
    body: [
      'Trường đã chọn, danh sách dị ứng của con, các trường bạn đã bấm "Báo tôi khi có", và một mã thiết bị ẩn danh (chuỗi ngẫu nhiên, không gắn với danh tính).',
      'Những thông tin này bị xóa khi bạn gỡ ứng dụng hoặc xóa dữ liệu trình duyệt.',
    ],
  },
  {
    title: 'Gửi lên máy chủ',
    body: [
      'Thống kê sử dụng: mã thiết bị ẩn danh, tên sự kiện (mở ứng dụng, xem ngày/tuần, chia sẻ, dùng trợ lý AI...), mã trường và hệ điều hành. Không kèm nội dung câu hỏi.',
      'Khi dùng "Hỏi AI": câu hỏi, mã trường và các nhóm dị ứng bạn đã chọn được gửi tới máy chủ KSMeals (Supabase, Singapore) và Google Gemini để tạo câu trả lời. KSMeals không lưu nội dung câu hỏi, chỉ đếm số câu mỗi ngày để giới hạn. Google xử lý dữ liệu theo điều khoản Gemini API và có thể dùng dữ liệu gửi qua gói miễn phí để cải thiện sản phẩm. Vì vậy, đừng nhập tên hay thông tin cá nhân của con vào ô hỏi.',
      'Khi bấm "Báo tôi khi có": mã thiết bị ẩn danh và mã trường.',
    ],
  },
  {
    title: 'Sử dụng dữ liệu',
    body: [
      'Chỉ để vận hành và cải thiện KSMeals (ví dụ: biết trường nào được quan tâm để thêm dữ liệu). KSMeals không bán dữ liệu, không chia sẻ cho quảng cáo và không hiển thị quảng cáo.',
    ],
  },
  {
    title: 'Thông tin chỉ để tham khảo',
    body: [
      'Dinh dưỡng là ước tính bằng AI. Nhãn dị ứng được dò theo tên món và nguyên liệu thường dùng, có thể thiếu hoặc thừa. Đây không phải tư vấn y tế; nếu con bị dị ứng, hãy xác nhận với nhà trường.',
    ],
  },
  {
    title: 'Trẻ em',
    body: ['KSMeals dành cho phụ huynh, không dành cho trẻ em tự sử dụng.'],
  },
  {
    title: 'Xóa dữ liệu, gỡ nội dung, liên hệ',
    body: [
      'Để xóa dữ liệu trên máy chủ, gửi mã thiết bị bên dưới tới email liên hệ. Nhà trường hoặc phụ huynh muốn gỡ một thực đơn hay hình ảnh cũng liên hệ qua email này.',
    ],
  },
];

export default function PrivacyScreen() {
  const [deviceId, setDeviceId] = useState('');
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  return (
    <Screen>
      <ThemedText type="subtitle" style={styles.heading}>Chính sách quyền riêng tư</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">Cập nhật: {PRIVACY_UPDATED}</ThemedText>
      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <ThemedText type="smallBold">{s.title}</ThemedText>
          {s.body.map((p) => (
            <ThemedText key={p} type="small">{p}</ThemedText>
          ))}
        </View>
      ))}
      <View style={styles.section}>
        <ThemedText type="smallBold">Liên hệ</ThemedText>
        <ThemedText type="small">Email: {CONTACT_EMAIL || 'đang cập nhật'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" selectable>
          Mã thiết bị của bạn: {deviceId || '…'}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 26, lineHeight: 34 },
  section: { gap: Spacing.one },
});
