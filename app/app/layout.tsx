import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magical Storybook",
  description: "Turn any idea into a magical storybook in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
