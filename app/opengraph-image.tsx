import { ImageResponse } from "next/og";
import { SHARE_IMAGE_ALT, SITE_NAME, SITE_URL } from "@/lib/site";

/* Social share card for every page. Colours are the light/dark theme tokens and grade fills,
   converted to hex because the image renderer has no OKLCH. Keep the mark in sync with app/icon.svg. */

export const alt = SHARE_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHROME = "#162232";
const ON_CHROME = "#f3f5f8";
const MUTED = "#9ca5b1";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2.5" y="1.5" width="19" height="21" rx="2" fill="#2f8a52"/><g fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="1.2"><rect x="2.5" y="1.5" width="19" height="21" rx="2"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><circle cx="12" cy="12" r="3"/><rect x="7.5" y="1.5" width="9" height="4"/><rect x="7.5" y="18.5" width="9" height="4"/></g><circle cx="16" cy="7.5" r="2.1" fill="#fff"/></svg>`;

const GRADES = [
  { grade: "S", bg: "#6928b0", ink: "#ffffff" },
  { grade: "A", bg: "#137738", ink: "#ffffff" },
  { grade: "B", bg: "#a2d060", ink: "#151e09" },
  { grade: "C", bg: "#f2ce59", ink: "#2a2009" },
  { grade: "D", bg: "#f0903c", ink: "#241104" },
  { grade: "F", bg: "#c9302d", ink: "#ffffff" },
];

const FEATURES = ["Weighted attribute scores", "Wonderkids from CA and PA", "Best XI within budget"];

export default function OpengraphImage() {
  const host = new URL(SITE_URL).host;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CHROME,
          color: ON_CHROME,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
          <img
            src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`}
            width={88}
            height={88}
            alt=""
          />
          <div style={{ fontSize: 56, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
            Score, grade and compare Football Manager players
          </div>
          <div style={{ display: "flex", fontSize: 27, color: MUTED }}>{FEATURES.join(" · ")}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {GRADES.map((g) => (
              <div
                key={g.grade}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: g.bg,
                  color: g.ink,
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {g.grade}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>FM27 · FM26</div>
            <div style={{ fontSize: 24, color: MUTED }}>{host}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
