import { Navigate, Route, Routes } from "react-router-dom";
import EventForm from "../components/EventForm";
import ProtectedRoute from "../components/ProtectedRoute";
import EventDetail from "../pages/EventDetail";
import EventList from "../pages/EventList";
import Explore from "../pages/Explore";
import SignUp from "../pages/SignUp";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<SignUp />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/events" element={<EventList />} />
      <Route path="/events/:eventId" element={<EventDetail />} />
      <Route
        path="/host-event"
        element={
          <ProtectedRoute role="organizer">
            <EventForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/explore" replace />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/explore" replace />} />
    </Routes>
  );
}
