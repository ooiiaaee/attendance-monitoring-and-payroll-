import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import "../styles/shared.css";
import "./AuditLog.css";

const ACTION_LABELS = {
  "user.approve": "Approved account",
  "user.decline": "Declined account",
  "user.reset_password": "Reset password",
  "user.change_password": "Changed own password",
  "department.assign_manager": "Changed department manager",
  "user.deactivate": "Deactivated user",
  "user.reactivate": "Reactivated user",
  "department.deactivate": "Deactivated department",
  "department.reactivate": "Reactivated department",
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = (action) => {
    setLoading(true);
    api
      .get("/audit", { params: action ? { action } : {} })
      .then((res) => {
        setEntries(res.data.entries);
        setTotal(res.data.total);
      })
      .catch(() => setError("Could not load the audit log."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(actionFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Audit log</h1>
        <p className="page-subtitle">A record of every destructive or security-sensitive HR action.</p>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="audit-filter-row">
          {[
            { value: "", label: "All" },
            { value: "user.approve", label: "Approvals" },
            { value: "user.decline", label: "Declines" },
            { value: "user.reset_password", label: "Password resets" },
            { value: "user.deactivate", label: "User deactivations" },
            { value: "user.reactivate", label: "User reactivations" },
            { value: "department.deactivate", label: "Department deactivations" },
            { value: "department.reactivate", label: "Department reactivations" },
            { value: "department.assign_manager", label: "Manager changes" },
          ].map((f) => (
            <button
              key={f.value || "all"}
              className={`filter-pill${actionFilter === f.value ? " active" : ""}`}
              onClick={() => setActionFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="dashboard-loading">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="dashboard-loading">No audit entries yet.</p>
        ) : (
          <>
            <div className="card audit-table-wrapper">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e._id}>
                      <td className="audit-cell-muted">{formatDate(e.createdAt)}</td>
                      <td className="audit-cell-strong">{e.actor?.name || "—"}</td>
                      <td>{ACTION_LABELS[e.action] || e.action}</td>
                      <td className="audit-cell-muted">{e.details || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="audit-total-note">{total} total entries</p>
          </>
        )}
      </div>
    </div>
  );
}
