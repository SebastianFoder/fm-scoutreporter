import Image from "next/image";
import type { ScreenshotInfo } from "@/lib/screenshots";

/**
 * An app screenshot (lib/screenshots.ts) in the site's current theme: the light and the dark
 * picture are both in the page, and the theme switch shows one (the hidden one is not loaded).
 */
export function Screenshot({
  shot,
  alt,
  sizes,
  priority = false,
  framed = false,
}: {
  shot: ScreenshotInfo;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** In a 16:10 frame, top-aligned, so pictures of different heights line up in a grid. */
  framed?: boolean;
}) {
  const fit = framed ? "h-full w-full object-contain object-top" : "h-auto w-full";
  const pictures = (
    <>
      <Image src={shot.light} alt={alt} sizes={sizes} priority={priority} className={`block dark:hidden ${fit}`} />
      <Image src={shot.dark} alt={alt} sizes={sizes} className={`hidden dark:block ${fit}`} />
    </>
  );
  return framed ? <div className="aspect-[16/10] bg-paper">{pictures}</div> : pictures;
}
