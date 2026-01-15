import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
}

export interface Session {
  user: SessionUser;
  expires: Date;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

const SESSION_DURATION = 60 * 60 * 24 * 7;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION}s`)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await createToken(user);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  const user = await verifyToken(token);
  if (!user) return null;

  return {
    user,
    expires: new Date(Date.now() + SESSION_DURATION * 1000),
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  console.log("Login attempt for:", email);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  console.log("User found:", user ? "yes" : "no");

  if (!user || !user.isActive) {
    return { success: false, error: "Nieprawidłowy email lub hasło" };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  console.log("Password valid:", isValid);

  if (!isValid) {
    return { success: false, error: "Nieprawidłowy email lub hasło" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  });

  return { success: true };
}

export async function logout(): Promise<void> {
  await destroySession();
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireTenant(tenantId: string): Promise<Session> {
  const session = await requireAuth();

  if (session.user.role === "SUPER_ADMIN") {
    return session;
  }

  if (session.user.tenantId !== tenantId) {
    throw new Error("Forbidden");
  }

  return session;
}

export function isSuperAdmin(session: Session | null): boolean {
  return session?.user.role === "SUPER_ADMIN";
}

export function canEditPages(
  session: Session | null,
  tenantId: string
): boolean {
  if (!session) return false;
  if (session.user.role === "SUPER_ADMIN") return true;
  if (
    session.user.tenantId === tenantId &&
    ["ADMIN", "EDITOR"].includes(session.user.role)
  )
    return true;
  return false;
}
