export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background px-6 py-3">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        <p className="text-xs text-muted">
          © 2025 Vaulto Protocol. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://legal.vaulto.ai/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            Privacy Policy
          </a>
          <a
            href="https://legal.vaulto.ai/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
