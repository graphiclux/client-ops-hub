import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Ops Hub",
  description: "Client relationship and systems inventory hub for Graphiclux"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
