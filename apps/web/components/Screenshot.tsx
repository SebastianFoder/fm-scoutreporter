import Image from "next/image";
import { getLocale } from "next-intl/server";
import type { ScreenshotInfo } from "@/lib/screenshots";
import { SCREENSHOT_IMAGES } from "@/lib/screenshot-images";

/**
 * An app screenshot (lib/screenshots.ts) in the site's language and theme: the light and the dark
 * picture are both in the page, and the theme switch shows one (the hidden one is not loaded). A
 * screen not captured in this language yet shows the English picture.
 */
export async function Screenshot({
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
  const locale = await getLocale();
  const images = SCREENSHOT_IMAGES[locale]?.[shot.name] ?? SCREENSHOT_IMAGES.en?.[shot.name];
  if (!images) throw new Error(`No screenshot "${shot.name}": run bun run screenshots`);
  const fit = framed ? "h-full w-full object-contain object-top" : "h-auto w-full";
  const pictures = (
    <>
      <Image src={images.light} alt={alt} sizes={sizes} priority={priority} className={`block dark:hidden ${fit}`} />
      <Image src={images.dark} alt={alt} sizes={sizes} className={`hidden dark:block ${fit}`} />
    </>
  );
  return framed ? <div className="aspect-[16/10] bg-paper">{pictures}</div> : pictures;
}
