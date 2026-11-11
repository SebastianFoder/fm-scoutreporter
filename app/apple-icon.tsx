import { ImageResponse } from "next/og";

/* Home-screen icon: the pitch mark from app/icon.svg on a solid tile (iOS ignores transparency). */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2.5" y="1.5" width="19" height="21" rx="2" fill="#2f8a52"/><g fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="1.2"><rect x="2.5" y="1.5" width="19" height="21" rx="2"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><circle cx="12" cy="12" r="3"/><rect x="7.5" y="1.5" width="9" height="4"/><rect x="7.5" y="18.5" width="9" height="4"/></g><circle cx="16" cy="7.5" r="2.1" fill="#fff"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#162232",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
        <img
          src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`}
          width={132}
          height={132}
          alt=""
        />
      </div>
    ),
    size,
  );
}
