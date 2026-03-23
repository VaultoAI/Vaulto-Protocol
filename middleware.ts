import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Platform routes that require authentication and onboarding
const protectedRoutes = ["/swap", "/mint", "/earn", "/predictions"];

// Routes that don't require onboarding check
const onboardingExemptRoutes = ["/onboarding", "/api/onboarding", "/api/webhooks"];

// Onboarding statuses that allow full platform access
const fullyOnboardedStatuses = ["FULLY_ONBOARDED", "COMPLIANCE_PERIOD_ACTIVE"];

// Check if onboarding enforcement is enabled
// Disabled when DATABASE_URL is not set or SKIP_ONBOARDING is true
function isOnboardingEnforcementEnabled(): boolean {
  // Skip onboarding if explicitly disabled
  if (process.env.SKIP_ONBOARDING === "true") {
    return false;
  }
  // Skip onboarding if database is not configured
  if (!process.env.DATABASE_URL) {
    return false;
  }
  return true;
}

/**
 * Detect country from request headers.
 * Supports Vercel, Netlify, Cloudflare, and fallback.
 */
function getCountryFromRequest(req: Request): string | null {
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

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Check if accessing onboarding routes
  const isOnboardingRoute = onboardingExemptRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isOnboardingRoute) {
    // If onboarding is disabled, redirect away from onboarding page
    if (pathname === "/onboarding" && !isOnboardingEnforcementEnabled()) {
      // Vaulto employees go to platform, others to waitlist
      if (session?.user?.isVaultoEmployee) {
        return NextResponse.redirect(new URL("/swap", req.url));
      }
      return NextResponse.redirect(new URL("/waitlist-success", req.url));
    }
    // Only require authentication for onboarding page itself
    if (pathname === "/onboarding" && !session?.user) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    // Continue with geo cookie setting below
  }

  // Check if accessing a protected platform route
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    // Not authenticated - redirect to home
    if (!session?.user) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Only Vaulto employees (as designated in Supabase) can access the platform
    if (!session.user.isVaultoEmployee) {
      return NextResponse.redirect(new URL("/waitlist-success", req.url));
    }
    // Vaulto employees get full access - continue to set geo cookie
  }

  // Set referral cookie when visiting home with ?ref= (for waitlist signup)
  const response = NextResponse.next();
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

  // Set geo cookie for client-side banner
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
});

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
