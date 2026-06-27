import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, Role } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      orgId: string | null;
      role: Role | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    orgId?: string | null;
    role?: Role | null;
  }
}

/**
 * Users are real, DB-backed accounts created via /signup (see
 * app/api/signup/route.ts). Passwords are hashed with bcrypt — no more
 * AUTH_USERS env var / plaintext comparison.
 *
 * Env var: AUTH_SECRET — also shared with the relay so it can verify
 * control-panel tokens minted by /api/control-token.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // Throttle by IP+email so credential stuffing against one account
        // from one source can't run unbounded (SA-81).
        const key = `login:${clientIp(request)}:${String(credentials.email).toLowerCase()}`;
        if (isRateLimited(key, 10, 60_000)) return null;

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
          include: { memberships: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;

        const membership = user.memberships[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          orgId: membership?.orgId ?? null,
          role: membership?.role ?? null,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.orgId = (user as { orgId: string | null }).orgId;
        token.role = (user as { role: Role | null }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.orgId = token.orgId ?? null;
      session.user.role = token.role ?? null;
      return session;
    },
  },
});
