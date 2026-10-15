import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import "../styles/shared.css";
import "./AttendanceAlerts.css";

const DEFAULT_THRESHOLD = 75;

export default function AttendanceAlerts() {
  const [departments, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [summary, setSummary] = useState(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/departments")
      .then((res) => {
        setClasses(res.data);
        if (res.data.length > 0) setSelectedClassId(res.data[0]._id);
        else setLoading(false);
      })
      .catch(() => {
        setError("Could not load your departments.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    setLoading(true);
    api
      .get(`/departments/${selectedClassId}/summary`)
      .then((res) => setSummary(res.data))
      .catch(() => setError("Could not load attendance summary."))
      .finally(() => setLoading(false));
  }, [selectedClassId]);

  const atRisk = (summary?.summary || [])
    .filter((s) => s.rate !== null && s.rate < threshold)
    .sort((a, b) => a.rate - b.rate);

  const allStudents = (summary?.summary || []).slice().sort((a, b) => {
    if (a.rate === null) return 1;
    if (b.rate === null) return -1;
    return a.rate - b.rate;
  });

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Attendance alerts</h1>
        <p className="page-subtitle">
          Staff whose attendance rate has fallen below your threshold.
        </p>

        {error && <div className="banner banner-error">{error}</div>}

        {departments.length === 0 ? (
          <p className="dashboard-loading">No departments yet — HR creates departments and assigns a manager to each.</p>
        ) : (
          <>
            <div className="card alerts-controls">
              <div className="alerts-control-field">
                <label className="field-label">Department</label>
                <select
                  className="field-input"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  {departments.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="alerts-control-field alerts-threshold-field">
                <label className="field-label">Alert below (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="field-input"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>
            </div>

            {loading ? (
              <p className="dashboard-loading">Loading...</p>
            ) : summary?.totalSessions === 0 ? (
              <p className="dashboard-loading">No sessions recorded yet for this department.</p>
            ) : (
              <>
                {atRisk.length > 0 ? (
                  <div className="alert-banner">
                    <AlertTriangle size={17} strokeWidth={2.2} />
                    {atRisk.length} staff member{atRisk.length !== 1 ? "s" : ""} below {threshold}%
                    attendance
                  </div>
                ) : (
                  <div className="alert-banner ok">
                    <CheckCircle2 size={17} strokeWidth={2.2} />
                    No staff currently below {threshold}%
                  </div>
                )}

                <div className="card alerts-table-wrapper">
                  <table className="alerts-table">
                    <thead>
                      <tr>
                        <th className="index-header">#</th>
                        <th>Staff</th>
                        <th>Rate</th>
                        <th>Present</th>
                        <th>Late</th>
                        <th>Absent</th>
                        <th>Excused</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStudents.map((row, index) => {
                        const staffName = row.staff?.name || "Unknown Staff";
                        const staffEmail = row.staff?.email || "";
                        const initial = staffName.charAt(0).toUpperCase();

                        return (
                          <tr
                            key={row.staff._id}
                            className={row.rate !== null && row.rate < threshold ? "at-risk" : ""}
                          >
                            <td className="index-cell">{index + 1}</td>
                            <td className="alerts-cell-strong">
                              <div className="staff-info-container">
                                <div className="staff-avatar">{initial}</div>
                                <div>
                                  <div className="staff-name">{staffName}</div>
                                  {staffEmail && <div className="staff-email">{staffEmail}</div>}
                                </div>
                              </div>
                            </td>
                            <td>
                              {row.rate !== null ? (
                                <span
                                  className={`pill ${
                                    row.rate < threshold ? "tone-danger solid" : "tone-success"
                                  }`}
                                >
                                  {row.rate}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            {[row.present, row.late, row.absent, row.excused].map((n, i) => (
                              <td key={i} className={`alerts-count${n ? "" : " zero"}`}>
                                {n}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}