import "reflect-metadata";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { siteConfig } from "../config/site";
import { StructuredData } from "../components/structured-data";
import { seoConfig } from "../config/seo";
import { AuthProvider } from "../context/AuthContext";
import { SidebarProvider } from "../context/SidebarContext";
import { MainWrapper } from "../components/main-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const siteUrl = seoConfig.baseUrl;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: seoConfig.defaultTitle,
    template: seoConfig.titleTemplate,
  },
  description: seoConfig.description,
  verification: {
    google: "lFuDpBl6XZCriYrk73hlTwVGVkaNjsnZgGSuXZd6yeE"
  },
  keywords: seoConfig.keywords,
  authors: [{ name: "SSPACIA" }],
  creator: "SSPACIA",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: seoConfig.siteName,
    title: seoConfig.defaultTitle,
    description: seoConfig.description,
    images: [
      {
        url: seoConfig.ogImage,
        width: 1200,
        height: 630,
        alt: seoConfig.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoConfig.defaultTitle,
    description: seoConfig.description,
    images: [seoConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": siteConfig.site.name,
    "url": siteUrl,
    "logo": `${siteUrl}/SspaciaLogo.png`,
    "description": siteConfig.site.description,
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": siteConfig.site.contact.phone,
      "contactType": "sales",
      "email": siteConfig.site.contact.email,
    },
    "sameAs": [
      siteConfig.site.social.facebook,
      siteConfig.site.social.instagram,
      siteConfig.site.social.youtube,
    ],
  };

  const localBusinessData = [
    {
      "@context": "https://schema.org",
      "@type": "CoworkingSpace",
      "name": "SSPACIA Coworking – CG Road Agarwal Complex",
      "url": siteUrl,
      "telephone": siteConfig.site.contact.phone,
      "email": siteConfig.site.contact.email,
      "image": `${siteUrl}/Agarwal_images/Reception%20Area.jpg`,
      "priceRange": "₹₹",
      "openingHours": "Mo-Su 00:00-23:59",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Agarwal Complex, CG Road",
        "addressLocality": "Ahmedabad",
        "addressRegion": "GJ",
        "postalCode": "380009",
        "addressCountry": "IN",
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 23.0349279,
        "longitude": 72.5413010,
      },
      "hasMap": "https://maps.app.goo.gl/nv4fsViv3n5JnZKP6",
      "sameAs": [siteConfig.site.social.facebook, siteConfig.site.social.instagram],
    },
    {
      "@context": "https://schema.org",
      "@type": "CoworkingSpace",
      "name": "SSPACIA Coworking – CG Road Mercardo",
      "url": siteUrl,
      "telephone": siteConfig.site.contact.phone,
      "email": siteConfig.site.contact.email,
      "image": `${siteUrl}/IMAGES_SSPACIA/MERCADO%20IMAGES/Mercado%20reception.jpg`,
      "priceRange": "₹₹",
      "openingHours": "Mo-Su 00:00-23:59",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Mercardo, CG Road",
        "addressLocality": "Ahmedabad",
        "addressRegion": "GJ",
        "postalCode": "380009",
        "addressCountry": "IN",
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 23.0349279,
        "longitude": 72.5413010,
      },
      "hasMap": "https://maps.app.goo.gl/hvfuXehGcpgP1FfBA",
      "sameAs": [siteConfig.site.social.facebook, siteConfig.site.social.instagram],
    },
    {
      "@context": "https://schema.org",
      "@type": "CoworkingSpace",
      "name": "SSPACIA Coworking – SG Highway Premier House",
      "url": siteUrl,
      "telephone": siteConfig.site.contact.phone,
      "email": siteConfig.site.contact.email,
      "image": `${siteUrl}/IMAGES_SSPACIA/PREMIER%20HOUSE/Reception.JPG`,
      "priceRange": "₹₹",
      "openingHours": "Mo-Su 00:00-23:59",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Premier House, SG Highway",
        "addressLocality": "Ahmedabad",
        "addressRegion": "GJ",
        "postalCode": "38054",
        "addressCountry": "IN",
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 23.0447083,
        "longitude": 72.4965942,
      },
      "hasMap": "https://maps.app.goo.gl/ZJ948unE5tiks47RA",
      "sameAs": [siteConfig.site.social.facebook, siteConfig.site.social.instagram],
    },
  ];

  return (
    <html lang="en">
      <head>
        <StructuredData data={organizationData} />
        {localBusinessData.map((location, i) => (
          <StructuredData key={i} data={location} />
        ))}
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${geistSans.variable} ${geistMono.variable} font-sans bg-[#FBF9F8] text-[#1B1C1C] antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <SidebarProvider>
            <MainWrapper>{children}</MainWrapper>
            <Toaster position="top-right" />
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
