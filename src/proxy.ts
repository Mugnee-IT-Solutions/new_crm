import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/admin",
  "/supervisor",
  "/marketer",
  "/leads",
  "/customers",
  "/products",
  "/quotations",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected || pathname === "/login") {
    return NextResponse.next();
  }

  const role = request.cookies.get("crm_role")?.value;
  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role === "ADMIN") return NextResponse.next();
  if (role === "SUPERVISOR" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/supervisor/dashboard", request.url));
  }
  if (role === "MARKETER" && (pathname.startsWith("/admin") || pathname.startsWith("/supervisor"))) {
    return NextResponse.redirect(new URL("/marketer/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/supervisor/:path*",
    "/marketer/:path*",
    "/leads/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/quotations/:path*",
  ],
};
