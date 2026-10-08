import { ImageResponse } from "next/og";
import { siteName } from "@/lib/site";

export const alt = siteName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#101214", color: "#f3f0e5", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", padding: 80, width: "100%" }}>
      <div style={{ color: "#48d6a0", fontSize: 32, marginBottom: 32 }}>{siteName}</div>
      <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>The edge is in the details.</div>
    </div>, size,
  );
}
