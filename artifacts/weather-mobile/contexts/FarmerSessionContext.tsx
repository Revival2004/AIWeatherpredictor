import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setAuthTokenGetter } from "@/lib/api-client";
import { cancelAllNotifications, scheduleDailyFarmingReminder } from "@/services/NotificationService";
import {
  getFarmerSession,
  logoutFarmer,
  requestFarmerOtp,
  type FarmerAuthStatus,
  type FarmerIdentity,
  type RequestOtpResponse,
  verifyFarmerOtp,
} from "@/lib/farmer-auth";

type FarmerSessionStatus = "checking" | "authenticated" | "unauthenticated";

interface FarmerSessionContextValue {
  status: FarmerSessionStatus;
  farmer: FarmerIdentity | null;
  token: string | null;
  authStatus: FarmerAuthStatus | null;
  requestOtp: (input: { phoneNumber: string; displayName?: string }) => Promise<RequestOtpResponse>;
  verifyOtp: (input: { phoneNumber: string; code: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = "farmpal_farmer_token_v1";
const FarmerSessionContext = createContext<FarmerSessionContextValue | null>(null);

export function FarmerSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FarmerSessionStatus>("checking");
  const [farmer, setFarmer] = useState<FarmerIdentity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<FarmerAuthStatus | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedToken) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setToken(storedToken);
          setHydrated(true);
        });
      })
      .catch(() => {
        if (!cancelled) {
          startTransition(() => {
            setHydrated(true);
            setStatus("unauthenticated");
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAuthTokenGetter(token ? () => token : null);

    if (!hydrated) {
      return;
    }

    if (token === null) {
      setStatus("unauthenticated");
      setFarmer(null);
      setAuthStatus(null);
      return;
    }

    let cancelled = false;
    setStatus("checking");

    getFarmerSession()
      .then((session) => {
        if (cancelled) {
          return;
        }

        if (!session.authenticated || !session.farmer) {
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
          startTransition(() => {
            setToken(null);
            setFarmer(null);
            setAuthStatus(session.auth ?? null);
            setStatus("unauthenticated");
          });
          return;
        }

        startTransition(() => {
          setFarmer(session.farmer ?? null);
          setAuthStatus(session.auth ?? null);
          setStatus("authenticated");
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        startTransition(() => {
          setToken(null);
          setFarmer(null);
          setAuthStatus(null);
          setStatus("unauthenticated");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  useEffect(() => {
    if (status === "authenticated") {
      scheduleDailyFarmingReminder().catch(() => {});
    }
  }, [status]);

  async function requestOtpAction(input: {
    phoneNumber: string;
    displayName?: string;
  }): Promise<RequestOtpResponse> {
    const result = await requestFarmerOtp(input);
    startTransition(() => {
      setAuthStatus(result.auth);
    });
    return result;
  }

  async function verifyOtpAction(input: {
    phoneNumber: string;
    code: string;
    displayName?: string;
  }): Promise<void> {
    const result = await verifyFarmerOtp(input);
    await AsyncStorage.setItem(STORAGE_KEY, result.token);

    startTransition(() => {
      setToken(result.token);
      setFarmer(result.farmer);
      setStatus("authenticated");
    });
  }

  async function logoutAction(): Promise<void> {
    try {
      await logoutFarmer();
    } catch {
      // Best-effort logout only.
    }

    await AsyncStorage.removeItem(STORAGE_KEY);
    await cancelAllNotifications().catch(() => {});
    await queryClient.clear();

    startTransition(() => {
      setToken(null);
      setFarmer(null);
      setAuthStatus(null);
      setStatus("unauthenticated");
    });
  }

  const value = useMemo<FarmerSessionContextValue>(() => ({
    status,
    farmer,
    token,
    authStatus,
    requestOtp: requestOtpAction,
    verifyOtp: verifyOtpAction,
    logout: logoutAction,
  }), [authStatus, farmer, status, token]);

  return (
    <FarmerSessionContext.Provider value={value}>
      {children}
    </FarmerSessionContext.Provider>
  );
}

export function useFarmerSession(): FarmerSessionContextValue {
  const context = useContext(FarmerSessionContext);
  if (!context) {
    throw new Error("useFarmerSession must be used within FarmerSessionProvider");
  }
  return context;
}
