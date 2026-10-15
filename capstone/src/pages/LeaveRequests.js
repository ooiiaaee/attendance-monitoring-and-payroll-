import { useState, useEffect } from "react";
import { Send, Check, X, Clock } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "../styles/shared.css";
import "./LeaveRequests.css";

const STATUS_CONFIG = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export default function LeaveRequests() {
  const { user } = useAuth();
  const isManagerOrHR = user?.role === "manager" || user?.role === "hr";

  const [requests, setRequests] = useState([]);
  const [departments, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Reject dialog with an optional note
  const [rejecting, setRejecting] = useState(null); // { id, staffName }
  const [rejectNote, setRejectNote] = useState("");

  // Staff form state
  const [form, setForm] = useState({ department: "", reason: "", dateFrom: "", dateTo: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async (status) => {
    setLoading(true);
    try {
      const params = status ? { status } : {};
      const res = await api.get("/leave", { params });
      setRequests(res.data);
    } catch (err) {
      setError("Could not load leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = () => {
    if (!isManagerOrHR) return;
    api
      .get("/leave", { params: { status: "pending" } })
      .then((res) => setPendingCount(res.data.length))
      .catch(() => {});
  };

  useEffect(() => {
    loadRequests(statusFilter);
    loadPendingCount();
    if (!isManagerOrHR) {
      api
        .get("/departments")
        .then((res) => {
          setClasses(res.data);
          if (res.data.length > 0) {
            setForm((f) => ({ ...f, department: res.data[0]._id }));
          }
        })
        .catch(() => setError("Could not load your departments."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.department) {
      setFormError("Select a department.");
      return;
    }
    if (!form.reason.trim()) {
      setFormError("Enter a reason for your leave.");
      return;
    }
    if (!form.dateFrom || !form.dateTo) {
      setFormError("Select both a start and end date.");
      return;
    }
    if (form.dateTo < form.dateFrom) {
      setFormError("End date can't be before the start date.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/leave", form);
      setForm((f) => ({ ...f, reason: "", dateFrom: "", dateTo: "" }));
      await loadRequests(statusFilter);
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const openReject = (request) => {
    setRejectNote("");
    setRejecting({ id: request._id, staffName: request.staff?.name || "this staff member" });
  };

  const closeReject = () => {
    setRejecting(null);
    setRejectNote("");
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    const { id } = rejecting;
    closeReject();
    await review(id, "rejected", rejectNote.trim());
  };

  // Escape closes the dialog
  useEffect(() => {
    if (!rejecting) return undefined;
    const onKey = (e) => e.key === "Escape" && closeReject();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rejecting]);

  const review = async (id, status, note) => {
    setBusyId(id);
    try {
      await api.put(`/leave/${id}/review`, { status, note });
      await loadRequests(statusFilter);
      loadPendingCount();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update request.");
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Leave requests</h1>
        <p className="page-subtitle">
          {isManagerOrHR
            ? "Review and respond to staff leave requests."
            : "Submit a request when you'll be missing department."}
        </p>

        {error && <div className="banner banner-error">{error}</div>}

        {isManagerOrHR &&
          (pendingCount > 0 ? (
            <div className="banner banner-error" style={{ marginBottom: "16px" }}>
              <Clock size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {pendingCount} request{pendingCount !== 1 ? "s" : ""} waiting on your review
            </div>
          ) : (
            <div className="banner banner-success" style={{ marginBottom: "16px" }}>
              <Check size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              All caught up — no pending requests
            </div>
          ))}

        {!isManagerOrHR && (
          <form className="card leave-form" onSubmit={handleSubmit} noValidate>
            {formError && <div className="banner banner-error">{formError}</div>}
            <div className="leave-form-row">
              <div className="auth-field" style={{ flex: 1 }}>
                <label className="field-label">Department</label>
                <select
                  className="field-input"
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                >
                  {departments.length === 0 && <option value="">No departments enrolled</option>}
                  {departments.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="leave-form-row">
              <div className="auth-field" style={{ flex: 1 }}>
                <label className="field-label">From</label>
                <input
                  type="date"
                  className="field-input"
                  value={form.dateFrom}
                  onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>
              <div className="auth-field" style={{ flex: 1 }}>
                <label className="field-label">To</label>
                <input
                  type="date"
                  className="field-input"
                  value={form.dateTo}
                  onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="field-label">Reason</label>
              <textarea
                className="field-input leave-textarea"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Medical appointment, family emergency..."
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              <Send size={14} strokeWidth={2} />
              {submitting ? "Submitting..." : "Submit request"}
            </button>
          </form>
        )}

        {isManagerOrHR && (
          <div className="leave-filter-row">
            {["", "pending", "approved", "rejected"].map((s) => (
              <button
                key={s || "all"}
                className={`filter-pill${statusFilter === s ? " active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s ? STATUS_CONFIG[s].label : "All"}
              </button>
            ))}
          </div>
        )}

        <h2 className="section-heading" style={{ marginTop: isManagerOrHR ? 0 : "28px" }}>
          {isManagerOrHR ? "Requests" : "Your requests"}
        </h2>

        {loading ? (
          <p className="dashboard-loading">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="dashboard-loading">No leave requests to show.</p>
        ) : (
          <div className="card leave-table-wrapper">
            <table className="leave-table">
              <thead>
                <tr>
                  {isManagerOrHR && <th className="index-header">#</th>}
                  {isManagerOrHR && <th>Staff</th>}
                  <th>Department</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {isManagerOrHR && <th></th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r, index) => {
                  const config = STATUS_CONFIG[r.status];
                  const staffName = r.staff?.name || "—";
                  const staffEmail = r.staff?.email || "";
                  const initial = staffName !== "—" ? staffName.charAt(0).toUpperCase() : "?";

                  return (
                    <tr key={r._id}>
                      {isManagerOrHR && <td className="index-cell">{index + 1}</td>}
                      {isManagerOrHR && (
                        <td className="leave-cell-strong">
                          <div className="staff-info-container">
                            <div className="staff-avatar">{initial}</div>
                            <div>
                              <div className="staff-name">{staffName}</div>
                              {staffEmail && <div className="staff-email">{staffEmail}</div>}
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="leave-cell-muted">{r.department?.name || "—"}</td>
                      <td className="leave-cell-muted">
                        {formatDate(r.dateFrom)} – {formatDate(r.dateTo)}
                      </td>
                      <td className="leave-reason-cell">{r.reason}</td>
                      <td>
                        <span className={`pill tone-${config.tone}`}>
                          {r.status === "pending" && <Clock size={12} strokeWidth={2.5} />}
                          {r.status === "approved" && <Check size={12} strokeWidth={2.5} />}
                          {r.status === "rejected" && <X size={12} strokeWidth={2.5} />}
                          {config.label}
                        </span>
                        {r.status === "rejected" && r.reviewNote && (
                          <div className="leave-note">
                            <span className="leave-note-label">
                              Note{r.reviewedBy?.name ? ` from ${r.reviewedBy.name}` : ""}:
                            </span>{" "}
                            {r.reviewNote}
                          </div>
                        )}
                      </td>
                      {isManagerOrHR && (
                        <td>
                          {r.status === "pending" && (
                            <div className="leave-review-buttons">
                              <button
                                className="leave-review-btn approve"
                                disabled={busyId === r._id}
                                onClick={() => review(r._id, "approved")}
                                title="Approve"
                              >
                                <Check size={13} strokeWidth={2.5} />
                              </button>
                              <button
                                className="leave-review-btn reject"
                                disabled={busyId === r._id}
                                onClick={() => openReject(r)}
                                title="Reject"
                              >
                                <X size={13} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejecting && (
        <div className="leave-modal-backdrop" onClick={closeReject}>
          <div
            className="leave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-reject-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="leave-modal-title" id="leave-reject-title">
              Reject leave request
            </h2>
            <p className="leave-modal-sub">
              {rejecting.staffName} will be able to see your note along with the decision. It's
              optional, but a short reason helps.
            </p>
            <textarea
              className="leave-textarea"
              rows={4}
              maxLength={500}
              autoFocus
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Not enough coverage that week — please resubmit for the following week."
            />
            <div className="leave-modal-count">{rejectNote.length}/500</div>
            <div className="leave-modal-actions">
              <button className="leave-modal-btn leave-modal-cancel" onClick={closeReject}>
                Cancel
              </button>
              <button className="leave-modal-btn leave-modal-danger" onClick={confirmReject}>
                Reject request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}