import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAdminSession, loginAdmin, logoutAdmin, type AdminIdentity } from "@/lib/admin-api";

type AdminStatus = "checking" | "authenticated" | "unauthenticated";

interface AdminSessionContextValue {
  status: AdminStatus;
  admin: AdminIdentity | null;
  token: string | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = "farmpal_admin_token_v1";

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminStatus>("checking");
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(STORAGE_KEY);
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(token ? () => token : null);

    if (!token) {
      setStatus("unauthenticated");
      setAdmin(null);
      return;
    }

    let cancelled = false;
    setStatus("checking");

    getAdminSession(token)
      .then((session) => {
        if (cancelled || !session.authenticated || !session.admin) {
          return;
        }

        startTransition(() => {
          setAdmin(session.admin ?? null);
          setStatus("authenticated");
          setError(null);
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        window.localStorage.removeItem(STORAGE_KEY);
        startTransition(() => {
          setToken(null);
          setAdmin(null);
          setStatus("unauthenticated");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function login(email: string, password: string): Promise<void> {
    const response = await loginAdmin(email, password);
    window.localStorage.setItem(STORAGE_KEY, response.token);

    startTransition(() => {
      setToken(response.token);
      setAdmin(response.admin);
      setStatus("authenticated");
      setError(null);
    });
  }

  async function logout(): Promise<void> {
    try {
      await logoutAdmin(token);
    } catch {
      // Best-effort client logout.
    }

    window.localStorage.removeItem(STORAGE_KEY);
    startTransition(() => {
      setToken(null);
      setAdmin(null);
      setStatus("unauthenticated");
      setError(null);
    });
  }

  const value = useMemo<AdminSessionContextValue>(() => ({
    status,
    admin,
    token,
    error,
    login,
    logout,
  }), [admin, error, status, token]);

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }

  return context;
}
