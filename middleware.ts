import { NextResponse, type NextRequest } from "next/server";

/**
 * Detect country from request headers.
 * Supports Vercel, Netlify, Cloudflare, and AWS CloudFront.
 */
function getCountryFromRequest(req: NextRequest): string | null {
  // Vercel
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  if (vercelCountry) return vercelCountry;

  // Netlify
  const netlifyCountry = req.headers.get("x-country");
  if (netlifyCountry) return netlifyCountry;

  // Cloudflare
  const cfCountry = req.headers.get("cf-ipcountry");
  if (cfCountry) return cfCountry;

  // AWS CloudFront
  const awsCountry = req.headers.get("cloudfront-viewer-country");
  if (awsCountry) return awsCountry;

  return null;
}

/**
 * Lightweight middleware - no auth checks here.
 * Auth is handled by route group layouts for better performance.
 * This middleware only sets cookies for geo detection and referral tracking.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  // Set referral cookie when visiting home with ?ref= (for waitlist signup)
  if (pathname === "/" || pathname === "") {
    const ref = req.nextUrl.searchParams.get("ref");
    if (ref && /^[A-Za-z0-9]{1,20}$/.test(ref)) {
      response.cookies.set("waitlist_ref", ref.toUpperCase(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24h
        path: "/",
      });
    }
  }

  // Set geo cookie for client-side geo-restriction banner
  let country = getCountryFromRequest(req);

  // In development, check for ?geo= query param to simulate geo
  if (!country && process.env.NODE_ENV === "development") {
    const geoParam = req.nextUrl.searchParams.get("geo");
    if (geoParam) {
      country = geoParam.toUpperCase();
    }
  }

  if (country) {
    response.cookies.set("geo-country", country, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
