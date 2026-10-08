import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import api from "../api/api";

type Role = "organizer" | "participant";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  college: string | null;
  xp: number;
  level: number;
};

export type RegisterForm = {
  name: string;
  email: string;
  password: string;
  role?: Role;
  college?: string | null;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (form: RegisterForm) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));

  // On first load: if a token exists, ask the backend who it belongs to
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
    api
      .get<User>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("token")) // expired or invalid
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    // /auth/login expects FORM data with the field named "username", not JSON
    const body = new URLSearchParams({ username: email, password });
    const { data } = await api.post<LoginResponse>("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    localStorage.setItem("token", data.access_token);
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me.data);
    } catch (error) {
      localStorage.removeItem("token");
      throw error;
    }
  }

  async function register(form: RegisterForm) {
    await api.post("/auth/register", form); // JSON body
    await login(form.email, form.password); // log in straight away
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, login, register, logout } },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
