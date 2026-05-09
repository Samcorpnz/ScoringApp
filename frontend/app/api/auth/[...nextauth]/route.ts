import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * Users are stored in AUTH_USERS env var as comma-separated "username:password" pairs.
 * Example: AUTH_USERS=admin:secret123,operator2:pass456
 *
 * Passwords are plaintext here — fine for a small internal tool.
 * For a larger deployment, swap to bcrypt hashed passwords.
 */
function getUsers(): { username: string; password: string }[] {
  const raw = process.env.AUTH_USERS ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => {
      const idx = u.indexOf(":");
      return { username: u.slice(0, idx), password: u.slice(idx + 1) };
    });
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text"     },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const users = getUsers();
        const match = users.find(
          (u) =>
            u.username === credentials.username &&
            u.password === credentials.password
        );
        if (!match) return null;
        return { id: match.username, name: match.username };
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
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
