import { identifyUser } from "@/monitoring";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "./api";
import type { User } from "@/types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (data: { email: string; password: string; full_name: string; preferred_language: string }) => Promise<User>;
  signOut: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.get<User>("/api/auth/me"));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => identifyUser(user?.id ?? null, user?.role), [user?.id, user?.role]);

  const signIn = async (email: string, password: string) => {
    const r = await api.post<{ access_token: string; user: User }>("/api/auth/signin", { email, password });
    tokenStore.set(r.access_token);
    setUser(r.user);
    return r.user;
  };
  const signUp = async (data: { email: string; password: string; full_name: string; preferred_language: string }) => {
    const r = await api.post<{ access_token: string; user: User }>("/api/auth/signup", data);
    tokenStore.set(r.access_token);
    setUser(r.user);
    return r.user;
  };
  const signOut = () => {
    api.post("/api/auth/logout").catch(() => undefined);
    tokenStore.clear();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, refresh, setUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
