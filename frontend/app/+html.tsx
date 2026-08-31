// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          id="manent-splash"
          style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#D2E2EC", zIndex: 9999 }}
          dangerouslySetInnerHTML={{
            __html: `
  <style>
    @media (prefers-color-scheme:dark){#manent-splash{background:#3A2119!important}#manent-splash .s{stroke:#F5EDE4!important}}
    html.dark #manent-splash{background:#3A2119!important} html.dark #manent-splash .s{stroke:#F5EDE4!important}
    @keyframes mD{0%{stroke-dashoffset:1;opacity:1}55%{stroke-dashoffset:0;opacity:1}82%{stroke-dashoffset:0;opacity:1}92%,100%{stroke-dashoffset:0;opacity:0}}
    @keyframes mP{0%,54%{transform:scale(0);opacity:1}62%{transform:scale(1.35)}68%{transform:scale(1)}82%{transform:scale(1);opacity:1}92%,100%{opacity:0}}
    #manent-splash .s{fill:none;stroke:#3A2119;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;animation:mD 3s cubic-bezier(.45,0,.25,1) infinite}
    #manent-splash .d{transform-origin:center;transform-box:fill-box;animation:mP 3s ease infinite}
  </style>
  <svg viewBox="0 0 120 110" width="110" height="101">
    <path class="s" pathLength="1" d="M 10 95 C 18 90 26 60 34 26 C 36 18 40 16 41 22 C 42 26 40 40 37 58 L 33 82 C 32 92 35 95 39 88 C 47 72 55 44 61 28 C 63 22 67 19 69 24 C 71 28 69 42 66 60 L 62 84 C 61 93 65 96 72 88"/>
    <circle class="d" cx="86" cy="89" r="5.5" fill="#79A3C3"/>
  </svg>`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
