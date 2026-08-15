import type { Metadata } from "next";
import { oswald } from "./fonts";
import "./globals.css";

const APP_URL = "https://app.scorehub.co.nz";
const SITE_URL = "https://scorehub.co.nz";
const HELP_URL = "https://help.scorehub.co.nz";
const TITLE = "ScoreHub — Live sport scoring from any browser";
const DESCRIPTION =
  "ScoreHub is a browser-based live scoring app — score any match from a laptop, tablet, or phone and push one live match state to venue screens, broadcast overlays, and the crowd's phones. No hardware required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "live scoring software",
    "scoreboard app",
    "sports scoring app",
    "browser based scoring",
    "streaming scorebug overlay",
    "netball scoring software",
    "tournament scoring software",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ScoreHub",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_NZ",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en" className={oswald.variable}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <header className="site-header">
          <nav aria-label="Primary" className="site-nav">
            <a href="/" className="wordmark">
              Score<span style={{ color: "var(--accent)" }}>Hub</span>
            </a>
            <a href={`${APP_URL}/signup`} className="nav-cta">
              Get Started
            </a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <a href={`${APP_URL}/login`}>Log in</a>
          <span aria-hidden="true"> · </span>
          <a href={HELP_URL}>Help Centre</a>
          <span aria-hidden="true"> · </span>
          <a href="/terms">Terms of Use</a>
          <span aria-hidden="true"> · </span>
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true"> · </span>
          <a href="mailto:hello@scorehub.co.nz">hello@scorehub.co.nz</a>
        </footer>
      </body>
    </html>
  );
}
