import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSettings, getSystemStatus } from "@actions/settings";
import Header from "@components/layout/Header";
import Sidebar from "@components/layout/Sidebar";
import { UIProvider } from "@/contexts/UIContext";


const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "DynoCanvas",
    description: "Web-based GUI specialized for Single Table Design in Amazon DynamoDB.",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const settings = await getSettings();
    const systemStatus = await getSystemStatus();

    return (
        <html lang={settings.language} className="h-full">
            <head>
                {/* eslint-disable-next-line @next/next/no-page-custom-font */}
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 h-full flex flex-col`}
            >
                <UIProvider
                    initialLanguage={settings.language}
                    initialSidebarOpen={settings.sidebarOpen}
                    accountId={settings.accountId}
                >
                    <Header
                        currentMode={settings.mode}
                        currentRegion={settings.region}
                        systemStatus={systemStatus}
                        currentProfile={settings.currentProfile}
                        availableProfiles={settings.availableProfiles}
                    />
                    <div className="flex flex-1 overflow-hidden">
                        <Sidebar />
                        <div className="flex-1 overflow-auto h-full w-full">
                            {children}
                        </div>
                    </div>
                </UIProvider>
            </body>
        </html>
    );
}