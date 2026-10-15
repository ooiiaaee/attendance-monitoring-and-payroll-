import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ManagerSessions from "./pages/ManagerSessions";
import DepartmentManagement from "./pages/DepartmentManagement";
import DepartmentDetail from "./pages/DepartmentDetail";
import StaffCheckin from "./pages/StaffCheckin";
import AttendanceSheet from "./pages/AttendanceSheet";
import Profile from "./pages/Profile";
import AttendanceHistory from "./pages/AttendanceHistory";
import AdminPanel from "./pages/AdminPanel";
import AttendanceAlerts from "./pages/AttendanceAlerts";
import MySchedule from "./pages/MySchedule";
import LeaveRequests from "./pages/LeaveRequests";
import AuditLog from "./pages/AuditLog";
import PayrollReport from "./pages/PayrollReport";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/departments"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr"]}>
                <DepartmentManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/departments/:id"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr"]}>
                <DepartmentDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sessions"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr"]}>
                <ManagerSessions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr"]}>
                <AttendanceSheet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr"]}>
                <AttendanceAlerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr", "staff"]}>
                <MySchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leave"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr", "staff"]}>
                <LeaveRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["hr"]}>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-log"
            element={
              <ProtectedRoute allowedRoles={["hr"]}>
                <AuditLog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <ProtectedRoute allowedRoles={["manager", "hr"]}>
                <PayrollReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkin"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <StaffCheckin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <AttendanceHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
