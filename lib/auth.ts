import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ user }) {
      console.log("User signed in:", user.email);
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.isVaultoEmployee = user.email.endsWith("@vaulto.ai");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isVaultoEmployee = token.isVaultoEmployee as boolean;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If the URL contains a callback, use it
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return `${baseUrl}/waitlist-success`;
    },
  },
});
