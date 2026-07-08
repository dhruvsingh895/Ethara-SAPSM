import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ethara SAPSM",
  description:
    "Seat Allocation & Project Mapping System for ~5,000 employees.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
