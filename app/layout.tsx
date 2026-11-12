import type { ReactNode } from 'react';
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/vietnamese-500.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/vietnamese-400.css';
import '@fontsource/nunito/vietnamese-600.css';
import '@fontsource/nunito/vietnamese-700.css';
import './globals.css';
import RightClickAsLeft from '@/components/RightClickAsLeft';

export const metadata = {
  title: 'ABC play - Kid zone!',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-us">
      <body>
        <RightClickAsLeft />
        {children}
      </body>
    </html>
  );
}
