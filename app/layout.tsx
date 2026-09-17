import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Geist_Mono } from "next/font/google";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const bodyFont = Atkinson_Hyperlegible({
  variable: "--font-body",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "Simple AI-assisted finance tracker",
};

// Set the theme class before hydration so there's no light/dark flash.
const THEME_INIT_SCRIPT = `
(function () {
  var stored = localStorage.getItem("theme");
  var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthGate>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthGate>
      </body>
    </html>
  );
}
