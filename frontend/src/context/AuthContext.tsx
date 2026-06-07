import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { api, authStorage, CurrentUser } from "../api/client";

type AuthContextValue = {
  user: CurrentUser;
  canEdit: boolean;
  login: (role: "me" | "her", username: string, password: string) => Promise<void>;
  enterGuest: () => void;
  logout: () => void;
  updateProfile: (displayName: string) => Promise<void>;
};

const guestUser: CurrentUser = { username: "guest", role: "guest", display_name: "游客" };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(() => authStorage.current());

  useEffect(() => {
    if (!authStorage.hasToken()) return;
    api.me()
      .then((currentUser) => {
        authStorage.save(localStorage.getItem(authStorage.tokenKey) ?? "", currentUser);
        setUser(currentUser);
      })
      .catch(() => {
        authStorage.clear();
        setUser(guestUser);
      });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    canEdit: user.role === "me" || user.role === "her",
    async login(role, username, password) {
      const result = await api.login({ role, username, password });
      authStorage.save(result.token, result.user);
      setUser(result.user);
    },
    enterGuest() {
      authStorage.saveGuest();
      setUser(guestUser);
    },
    logout() {
      authStorage.clear();
      setUser(guestUser);
    },
    async updateProfile(displayName) {
      const updated = await api.updateProfile({ displayName });
      authStorage.save(localStorage.getItem(authStorage.tokenKey) ?? "", updated);
      setUser(updated);
    }
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
