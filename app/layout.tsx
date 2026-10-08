import type { Metadata, Viewport } from "next";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteName, template: `%s · ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: "Hugo Santos Ribeiro", url: "https://hugosantosribeiro.me" }],
  creator: "Hugo Santos Ribeiro",
  alternates: { canonical: "/" },
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: "/",
    siteName,
    locale: "en_GB",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: siteName }],
  },
  twitter: { card: "summary_large_image", title: siteName, description: siteDescription, images: ["/opengraph-image"] },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" },
  category: "education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101214",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
