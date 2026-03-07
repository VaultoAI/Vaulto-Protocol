import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Providers } from "@/components/Providers";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaulto — The Future of Private Investing",
  description:
    "Trade, earn, and invest in tokenized private company stocks. Access pre-IPO companies like SpaceX, Stripe, and more.",
  icons: {
    icon: "/favicon.png",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Sidebar />
            <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-6">
              <ThemeSwitch />
              <ConnectWalletButton />
            </header>
            <main className="ml-0 flex-1 p-8 pt-24 md:ml-48 md:pt-8">{children}</main>
            <div className="md:ml-48">
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
