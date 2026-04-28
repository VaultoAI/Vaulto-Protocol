import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeColorMeta } from "@/components/ThemeColorMeta";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const themeScript = `
(function(){
  var path = window.location.pathname;
  var isPublicRoute = path === '/' || path === '/waitlist';
  if (isPublicRoute) return;

  var t = localStorage.getItem('theme');
  var d = document.documentElement;
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){
    d.classList.add('dark');
  } else {
    d.classList.remove('dark');
  }
})();
`;

/**
 * Root layout - minimal, no auth, no providers.
 * Route group layouts handle providers and auth checks.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeColorMeta />
        {children}
      </body>
    </html>
  );
}
