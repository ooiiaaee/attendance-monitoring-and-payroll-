import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wrap any page that requires login: <ProtectedRoute><Dashboard /></ProtectedRoute>
// Pass allowedRoles to also restrict by role: allowedRoles={["manager", "hr"]}
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return <p style={{ textAlign: "center", marginTop: "40px" }}>Loading...</p>;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
