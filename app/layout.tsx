import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaulto — LP for Tokenized Stocks",
  description: "Provide liquidity and earn on tokenized stock pools.",
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
          <Sidebar />
          <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-6">
            <ThemeSwitch />
            <ConnectWalletButton />
          </header>
          <main className="ml-48 min-h-screen p-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
