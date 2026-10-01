import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader, Geist_Mono } from "next/font/google";
import { StatsTracker } from "@/components/StatsTracker";
import { JourneyLoader } from "@/components/JourneyLoader";
import { ViewportSync } from "@/components/ViewportSync";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const newsreaderLight = Newsreader({
  variable: "--font-newsreader-light",
  subsets: ["latin"],
  weight: "300",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: "Dharmay Dave | Portfolio",
  description:
    "CS student at TU Munich, freelance full-stack developer, and builder of weird and wonderful web and mobile products.",
  icons: {
    icon: [
      { url: "/favicon.png?v=4", type: "image/png", sizes: "any" },
    ],
    shortcut: "/favicon.png?v=4",
    apple: "/favicon.png?v=4",
  },
  openGraph: {
    title: "Dharmay Dave | Portfolio",
    description:
      "CS student at TU Munich, freelance full-stack developer, and builder of weird and wonderful web and mobile products.",
    type: "website",
    images: ["/favicon.png"],
  },
  twitter: {
    card: "summary",
    title: "Dharmay Dave | Portfolio",
    description: "CS student at TU Munich, freelance full-stack developer.",
    images: ["/favicon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-accent="green"
      suppressHydrationWarning
      className={`${dmSans.variable} ${geistMono.variable} ${newsreader.variable} ${newsreaderLight.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('portfolio:theme')||'light';var a=localStorage.getItem('portfolio:accent')||'green';var b=localStorage.getItem('portfolio:brightness')||'100';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-accent',a);document.documentElement.style.setProperty('--display-brightness',(parseInt(b,10)/100).toString())}catch(e){}})()`,
          }}
        />
      </head>
      <body className="h-full overflow-hidden">
        <ViewportSync/>
        <a href="#desktop-content" className="skip-to-content">
          Skip to content
        </a>
        {children}
        <JourneyLoader />
        <StatsTracker />
      </body>
    </html>
  );
}
