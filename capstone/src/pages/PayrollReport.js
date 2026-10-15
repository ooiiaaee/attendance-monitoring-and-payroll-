import { useState, useEffect } from "react";
import { Download, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import "../styles/shared.css";
import "./PayrollReport.css";

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfMonthISO = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const formatMoney = (n) =>
  (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function PayrollReport() {
  const [departments, setDepartments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Record-a-payment form
  const [payStaffId, setPayStaffId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payFrom, setPayFrom] = useState(firstOfMonthISO());
  const [payTo, setPayTo] = useState(todayISO());
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Optional hours-logged reference panel
  const [showHoursRef, setShowHoursRef] = useState(false);
  const [hoursRef, setHoursRef] = useState(null);
  const [hoursRefLoading, setHoursRefLoading] = useState(false);

  const selectedDepartment = departments.find((d) => d._id === selectedId);
  const payRecipients = selectedDepartment
    ? [
        selectedDepartment.manager && { ...selectedDepartment.manager, _role: "manager" },
        ...selectedDepartment.staff.map((s) => ({ ...s, _role: "staff" })),
      ].filter(Boolean)
    : [];

  useEffect(() => {
    api
      .get("/departments")
      .then((res) => {
        setDepartments(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0]._id);
        else setLoading(false);
      })
      .catch(() => {
        setError("Could not load your departments.");
        setLoading(false);
      });
  }, []);

  const runReport = () => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    api
      .get(`/payroll/department/${selectedId}`, { params: { from, to } })
      .then((res) => setReport(res.data))
      .catch((err) => {
        // Clear the previous department's numbers if the request fails
        setReport(null);
        setError(err.response?.data?.message || "Could not load payroll records.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedId) runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const loadHoursRef = () => {
    if (!selectedId) return;
    setHoursRefLoading(true);
    api
      .get(`/departments/${selectedId}/payroll`, { params: { from, to } })
      .then((res) => setHoursRef(res.data))
      .catch(() => setHoursRef(null))
      .finally(() => setHoursRefLoading(false));
  };

  const toggleHoursRef = () => {
    const next = !showHoursRef;
    setShowHoursRef(next);
    if (next && !hoursRef) loadHoursRef();
  };

  const recordPayment = (e) => {
    e.preventDefault();
    setFormError("");

    if (!payStaffId) return setFormError("Choose who you're paying.");
    const amountNum = Number(payAmount);
    if (!payAmount || isNaN(amountNum) || amountNum <= 0) {
      return setFormError("Enter an amount greater than 0.");
    }
    if (!payFrom || !payTo) return setFormError("Set the period this payment covers.");

    setSaving(true);
    api
      .post("/payroll", {
        staff: payStaffId,
        department: selectedId,
        amount: amountNum,
        periodFrom: payFrom,
        periodTo: payTo,
        note: payNote.trim(),
      })
      .then(() => {
        setPayStaffId("");
        setPayAmount("");
        setPayNote("");
        runReport();
      })
      .catch((err) => setFormError(err.response?.data?.message || "Could not save this payment."))
      .finally(() => setSaving(false));
  };

  const removePayment = (id) => {
    if (!window.confirm("Remove this payment record?")) return;
    api
      .delete(`/payroll/${id}`)
      .then(() => runReport())
      .catch((err) => setError(err.response?.data?.message || "Could not remove this payment."));
  };

  const exportCsv = () => {
    if (!report) return;
    const header = ["Staff Name", "Email", "Staff ID", "Amount", "Period From", "Period To", "Paid At", "Paid By", "Note"];
    const rows = report.payments.map((p) =>
      [
        p.staff.name,
        p.staff.email,
        p.staff.staffId || "",
        p.amount,
        new Date(p.periodFrom).toISOString().slice(0, 10),
        new Date(p.periodTo).toISOString().slice(0, 10),
        new Date(p.paidAt).toISOString().slice(0, 10),
        p.paidBy?.name || "",
        p.note || "",
      ]
        .map((f) => `"${String(f).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.departmentName}-payments-${from}-to-${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="payroll-layout-container">
      <Sidebar />
      <div className="page-shell">
        <div className="page-header-block">
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">Record what you actually paid each person, and track it over time.</p>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {departments.length === 0 && !loading ? (
          <p className="dashboard-loading">No departments yet — HR creates departments and assigns a manager to each.</p>
        ) : (
          <>
            <div className="card payroll-controls">
              <div className="payroll-control-field">
                <label className="field-label">Department</label>
                <select
                  className="field-input"
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setHoursRef(null);
                  }}
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="payroll-control-field">
                <label className="field-label">From</label>
                <input
                  type="date"
                  className="field-input"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="payroll-control-field">
                <label className="field-label">To</label>
                <input
                  type="date"
                  className="field-input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <button className="btn btn-primary payroll-refresh-btn" onClick={runReport} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {loading ? (
              <p className="dashboard-loading">Loading...</p>
            ) : report ? (
              <>
                <div className="stat-strip">
                  <div className="stat-strip-item">
                    <div className="stat-strip-top-label">Total paid</div>
                    <div className="stat-strip-value">₱{formatMoney(report.totalPaid)}</div>
                    <div className="stat-strip-label">Total paid in range</div>
                  </div>
                  <div className="stat-strip-item">
                    <div className="stat-strip-top-label">Payments</div>
                    <div className="stat-strip-value">{report.paymentCount}</div>
                    <div className="stat-strip-label">Payments recorded</div>
                  </div>
                  <div className="stat-strip-item">
                    <div className="stat-strip-top-label">People</div>
                    <div className="stat-strip-value">{report.staffPaidCount}</div>
                    <div className="stat-strip-label">People paid</div>
                  </div>
                </div>

                <div className="card payroll-form-card">
                  <h2 className="section-heading">Record a payment</h2>
                  {formError && <div className="banner banner-error">{formError}</div>}
                  <form className="payroll-form" onSubmit={recordPayment}>
                    <div className="payroll-control-field">
                      <label className="field-label">Paid to</label>
                      <select
                        className="field-input"
                        value={payStaffId}
                        onChange={(e) => setPayStaffId(e.target.value)}
                      >
                        <option value="">Select a person...</option>
                        {payRecipients.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} {p._role === "manager" ? "(manager)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="payroll-control-field">
                      <label className="field-label">Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="field-input"
                        placeholder="0.00"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </div>
                    <div className="payroll-control-field">
                      <label className="field-label">Period from</label>
                      <input
                        type="date"
                        className="field-input"
                        value={payFrom}
                        onChange={(e) => setPayFrom(e.target.value)}
                      />
                    </div>
                    <div className="payroll-control-field">
                      <label className="field-label">Period to</label>
                      <input
                        type="date"
                        className="field-input"
                        value={payTo}
                        onChange={(e) => setPayTo(e.target.value)}
                      />
                    </div>
                    <div className="payroll-control-field payroll-note-field">
                      <label className="field-label">Note (optional)</label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="e.g. bi-weekly pay, bonus, overtime..."
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                      />
                    </div>
                    <button className="btn btn-primary payroll-submit-btn" type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save payment"}
                    </button>
                  </form>
                </div>

                {report.byStaff.length > 0 && (
                  <div className="card payroll-table-wrapper">
                    <h2 className="section-heading payroll-section-heading">By person</h2>
                    <table className="payroll-table">
                      <thead>
                        <tr>
                          <th>Staff</th>
                          <th>Total paid</th>
                          <th>Payments</th>
                          <th>Last paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byStaff.map((row) => (
                          <tr key={row.staff._id}>
                            <td>
                              <div className="payroll-staff-name">{row.staff.name}</div>
                              <div className="payroll-staff-email">{row.staff.email}</div>
                            </td>
                            <td className="payroll-hours-value">₱{formatMoney(row.totalPaid)}</td>
                            <td className="payroll-cell-muted">{row.paymentCount}</td>
                            <td className="payroll-cell-muted">{formatDate(row.lastPaidAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="payroll-toolbar">
                  <div className="payroll-summary">Every payment recorded in range</div>
                  <button className="btn btn-ghost" onClick={exportCsv} disabled={report.payments.length === 0}>
                    <Download size={14} strokeWidth={2} /> Export CSV
                  </button>
                </div>

                <div className="card payroll-table-wrapper">
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Amount</th>
                        <th>Period</th>
                        <th>Paid at</th>
                        <th>Paid by</th>
                        <th>Note</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.payments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="payroll-cell-muted">
                            No payments recorded in this range yet.
                          </td>
                        </tr>
                      ) : (
                        report.payments.map((p) => (
                          <tr key={p._id}>
                            <td>
                              <div className="payroll-staff-name">{p.staff.name}</div>
                              <div className="payroll-staff-email">{p.staff.email}</div>
                            </td>
                            <td className="payroll-hours-value">₱{formatMoney(p.amount)}</td>
                            <td className="payroll-cell-muted">
                              {formatDate(p.periodFrom)} – {formatDate(p.periodTo)}
                            </td>
                            <td className="payroll-cell-muted">{formatDate(p.paidAt)}</td>
                            <td className="payroll-cell-muted">{p.paidBy?.name || "—"}</td>
                            <td className="payroll-cell-muted">{p.note || "—"}</td>
                            <td className="payroll-action-cell">
                              <button
                                className="admin-delete-btn"
                                onClick={() => removePayment(p._id)}
                                title="Remove payment"
                              >
                                <Trash2 size={14} strokeWidth={2} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <button className="btn btn-ghost payroll-ref-toggle" onClick={toggleHoursRef}>
                  {showHoursRef ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showHoursRef ? "Hide" : "Show"} hours logged (reference only — not used to calculate pay)
                </button>

                {showHoursRef && (
                  <div className="card payroll-table-wrapper payroll-ref-panel">
                    {hoursRefLoading ? (
                      <p className="dashboard-loading">Loading...</p>
                    ) : hoursRef ? (
                      <table className="payroll-table">
                        <thead>
                          <tr>
                            <th>Staff</th>
                            <th>Staff ID</th>
                            <th>Sessions worked</th>
                            <th>Total hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hoursRef.payroll.map((row) => (
                            <tr key={row.staff._id}>
                              <td>
                                <div className="payroll-staff-name">{row.staff.name}</div>
                                <div className="payroll-staff-email">{row.staff.email}</div>
                              </td>
                              <td className="payroll-cell-muted">{row.staff.staffId || "—"}</td>
                              <td className="payroll-cell-muted">{row.sessionsWorked}</td>
                              <td className="payroll-hours-value">{row.totalHours.toFixed(1)}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="payroll-cell-muted">Couldn't load hours reference.</p>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}