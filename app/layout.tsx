import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Providers } from "@/components/Providers";
import { Footer } from "@/components/Footer";
import { GeoRestrictBanner } from "@/components/GeoRestrictBanner";
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
  // Server-side session check - no loading state needed
  const session = await auth();
  const isVaultoEmployee = process.env.NODE_ENV === "development" || session?.user?.isVaultoEmployee === true;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <GeoRestrictBanner />
          {isVaultoEmployee ? (
            // Full platform layout for Vaulto employees
            <div className="flex min-h-screen flex-col">
              <Sidebar />
              <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-14 md:pt-14">
                <ThemeSwitch />
                <ConnectWalletButton />
              </header>
              <main className="ml-0 flex-1 p-8 pt-28 md:ml-48 md:pt-14">{children}</main>
              <div className="md:ml-48">
                <Footer />
              </div>
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
