import { NextResponse, type NextRequest } from "next/server";

/**
 * Tells the root layout which area a request belongs to so the admin
 * dashboard always renders English/LTR, whatever language the customer
 * picked on the storefront. Header-only; it never rewrites or redirects.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const isAdmin = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  headers.set("x-contrast-scope", isAdmin ? "admin" : "store");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: skip static assets, images and files with an extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|collections/|customize/|.*\\..*).*)"],
};
