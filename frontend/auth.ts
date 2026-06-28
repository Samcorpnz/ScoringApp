import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, Role } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

export type SessionMembership = {
  orgId: string;
  orgName: string;
  role: Role;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      memberships: SessionMembership[];
      activeOrgId: string | null;
      activeRole: Role | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    memberships?: SessionMembership[];
    activeOrgId?: string | null;
  }
}

/**
 * Users are real, DB-backed accounts created via /signup (see
 * app/api/signup/route.ts) or by accepting an invitation (see
 * app/api/invitations/accept/route.ts). Passwords are hashed with bcrypt.
 *
 * A user can belong to multiple orgs (one Membership row per org). The JWT
 * carries the full membership list plus an `activeOrgId` pointer; the
 * session exposes the active org's role as `activeRole`. Switching orgs goes
 * through POST /api/session/switch-org, which re-verifies the membership
 * against the DB before updating the JWT — the membership list cached in
 * the token is never trusted for the switch itself, only for display/picker
 * purposes.
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
          include: { memberships: { include: { org: true } } },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;

        const memberships: SessionMembership[] = user.memberships.map((m) => ({
          orgId: m.orgId,
          orgName: m.org.name,
          role: m.role,
        }));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          memberships,
          activeOrgId: memberships[0]?.orgId ?? null,
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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.memberships = (user as { memberships: SessionMembership[] }).memberships;
        token.activeOrgId = (user as { activeOrgId: string | null }).activeOrgId;
      }
      // Org switching: POST /api/session/switch-org re-verifies the target
      // membership against the DB, then the client calls useSession().update()
      // with the new orgId. Re-fetch the membership list from the DB here
      // too (rather than trusting the token's own cached list) — a brand
      // new membership granted mid-session wouldn't be in the cached list
      // yet, so checking against it would make switching into a just-added
      // org silently fail until the next full login.
      if (trigger === "update" && session?.activeOrgId && token.sub) {
        const memberships = await prisma.membership.findMany({
          where: { userId: token.sub },
          include: { org: true },
        });
        const fresh: SessionMembership[] = memberships.map((m) => ({
          orgId: m.orgId,
          orgName: m.org.name,
          role: m.role,
        }));
        if (fresh.some((m) => m.orgId === session.activeOrgId)) {
          token.memberships = fresh;
          token.activeOrgId = session.activeOrgId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.memberships = token.memberships ?? [];
      session.user.activeOrgId = token.activeOrgId ?? null;
      session.user.activeRole =
        session.user.memberships.find((m) => m.orgId === session.user.activeOrgId)?.role ?? null;
      return session;
    },
  },
});
