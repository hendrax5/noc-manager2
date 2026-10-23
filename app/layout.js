import './ui-tokens.css';
import './globals.css';
import './legacy-ui.css';
import './ui-foundation.css';
import 'react-loading-skeleton/dist/skeleton.css';
import { AuthProvider } from '../components/AuthProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import Navbar from '../components/Navbar';
import SlaAudioAlarm from '../components/SlaAudioAlarm';
import { getAppConfig } from '@/lib/config';
import packageInfo from '../package.json';
import { Toaster } from 'react-hot-toast';

export async function generateMetadata() {
  const config = await getAppConfig();
  return {
    title: config.appName,
    description: 'Manage tickets, teams, and daily reports for NOC',
  };
}

export default async function RootLayout({ children }) {
  const config = await getAppConfig();
  return (
    <html lang="id">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3200,
                style: {
                  fontFamily: "var(--font-sans), system-ui, sans-serif",
                  fontSize: "0.9rem",
                  borderRadius: "0.65rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--card-bg)",
                  color: "var(--heading-color)",
                },
                success: { iconTheme: { primary: "var(--ui-success)", secondary: "var(--ui-on-accent)" } },
                error: { iconTheme: { primary: "var(--ui-danger)", secondary: "var(--ui-on-accent)" } },
              }}
            />
            <Navbar appName={config.appName} appVersion={packageInfo.version} />
            <SlaAudioAlarm />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
