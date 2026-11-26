"use client";

import { useEffect, useRef } from "react";
import { DARK_THEME_QUERY, THEME_STORAGE_KEY, useTheme } from "@scoutreporter/ui/components/ThemeSwitcher";

// Activate the selected srcset as the HTML arrives. Browsers cannot request either variant
// from the data attributes, and the script runs before the app hydrates.
const INITIAL_SOURCE = `(() => {
  const img = document.currentScript.previousElementSibling;
  let choice;
  try { choice = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch {}
  const dark = choice === "dark" || (choice !== "light" && matchMedia(${JSON.stringify(DARK_THEME_QUERY)}).matches);
  const srcSet = dark ? img.dataset.dark : img.dataset.light;
  if (img.fetchPriority === "high") {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.fetchPriority = "high";
    preload.imageSrcset = srcSet;
    preload.imageSizes = img.sizes;
    document.head.append(preload);
  }
  img.srcset = srcSet;
})();`;

export function ThemedScreenshotImage({
  alt, sizes, width, height, lightSrcSet, darkSrcSet, priority, className,
}: {
  alt: string;
  sizes: string;
  width: number;
  height: number;
  lightSrcSet: string;
  darkSrcSet: string;
  priority: boolean;
  className: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const theme = useTheme();

  // Also runs on client navigation, where React inserts the script without executing it.
  useEffect(() => {
    if (!image.current || theme === null) return;
    const srcSet = theme === "dark" ? darkSrcSet : lightSrcSet;
    if (image.current.srcset !== srcSet) image.current.srcset = srcSet;
  }, [theme, darkSrcSet, lightSrcSet]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies optimized sources. */}
      <img
        ref={image}
        alt={alt}
        sizes={sizes}
        width={width}
        height={height}
        data-light={lightSrcSet}
        data-dark={darkSrcSet}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={`${className} [&:not([srcset])]:hidden`}
        suppressHydrationWarning
      />
      <script dangerouslySetInnerHTML={{ __html: INITIAL_SOURCE }} />
    </>
  );
}
