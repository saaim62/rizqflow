import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/ui/Navbar';
import { BeginnerGuideProvider } from '@/components/ui/BeginnerDrawer';
import { ProfileProvider } from '@/components/providers/ProfileProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RizqFlow — Pakistan PSX & Sarafa Gold Dividend Life Planner',
  description:
    'Turn Pakistan Stock Exchange (PSX) blue-chip dividend machines, 24K Sarafa Gold streaks, and 5-Year Car TCO decisions into real-life financial freedom.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#090A0F] text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-300">
        <ProfileProvider>
          <BeginnerGuideProvider>
            <Navbar />
            <main className="flex-1 flex flex-col">{children}</main>

            {/* Executive Footer */}
            <footer className="border-t border-white/[0.08] bg-[#0A0C12] py-8 text-xs text-zinc-400">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="font-semibold text-white">RizqFlow Pakistan</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                      PSX · Sarafa 24K · Car TCO
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Accounts for FBR Section 150 WHT (15% Filer / 30% Non-Filer), Zakat (2.5%), quarterly payout dispersion, and 5-year vehicle total cost of ownership.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 text-[11px] text-zinc-400">
                  <span>Educational Financial Modeling Only — SECP / SEBI Non-Advisory</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="text-emerald-400 font-medium">Bismillah for Halal Barakah</span>
                </div>
              </div>
            </footer>
          </BeginnerGuideProvider>
        </ProfileProvider>
      </body>
    </html>
  );
}
