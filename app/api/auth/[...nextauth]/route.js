import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { resolvePermissions } from "@/lib/permissions";
import bcrypt from "bcryptjs";

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
          include: { role: true, department: true }
        });

        if (!user) return null;
        
        let isMatch = false;
        
        if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
          isMatch = await bcrypt.compare(credentials.password.trim(), user.password);
        } else if (user.password === credentials.password.trim()) {
          isMatch = true;
          // Legacy plain-text match: upgrade to hashed password transparently
          try {
            const hashed = await bcrypt.hash(credentials.password.trim(), 10);
            await prisma.user.update({
              where: { id: user.id },
              data: { password: hashed }
            });
          } catch (e) {
             console.error("Hybrid hash upgrade failed:", e);
          }
        }
        
        if (isMatch) {
          // Resolve permissions from Role defaults + User overrides
          const permissions = await resolvePermissions(user.id);

          return { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            roleId: user.roleId, 
            departmentId: user.departmentId,
            role: user.role.name,
            department: user.department.name,
            avatarUrl: user.avatarUrl,
            signature: user.signature,
            permissions,
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
        token.department = user.department;
        token.id = user.id;
        token.avatarUrl = user.avatarUrl;
        token.signature = user.signature;
        token.permissions = user.permissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.roleId = token.roleId;
        session.user.departmentId = token.departmentId;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.id = token.id;
        session.user.avatarUrl = token.avatarUrl;
        session.user.signature = token.signature;
        session.user.permissions = token.permissions || [];
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

