import './globals.css';
import 'react-loading-skeleton/dist/skeleton.css';
import { AuthProvider } from '../components/AuthProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import Navbar from '../components/Navbar';
import SlaAudioAlarm from '../components/SlaAudioAlarm';
import { getAppConfig } from '@/lib/config';
import packageInfo from '../package.json';

import { Toaster } from 'react-hot-toast';

export async function generateMetadata() {
  const config = getAppConfig();
  return {
    title: config.appName,
    description: 'Manage tickets, teams, and daily reports for NOC',
  };
}

export default function RootLayout({ children }) {
  const config = getAppConfig();
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Toaster position="top-right" />
            <Navbar appName={config.appName} appVersion={packageInfo.version} />
            <SlaAudioAlarm />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
