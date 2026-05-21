import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOSOGO Closet",
  description: "Boutique clothing marketplace for FOSOGO Closet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
