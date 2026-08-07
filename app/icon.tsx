import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#07090b", padding: 56, color: "white", fontFamily: "Arial" }}>
      <div style={{ width: 74, height: 14, borderRadius: 99, background: "#c8ff3d" }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 176, fontWeight: 800, letterSpacing: -18, lineHeight: .8 }}>ML</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: "#c8ff3d", marginTop: 32 }}>LIFE SYSTEM</div>
      </div>
    </div>,
    size,
  );
}
