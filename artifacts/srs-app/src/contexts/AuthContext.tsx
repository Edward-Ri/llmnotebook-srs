import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const register = useCallback(async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      console.error("Register request failed", err);
      throw new Error("无法连接服务器，请确认后端已启动后重试");
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors; handle below via状态码和默认提示
    }

    if (!res.ok) {
      if (res.status === 409) {
        throw new Error("该邮箱已被注册");
      }
      if (res.status === 400 && data?.error) {
        throw new Error(data.error);
      }
      throw new Error(data?.error || "注册失败，请稍后重试");
    }

    if (!data?.user) {
      throw new Error("注册成功，但未收到用户信息，请稍后再试");
    }

    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
