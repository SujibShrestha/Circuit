import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: "organizer" | "participant" }) {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading...</p>; // don't redirect before the token check finishes
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}