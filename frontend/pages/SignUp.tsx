import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth, type RegisterForm } from "../context/AuthContext";

type AuthMode = "login" | "register";

type AuthForm = RegisterForm & {
  confirmPassword: string;
};

const initialForm: AuthForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "participant",
  college: "",
};

type FastApiErrorDetail = string | { msg?: string } | Array<{ msg?: string }>;

function formatErrorDetail(detail: FastApiErrorDetail | undefined) {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(" ");
  }

  return detail?.msg;
}

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ detail?: FastApiErrorDetail }>(error)) {
    return (
      formatErrorDetail(error.response?.data?.detail) ??
      "Authentication failed. Please try again."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
}

export default function SignUp() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AuthForm>(initialForm);

  const isRegister = mode === "register";

  function updateForm(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isRegister && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          college: form.college?.trim() || null,
        });
      } else {
        await login(form.email.trim(), form.password);
      }

      navigate("/", { replace: true });
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-copy">
          <p className="eyebrow">Circuit</p>
          <h1 id="auth-title">{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p>
            Sign in to manage events, join challenges, and keep your progress moving.
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <label>
                  Name
                  <input
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={updateForm}
                    required
                  />
                </label>

                <label>
                  Role
                  <select name="role" value={form.role} onChange={updateForm}>
                    <option value="participant">Participant</option>
                    <option value="organizer">Organizer</option>
                  </select>
                </label>
              </>
            )}

            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={updateForm}
                required
              />
            </label>

            {isRegister && (
              <label>
                College
                <input
                  name="college"
                  type="text"
                  autoComplete="organization"
                  value={form.college ?? ""}
                  onChange={updateForm}
                />
              </label>
            )}

            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={form.password}
                onChange={updateForm}
                required
                minLength={6}
              />
            </label>

            {isRegister && (
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={updateForm}
                  required
                  minLength={6}
                />
              </label>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Login"}
            </button>
          </form>

          <p className="auth-footnote">
            {isRegister ? "Already have an account?" : "New to Circuit?"}{" "}
            <Link to="#" onClick={() => switchMode(isRegister ? "login" : "register")}>
              {isRegister ? "Login" : "Create one"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
