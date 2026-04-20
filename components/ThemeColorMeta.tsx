"use client";

import { useEffect } from "react";

const LIGHT_COLOR = "#ffffff";
const DARK_COLOR = "#0a0a0a";

export function ThemeColorMeta() {
  useEffect(() => {
    const updateThemeColor = () => {
      const isDark = document.documentElement.classList.contains("dark");
      const color = isDark ? DARK_COLOR : LIGHT_COLOR;

      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", color);
    };

    // Set initial value
    updateThemeColor();

    // Watch for class changes on <html>
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          updateThemeColor();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
