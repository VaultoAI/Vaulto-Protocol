"use client";

import { useEffect, useState } from "react";

export function GeoRestrictBanner() {
  const [isUS, setIsUS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for ?geo=US query param (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const geoParam = urlParams.get("geo");

    // Check for geo cookie set by middleware
    const cookies = document.cookie.split(";");
    const geoCookie = cookies.find((c) => c.trim().startsWith("geo-country="));
    const cookieCountry = geoCookie ? geoCookie.split("=")[1]?.trim() : null;

    // Use query param override or cookie value
    const country = geoParam || cookieCountry;

    if (country === "US") {
      // Check if user has dismissed the banner this session
      const wasDismissed = sessionStorage.getItem("geo-banner-dismissed");
      if (!wasDismissed) {
        setIsUS(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("geo-banner-dismissed", "true");
  };

  if (!isUS || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/40 backdrop-blur-sm text-amber-950 dark:text-amber-200 text-center text-sm py-2 px-4 md:left-48">
      <div className="flex items-center justify-center gap-2">
        <span className="flex-1 md:flex-none">Platform has limited functionality for US persons.</span>
        <button
          type="button"
          onClick={handleDismiss}
          className="hidden md:block ml-2 p-2 -m-2 text-amber-950/70 hover:text-amber-950 active:text-amber-950 dark:text-amber-200/70 dark:hover:text-amber-200 touch-manipulation"
          aria-label="Dismiss"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
