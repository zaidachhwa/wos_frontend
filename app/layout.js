import { Inter } from "next/font/google";
import Script from "next/script";

import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "WorkOS",
  description: "Internal team and project management platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <script
          // Set the theme before paint so dark mode doesn't flash light.
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
        <Providers>{children}</Providers>
        <Script
          src="https://surfyn.ai/widget.js"
          data-bot-id="1ca3a142-48d5-44f0-a73e-f574e9048382"
          data-client-key="pk_QN__GYRMXXwgpSJ3MOqVZ4vx"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
