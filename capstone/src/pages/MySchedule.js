import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import WeeklySchedule, { COLORS } from "../components/WeeklySchedule";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "../styles/shared.css";
import "./MySchedule.css";

export default function MySchedule() {
  const { user } = useAuth();
  const [departments, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Returns only this user's relevant departments
    api
      .get("/departments")
      .then((res) => setClasses(res.data))
      .catch(() => setError("Could not load your departments."))
      .finally(() => setLoading(false));
  }, []);

  const entries = departments.flatMap((c, classIndex) =>
    (Array.isArray(c.schedule) ? c.schedule : []).map((block) => ({
      ...block,
      label: c.name,
      colorIndex: classIndex,
    }))
  );

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <div className="page-header-block">
          <h1 className="page-title">Your schedule</h1>
          <p className="page-subtitle">
            {user?.role === "staff"
              ? "Every department you're assigned to, laid out across the week."
              : "Every department you manage, laid out across the week."}
          </p>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {loading ? (
          <p className="dashboard-loading">Loading...</p>
        ) : departments.length === 0 ? (
          <p className="dashboard-loading">No departments yet.</p>
        ) : (
          <>
            <div className="schedule-legend">
              {departments.map((c, i) => (
                <div className="legend-item" key={c._id}>
                  <span
                    className="legend-dot"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {c.name}
                </div>
              ))}
            </div>

            <div className="schedule-grid-card">
              <WeeklySchedule entries={entries} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}