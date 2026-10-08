import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import SignUp from "../pages/SignUp";
import "./App.css";

function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-panel">
        <div>
          <p className="eyebrow">Circuit</p>
          <h1>Hi, {user?.name}</h1>
          <p>
            You are signed in as {user?.role}. Your current level is {user?.level}.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Logout
        </button>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<SignUp />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
