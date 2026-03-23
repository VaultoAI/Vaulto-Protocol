import type { Metadata } from "next";
import { TopNav } from "@/components/TopNav";
import { Providers } from "@/components/Providers";
import { Footer } from "@/components/Footer";
import { GeoRestrictBanner } from "@/components/GeoRestrictBanner";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { auth } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaulto — The Future of Private Investing",
  description:
    "Trade, earn, and invest in tokenized private company stocks. Access pre-IPO companies like SpaceX, Stripe, and more.",
  icons: {
    icon: "/favicon.png",
  },
  metadataBase: new URL("https://protocol.vaulto.ai"),
  openGraph: {
    title: "Vaulto — Trade Faster & Smarter",
    description: "Join the waitlist for early access to tokenized private company stocks. Trade pre-IPO companies like SpaceX, Anduril, and more.",
    url: "https://protocol.vaulto.ai",
    siteName: "Vaulto Protocol",
    images: [
      {
        url: "/socialbanner.png",
        width: 1200,
        height: 630,
        alt: "Vaulto - Trade faster & smarter",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaulto — Trade Faster & Smarter",
    description: "Join the waitlist for early access to tokenized private company stocks. Trade pre-IPO companies like SpaceX, Anduril, and more.",
    images: ["/socialbanner.png"],
  },
};

const themeScript = `
(function(){
  var t=localStorage.getItem('theme');
  var d=document.documentElement;
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark');}
  else{d.classList.remove('dark');}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isVaultoEmployee = process.env.NODE_ENV === "development" || session?.user?.isVaultoEmployee === true;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <GeoRestrictBanner />
          {isVaultoEmployee ? (
            // Full platform layout with top navbar
            <div className="flex min-h-screen flex-col">
              <TopNav />
              <main className="flex-1">
                <div className="mx-auto max-w-[1400px] px-6 py-6">
                  {children}
                </div>
              </main>
              <Footer />
            </div>
          ) : (
            // Minimal layout for non-employees (waitlist users)
            <div className="flex min-h-screen flex-col">
              <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-6">
                <ThemeSwitch />
              </header>
              <main className="flex-1">{children}</main>
            </div>
          )}
        </Providers>
      </body>
    </html>
  );
}
