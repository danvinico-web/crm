import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { isRole } from "@/lib/roles";

/** Конфигурация NextAuth: вход по email + паролю (credentials), JWT-сессии, роли. */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email и пароль",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await dbConnect();
        const user = await User.findOne({ email: String(credentials.email).toLowerCase() });
        if (!user || !user.isActive) return null;
        const ok = bcrypt.compareSync(String(credentials.password), user.passwordHash);
        if (!ok) return null;
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? "";
        session.user.role = isRole(token.role) ? token.role : "USER";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
