import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import Navbar from '../components/Navbar';
import { getAppConfig } from '@/lib/config';

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
            <Navbar appName={config.appName} />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
