import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-black/10 bg-white px-6 py-8 dark:border-white/10 dark:bg-black">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Image
              src="/favicon.png"
              alt="Vaulto"
              width={24}
              height={24}
              className="opacity-70"
            />
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Vaulto Protocol
            </span>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            © 2026 Vaulto Protocol. All rights reserved.
          </p>
        </div>

        <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/10">
          <p className="text-center text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
            <strong className="font-medium">Risk Disclosure:</strong> Trading tokenized stocks and digital assets involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. The value of investments can fluctuate significantly and you may lose some or all of your invested capital. Tokenized assets are subject to additional risks including smart contract vulnerabilities, blockchain network disruptions, regulatory uncertainty, and liquidity constraints. Prices may deviate from underlying asset values. Providing liquidity carries risks of impermanent loss and market volatility. This platform does not provide financial, investment, legal, or tax advice. You should conduct your own research and consult with qualified professionals before making any investment decisions. Only invest funds you can afford to lose entirely.
          </p>
        </div>
      </div>
    </footer>
  );
}
