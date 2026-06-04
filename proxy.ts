import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 Proxy (formerly "middleware"). Runs on the Node.js runtime and
// refreshes the Supabase session / gates unauthenticated requests.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, image files, and the public
     * boundary data under /geo (fetched by MapLibre, must not be auth-gated), so
     * the session is refreshed on page and API requests only.
     */
    "/((?!_next/static|_next/image|favicon.ico|geo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|geojson)$).*)",
  ],
};
