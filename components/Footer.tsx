import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-neutral-50 px-6 py-8 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
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

          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Terms of Service
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <p className="text-center text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
            <strong className="font-medium">Risk Disclosure:</strong> Trading tokenized stocks involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. The value of investments can go down as well as up. You should not invest more than you can afford to lose.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
          &copy; {new Date().getFullYear()} Vaulto Protocol. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
