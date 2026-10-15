import { useState, useEffect, Fragment } from "react";
import { Trash2, UserX, UserPlus, KeyRound, Check, X, UserCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import "../styles/shared.css";
import "./AdminPanel.css";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [departments, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "manager" });
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [resetTargetId, setResetTargetId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetting, setResetting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, classesRes] = await Promise.all([
        api.get("/auth/users"),
        api.get("/departments"),
      ]);
      setUsers(usersRes.data);
      setClasses(classesRes.data);
    } catch (err) {
      setError("Could not load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingTeachers = users.filter((u) => u.role === "manager" && !u.approved);

  const approveUser = async (id) => {
    setBusyId(id);
    try {
      await api.put(`/auth/users/${id}/approve`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not approve account.");
    } finally {
      setBusyId(null);
    }
  };

  const declineUser = async (u) => {
    if (
      !window.confirm(
        `Decline ${u.name}'s manager request? Their account will be removed and they'll be emailed. They can register again later.`
      )
    )
      return;
    setBusyId(u._id);
    setError("");
    try {
      await api.delete(`/auth/users/${u._id}/decline`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not decline account.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError("Name, email, and password are all required.");
      return;
    }
    if (form.password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setCreating(true);
    try {
      await api.post("/auth/users", form);
      setForm({ name: "", email: "", password: "", role: "manager" });
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not create account.");
    } finally {
      setCreating(false);
    }
  };

  const deactivateUser = async (id) => {
    if (!window.confirm("Deactivate this user? They won't be able to log in, but their history (attendance, payroll, etc.) is kept.")) return;
    setBusyId(id);
    try {
      await api.delete(`/auth/users/${id}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not deactivate user.");
    } finally {
      setBusyId(null);
    }
  };

  const reactivateUser = async (id) => {
    setBusyId(id);
    try {
      await api.put(`/auth/users/${id}/reactivate`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not reactivate user.");
    } finally {
      setBusyId(null);
    }
  };

  const deactivateClass = async (id) => {
    if (!window.confirm("Deactivate this department? It will disappear from the manager's and staff's own views, but its history (sessions, attendance, payroll) is kept.")) return;
    setBusyId(id);
    try {
      await api.delete(`/departments/${id}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not deactivate department.");
    } finally {
      setBusyId(null);
    }
  };

  const reactivateClass = async (id) => {
    setBusyId(id);
    try {
      await api.put(`/departments/${id}/reactivate`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not reactivate department.");
    } finally {
      setBusyId(null);
    }
  };

  const openReset = (id) => {
    setResetTargetId(resetTargetId === id ? null : id);
    setResetPassword("");
    setResetError("");
    setResetSuccess("");
  };

  const submitReset = async (id) => {
    setResetError("");
    setResetSuccess("");
    if (!resetPassword || resetPassword.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }
    setResetting(true);
    try {
      await api.put(`/auth/users/${id}/reset-password`, { newPassword: resetPassword });
      setResetSuccess("Password reset.");
      setResetPassword("");
      setTimeout(() => setResetTargetId(null), 1200);
    } catch (err) {
      setResetError(err.response?.data?.message || "Could not reset password.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">System overview</h1>
        <p className="page-subtitle">Manage every user and department in the system.</p>

        {error && <div className="banner banner-error">{error}</div>}

        {pendingTeachers.length > 0 && (
          <>
            <h2 className="section-heading">
              Pending manager approvals ({pendingTeachers.length})
            </h2>
            <div className="card admin-table-wrapper" style={{ marginBottom: "32px" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTeachers.map((u) => (
                    <tr key={u._id}>
                      <td className="admin-cell-strong">{u.name}</td>
                      <td className="admin-cell-muted">{u.email}</td>
                      <td>
                        <div className="approval-actions">
                          <button
                            className="approval-btn approval-btn-approve"
                            disabled={busyId === u._id}
                            onClick={() => approveUser(u._id)}
                          >
                            <Check size={14} strokeWidth={2.5} />
                            Approve
                          </button>
                          <button
                            className="approval-btn approval-btn-decline"
                            disabled={busyId === u._id}
                            onClick={() => declineUser(u)}
                          >
                            <X size={14} strokeWidth={2.5} />
                            Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className="section-heading">Create an account</h2>
        <form className="card admin-create-form" onSubmit={handleCreateUser} noValidate>
          {formError && <div className="banner banner-error">{formError}</div>}
          <div className="admin-create-row">
            <div className="admin-create-field">
              <label className="field-label">Name</label>
              <input
                className="field-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="admin-create-field">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="admin-create-field">
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="admin-create-field admin-create-role">
              <label className="field-label">Role</label>
              <select
                className="field-input"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="manager">Manager</option>
                <option value="hr">HR Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating}>
              <UserPlus size={15} strokeWidth={2} />
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          <p className="admin-create-note">
            Accounts created here are pre-approved and can log in immediately, regardless of role.
          </p>
        </form>

        {loading ? (
          <p className="dashboard-loading">Loading...</p>
        ) : (
          <>
            <h2 className="section-heading">Users ({users.length})</h2>
            <div className="card admin-table-wrapper" style={{ marginBottom: "36px" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Staff ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <Fragment key={u._id}>
                      <tr key={u._id} style={!u.isActive ? { opacity: 0.6 } : undefined}>
                        <td className="admin-cell-strong">{u.name}</td>
                        <td className="admin-cell-muted">{u.email}</td>
                        <td>
                          <span
                            className={`pill capitalize ${
                              u.role === "hr"
                                ? "tone-danger"
                                : u.role === "manager"
                                ? "tone-accent"
                                : "tone-success"
                            }`}
                          >
                            {u.role}
                          </span>
                          {u.role === "manager" && !u.approved && (
                            <span className="pill pill-sm uppercase tone-warning" style={{ marginLeft: "6px" }}>
                              <UserCheck size={11} strokeWidth={2.5} /> Pending
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`pill pill-sm uppercase ${u.isActive ? "tone-success" : "tone-danger"}`}>
                            {u.isActive ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="admin-cell-muted">{u.staffId || "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="admin-delete-btn"
                              onClick={() => openReset(u._id)}
                              title="Reset password"
                            >
                              <KeyRound size={14} strokeWidth={2} />
                            </button>
                            {u.isActive ? (
                              <button
                                className="admin-delete-btn"
                                disabled={busyId === u._id}
                                onClick={() => deactivateUser(u._id)}
                                title="Deactivate user"
                              >
                                <UserX size={14} strokeWidth={2} />
                              </button>
                            ) : (
                              <button
                                className="admin-delete-btn"
                                disabled={busyId === u._id}
                                onClick={() => reactivateUser(u._id)}
                                title="Reactivate user"
                              >
                                <UserCheck size={14} strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {resetTargetId === u._id && (
                        <tr key={`${u._id}-reset`}>
                          <td colSpan={6} className="admin-reset-row">
                            {resetError && (
                              <div className="banner banner-error" style={{ marginBottom: "8px" }}>
                                {resetError}
                              </div>
                            )}
                            {resetSuccess && (
                              <div
                                className="banner banner-success"
                                style={{ marginBottom: "8px" }}
                              >
                                {resetSuccess}
                              </div>
                            )}
                            <div className="admin-reset-inline">
                              <input
                                className="field-input"
                                type="password"
                                placeholder={`New password for ${u.name}`}
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                              />
                              <button
                                className="btn btn-primary"
                                disabled={resetting}
                                onClick={() => submitReset(u._id)}
                              >
                                {resetting ? "Saving..." : "Set password"}
                              </button>
                              <button className="btn btn-ghost" onClick={() => openReset(u._id)}>
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="section-heading">Departments ({departments.length})</h2>
            <div className="card admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Manager</th>
                    <th>Staff</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((c) => (
                    <tr key={c._id} style={!c.isActive ? { opacity: 0.6 } : undefined}>
                      <td className="admin-cell-strong">{c.name}</td>
                      <td className="admin-cell-muted">{c.manager?.name || "—"}</td>
                      <td className="admin-cell-muted">{c.staff.length}</td>
                      <td>
                        <span className={`pill pill-sm uppercase ${c.isActive ? "tone-success" : "tone-danger"}`}>
                          {c.isActive ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td>
                        {c.isActive ? (
                          <button
                            className="admin-delete-btn"
                            disabled={busyId === c._id}
                            onClick={() => deactivateClass(c._id)}
                            title="Deactivate department"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        ) : (
                          <button
                            className="admin-delete-btn"
                            disabled={busyId === c._id}
                            onClick={() => reactivateClass(c._id)}
                            title="Reactivate department"
                          >
                            <UserCheck size={14} strokeWidth={2} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
