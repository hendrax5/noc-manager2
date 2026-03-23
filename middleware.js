import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*", 
    "/tickets/:path*", 
    "/reports/:path*", 
    "/meetings/:path*", 
    "/team/:path*"
  ],
};
