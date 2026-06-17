import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { slugFromHost, DEFAULT_TENANT_SLUG } from "./tenant";

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds, req) {
        if (!creds?.email || !creds?.password) return null;
        const email = creds.email.toLowerCase();
        const host = req?.headers?.host || (typeof req?.headers?.get === "function" ? req.headers.get("host") : "") || "";
        const slug = slugFromHost(host);

        // Platform superadmin (global) takes precedence.
        let user = await prisma.user.findFirst({ where: { email, role: "superadmin" } });

        if (!user) {
          let tenant = slug ? await prisma.tenant.findUnique({ where: { slug } }) : null;
          if (!tenant) {
            tenant =
              (await prisma.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } })) ||
              (await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } }));
          }
          if (tenant) user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } });
        }

        if (!user) return null;
        const ok = await bcrypt.compare(creds.password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token?.uid) session.user.id = token.uid;
        session.user.role = token.role || "customer";
        session.user.tenantId = token.tenantId ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
