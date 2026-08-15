import { ImageResponse } from "next/og.js";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "og-image.png");

const image = new ImageResponse(
  {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "#07090f",
        padding: "80px",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 34,
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: 36,
            },
            children: [
              "Score",
              { type: "span", props: { style: { color: "#00c8ff" }, children: "Hub" } },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.08,
              color: "#ffffff",
              maxWidth: "920px",
              textTransform: "uppercase",
            },
            children: "Live sport scoring that runs from a browser.",
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              marginTop: 32,
              fontSize: 28,
              color: "#a3adbd",
            },
            children: "No hardware required — 21 sports, one live match state.",
          },
        },
      ],
    },
  },
  { width: 1200, height: 630 },
);

const buffer = Buffer.from(await image.arrayBuffer());
await writeFile(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
