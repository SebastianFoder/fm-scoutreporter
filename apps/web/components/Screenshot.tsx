import { getImageProps } from "next/image";
import { getLocale } from "next-intl/server";
import { ThemedScreenshotImage } from "@/components/ThemedScreenshotImage";
import type { ScreenshotInfo } from "@/lib/screenshots";
import { SCREENSHOT_IMAGES } from "@/lib/screenshot-images";

/**
 * An app screenshot in the site's language and theme. A screen without a localized capture
 * shows the English picture.
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
  const { props: light } = getImageProps({ src: images.light, alt, sizes });
  const { props: dark } = getImageProps({ src: images.dark, alt, sizes });
  const pictures = (
    <>
      <ThemedScreenshotImage
        alt={alt}
        sizes={sizes}
        width={images.light.width}
        height={images.light.height}
        lightSrcSet={light.srcSet ?? light.src}
        darkSrcSet={dark.srcSet ?? dark.src}
        priority={priority}
        className={`block ${fit}`}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies optimized sources. */}
        <img {...light} alt={alt} className={`block ${fit}`} />
      </noscript>
    </>
  );
  return framed ? <div className="aspect-[16/10] bg-paper">{pictures}</div> : pictures;
}
