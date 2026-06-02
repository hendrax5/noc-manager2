import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
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
        
        const passwordInput = credentials.password.trim();
        const dbPassword = user.password;
        
        let isValid = false;
        
        // 1. Try bcrypt comparison (if dbPassword looks like a bcrypt hash)
        if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$')) {
          try {
            isValid = await bcrypt.compare(passwordInput, dbPassword);
          } catch (e) {
            isValid = false;
          }
        }
        
        // 2. Fallback to plain text comparison
        if (!isValid && dbPassword === passwordInput) {
          isValid = true;
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
        session.user.roleId = token.roleId;
        session.user.departmentId = token.departmentId;
        session.user.role = token.role;
        session.user.permissions = token.permissions || [];
        session.user.department = token.department;
        session.user.id = token.id;
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
