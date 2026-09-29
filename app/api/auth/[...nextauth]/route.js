import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/** @type {import("next-auth").AuthOptions} */
export const authOptions = {
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const emailToFind = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findFirst({ 
          where: { email: { equals: emailToFind, mode: 'insensitive' } },
          include: { role: true, department: true },
          omit: { password: false },
        });

        if (!user) return null;
        
        const { valid: isValid, needsRehash } = await verifyPassword(credentials.password, user.password);

        if (isValid && needsRehash) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { password: await hashPassword(credentials.password) },
            });
          } catch (e) {
            console.warn("[auth] password rehash failed:", e.message);
          }
        }

        if (isValid) {
          return { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            roleId: user.roleId, 
            departmentId: user.departmentId,
            role: user.role.name,
            permissions: user.role.permissions || [],
            department: user.department.name,
            avatarUrl: user.avatarUrl,
            signature: user.signature
          };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roleId = user.roleId;
        token.departmentId = user.departmentId;
        token.role = user.role;
        token.permissions = user.permissions || [];
        token.department = user.department;
        token.id = user.id;
        token.avatarUrl = user.avatarUrl;
        token.signature = user.signature;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: parseInt(token.id) },
            include: { role: true, department: true }
          });
          
          if (dbUser) {
            session.user.roleId = dbUser.roleId;
            session.user.departmentId = dbUser.departmentId;
            session.user.role = dbUser.role.name;
            session.user.permissions = dbUser.role.permissions || [];
            session.user.department = dbUser.department.name;
            session.user.avatarUrl = dbUser.avatarUrl;
            session.user.signature = dbUser.signature;
            return session;
          }
        } catch (error) {
          console.error("NextAuth session database lookup failed, using token fallback:", error);
        }

        // Fallback to token values if user not found in DB or DB connection failed
        session.user.roleId = token.roleId;
        session.user.departmentId = token.departmentId;
        session.user.role = token.role;
        session.user.permissions = token.permissions || [];
        session.user.department = token.department;
        session.user.avatarUrl = token.avatarUrl;
        session.user.signature = token.signature;
      }
      return session;
    }
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: '/login', // We will build a custom login page
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
