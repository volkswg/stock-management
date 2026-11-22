import Script from "next/script";
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
        {process.env.STOCK_UAT_HOSTED_BROWSER === 'reviewed-preview-product-uat-v1' ? <div role="status" style={{padding:12,background:'#fff3cd',color:'#664d03',textAlign:'center'}}>UAT — synthetic test data. External integrations are disabled.</div> : null}
        {process.env.STOCK_STORAGE === "supabase" && <Script src="/stock-staging-operations.js" strategy="beforeInteractive" />}
        <AntdRegistry>
          <AppBreadcrumb />
          {children}
        </AntdRegistry>
      </body>
    </html>
  );
}
