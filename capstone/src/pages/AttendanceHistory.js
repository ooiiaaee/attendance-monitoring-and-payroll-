import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "../styles/shared.css";
import "./AttendanceHistory.css";

export default function AttendanceHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?._id) return;
    api
      .get(`/attendance/staff/${user._id}`)
      .then((res) => setRecords(res.data))
      .catch(() => setError("Could not load your attendance history."))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Attendance history</h1>
        <p className="page-subtitle">Every session you've been recorded for, most recent first.</p>

        {error && <div className="banner banner-error">{error}</div>}

        {loading ? (
          <p className="dashboard-loading">Loading...</p>
        ) : records.length === 0 ? (
          <p className="dashboard-loading">No attendance records yet.</p>
        ) : (
          <div className="card history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  return (
                    <tr key={r._id}>
                      <td className="history-department-name">
                        {r.session?.department?.name || "—"}
                      </td>
                      <td className="history-date">
                        {r.session?.date
                          ? new Date(r.session.date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="history-time">
                        {r.status === "absent" || r.status === "excused"
                          ? "—"
                          : new Date(r.timestamp).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                      </td>
                      <td className="history-time">
                        {r.status !== "absent" && r.status !== "excused" && r.checkOutTime
                          ? new Date(r.checkOutTime).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="history-time">
                        {r.status !== "absent" && r.status !== "excused" && r.hoursWorked != null
                          ? `${r.hoursWorked}h`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
