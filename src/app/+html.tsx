import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Yalnızca web: iPhone'da "Ana Ekrana Ekle" ile tam ekran uygulama gibi açılması için. */
export default function Root({ children }: PropsWithChildren) {
  // SDK 58+: uygulama betikleri ve stiller headNodes/bodyNodes ile eklenir
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return (
    <html lang="tr" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Bulut" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#F3FAF6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0B1410" media="(prefers-color-scheme: dark)" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <title>Bulut</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body{background:#F3FAF6}@media (prefers-color-scheme: dark){body{background:#0B1410}}' }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
