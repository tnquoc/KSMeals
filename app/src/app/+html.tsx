import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Root HTML for the web build (rendered in Node at build time, no browser APIs here).
// Links are relative so they work under the GitHub Pages base path (/KSMeals/).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>KSMeals · Thực đơn bán trú</title>
        <meta
          name="description"
          content="Xem thực đơn bán trú của trường con mỗi ngày, kèm dinh dưỡng ước tính, cảnh báo dị ứng và trợ lý AI."
        />
        <meta name="theme-color" content="#1F7A4D" />
        {/* "Add to Home Screen" on iPhone opens full screen with our icon and name */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="KSMeals" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="apple-touch-icon.png" />
        <link rel="manifest" href="manifest.webmanifest" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
