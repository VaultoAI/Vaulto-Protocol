import Image from "next/image";
import Link from "next/link";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Image
              src="/vaulto-logo-light.png"
              alt="Vaulto"
              width={120}
              height={32}
              className="mb-4 h-8 w-auto"
            />
            <p className="text-sm text-[var(--muted)]">
              The future of private company investing.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              Product
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://search.vaulto.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Search
                </a>
              </li>
              <li>
                <a
                  href="https://swap.vaulto.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Swap
                </a>
              </li>
              <li>
                <a
                  href="https://ramp.vaulto.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Ramp
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              Resources
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/vaultoai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://api.vaulto.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://legal.vaulto.ai/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="https://legal.vaulto.ai/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-[var(--border)] pt-8">
          <p className="text-center text-sm text-[var(--muted)]">
            &copy; {currentYear} Vaulto Protocol. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
