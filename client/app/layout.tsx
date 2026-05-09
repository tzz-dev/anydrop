import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { IntlProvider } from "@/components/IntlProvider";
import { ModeProvider } from "@/lib/mode";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnyDrop",
  description: "P2P file transfer across devices",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <IntlProvider>
            <ModeProvider>
              <ErrorBoundary>
                <Header />
                {children}
                <Footer />
                <Toaster position="top-center" />
              </ErrorBoundary>
            </ModeProvider>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
