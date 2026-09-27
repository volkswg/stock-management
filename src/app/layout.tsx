import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppBreadcrumb } from "./AppBreadcrumb";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Stock Management",
    template: "%s | Stock Management",
  },
  description: "Stock management workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <AppBreadcrumb />
          {children}
        </AntdRegistry>
      </body>
    </html>
  );
}
