import { useState, useEffect, useCallback, useRef } from "react";
import { Trash2, RefreshCw, Download, Printer, AlertTriangle, Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import StatusBadge, { STATUS_CONFIG } from "../components/StatusBadge";
import api from "../api/axios";
import "../styles/shared.css";
import "./AttendanceSheet.css";

// Statuses available for manual marking
const MARKABLE_STATUSES = ["present", "late", "absent", "excused"];

const POLL_INTERVAL_MS = 5000;

// "YYYY-MM-DD" in the browser's local time
const dayKeyOf = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayKey = () => dayKeyOf(new Date());

// Builds a local Date from a day key without time-zone surprises
const dateFromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default function AttendanceSheet() {
  const [departments, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classDetail, setClassDetail] = useState(null);

  // Attendance is per day; the session is created when someone is first marked
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [session, setSession] = useState(null);
  const selectedSessionId = session?._id || "";

  const [records, setRecords] = useState([]);
  const [, setLoading] = useState(true); // loading flag isn't shown anywhere (yet)
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Cell being edited: { id: recordId, field: "in" | "out" } and its datetime-local value
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");

  const pollRef = useRef(null);

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

  // Department details
  useEffect(() => {
    if (!selectedClassId) return;
    api
      .get(`/departments/${selectedClassId}`)
      .then((res) => setClassDetail(res.data))
      .catch(() => setError("Could not load department details."));
  }, [selectedClassId]);

  // Session for the chosen day
  useEffect(() => {
    if (!selectedClassId || !selectedDay) return;
    let cancelled = false;
    setLoading(true);
    setSession(null);
    setRecords([]);
    api
      .get(`/sessions/department/${selectedClassId}/day/${selectedDay}`)
      .then((res) => {
        if (cancelled) return;
        setSession(res.data.session);
        if (!res.data.session) setLoading(false); // nothing recorded yet for this day
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load that day.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, selectedDay]);

  // id lets markStatus load a session it just created
  const loadRecords = useCallback(
    (id) => {
      const sessionId = typeof id === "string" ? id : selectedSessionId;
      if (!sessionId) return;
      api
        .get(`/attendance/session/${sessionId}`)
        .then((res) => setRecords(res.data))
        .catch(() => setError("Could not load attendance records."))
        .finally(() => setLoading(false));
    },
    [selectedSessionId]
  );

  useEffect(() => {
    if (!selectedSessionId) return;
    setLoading(true);
    loadRecords();

    pollRef.current = setInterval(loadRecords, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [selectedSessionId, loadRecords]);

  // Absent/excused: no check-in, check-out or hours
  const hasTimes = (record) => !!record && !["absent", "excused"].includes(record.status);

  const recordForStudent = (staffId) =>
    records.find((r) => r.staff?._id === staffId);

  const markStatus = async (staffId, status) => {
    setSavingId(staffId);
    setError("");
    try {
      let sessionId = selectedSessionId;
      if (!sessionId) {
        // First mark of the day creates the session
        const created = await api.post("/sessions/day", {
          departmentId: selectedClassId,
          date: selectedDay,
        });
        setSession(created.data);
        sessionId = created.data._id;
      }
      await api.post("/attendance/manual", { sessionId, staffId, status });
      loadRecords(sessionId);
    } catch (err) {
      setError(err.response?.data?.message || "Could not update status.");
    } finally {
      setSavingId(null);
    }
  };

  // datetime-local inputs want local time as "YYYY-MM-DDTHH:mm"
  const toLocalInput = (date) => {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const beginEdit = (record, field) => {
    setError("");
    setEditing({ id: record._id, field });
    const existing = field === "in" ? record.timestamp : record.checkOutTime;
    // Default a new check-out to the check-in's day
    setEditValue(toLocalInput(existing || new Date()));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const saveEdit = async (record, staffId) => {
    if (!editValue || !editing) return;
    setError("");

    // Catch AM/PM and wrong-day mistakes with a specific message
    const fmt = (d) =>
      new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    const picked = new Date(editValue);
    if (editing.field === "out" && picked < new Date(record.timestamp)) {
      setError(
        `Check-out (${fmt(picked)}) is earlier than check-in (${fmt(
          record.timestamp
        )}). Check the date and AM/PM — for after midnight, pick the next day.`
      );
      return;
    }
    if (editing.field === "in" && record.checkOutTime && picked > new Date(record.checkOutTime)) {
      setError(
        `Check-in (${fmt(picked)}) is later than check-out (${fmt(
          record.checkOutTime
        )}). Adjust the check-out first, or pick an earlier check-in.`
      );
      return;
    }

    setSavingId(staffId);
    try {
      const iso = new Date(editValue).toISOString();
      await api.put(`/attendance/${record._id}/times`, {
        [editing.field === "in" ? "checkInTime" : "checkOutTime"]: iso,
      });
      cancelEdit();
      loadRecords();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the time.");
    } finally {
      setSavingId(null);
    }
  };

  // Shows the time, plus a small date when it differs from relativeTo
  const formatTimeWithDate = (value, relativeTo) => {
    const d = new Date(value);
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const showDate = !relativeTo || d.toDateString() !== new Date(relativeTo).toDateString();
    return (
      <>
        {time}
        {showDate && (
          <div className="time-date">
            {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        )}
      </>
    );
  };

  const renderEditor = (record, staffId, isSaving) => (
    <span className="checkout-edit no-print">
      <input
        type="datetime-local"
        className="checkout-time-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        autoFocus
      />
      <button
        className="checkout-btn"
        disabled={isSaving}
        onClick={() => saveEdit(record, staffId)}
      >
        Save
      </button>
      <button className="checkout-btn checkout-btn-ghost" disabled={isSaving} onClick={cancelEdit}>
        Cancel
      </button>
    </span>
  );

  const removeRecord = async (recordId, staffId) => {
    setSavingId(staffId);
    try {
      await api.delete(`/attendance/${recordId}`);
      loadRecords();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove record.");
    } finally {
      setSavingId(null);
    }
  };

  const formatDayLabel = (key) =>
    dateFromKey(key).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const staff = classDetail?.staff || [];
  
  // Filter staff by search and status
  const filteredStaff = staff.filter((member) => {
    const record = recordForStudent(member._id);
    const matchesSearch = 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "checked-in") return record && ["present", "late", "excused"].includes(record.status);
    if (statusFilter === "pending") return !record;
    return record && record.status === statusFilter;
  });

  const presentLikeCount = staff.filter((s) => {
    const r = recordForStudent(s._id);
    return r && ["present", "late", "excused"].includes(r.status);
  }).length;

  const selectedClassName = classDetail?.name || "";

  const exportCsv = () => {
    const header = ["Staff Name", "Email", "Status", "Check-in", "Check-out", "Hours", "Flagged"];
    const rows = staff.map((staffMember) => {
      const record = recordForStudent(staffMember._id);
      const status = record ? STATUS_CONFIG[record.status].label : "Not checked in";
      const timeFmt = (d) =>
        d ? new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
      const checkIn = hasTimes(record) ? timeFmt(record.timestamp) : "";
      const checkOut = hasTimes(record) ? timeFmt(record.checkOutTime) : "";
      const hours = hasTimes(record) && record.hoursWorked != null ? record.hoursWorked : "";
      const flagged = record?.flagged ? record.flagReason || "Yes" : "";
      return [staffMember.name, staffMember.email, status, checkIn, checkOut, hours, flagged]
        .map((f) => `"${f}"`)
        .join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateLabel = selectedDay;
    link.href = url;
    link.download = `${selectedClassName || "attendance"}-${dateLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    window.print();
  };

  // Generates avatar colors from names
  const getAvatarColor = (name) => {
    const colors = ["#0284c7", "#7c3aed", "#db2777", "#059669", "#d97706", "#4f46e5"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        {/* Header */}
        <div className="members-header-row">
          <div>
            <h1 className="page-title">Roster & Attendance</h1>
            <p className="page-subtitle">
              Live view of who's checked in — updates automatically as staff scan.
            </p>
          </div>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {departments.length === 0 ? (
          <p className="dashboard-loading">No departments yet — HR creates departments and assigns a manager to each.</p>
        ) : (
          <>
            {/* Controls */}
            <div className="card sheet-controls">
              <div className="sheet-control-field">
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
              <div className="sheet-control-field">
                <label className="field-label">Date</label>
                <div className="sheet-date-row">
                  <input
                    type="date"
                    className="field-input"
                    value={selectedDay}
                    max={todayKey()}
                    onChange={(e) => e.target.value && setSelectedDay(e.target.value)}
                  />
                  {selectedDay !== todayKey() && (
                    <button
                      type="button"
                      className="sheet-today-btn"
                      onClick={() => setSelectedDay(todayKey())}
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>
              <button className="btn btn-ghost sheet-refresh" onClick={loadRecords}>
                <RefreshCw size={14} strokeWidth={2} /> Refresh
              </button>
            </div>

            {(
              <>
                {/* Table toolbar */}
                <div className="members-toolbar">
                  <div className="sheet-summary">
                    <span className="sheet-summary-count">{presentLikeCount}</span> of{" "}
                    <span className="sheet-summary-count">{staff.length}</span> staff accounted for
                  </div>

                  <div className="toolbar-filters">
                    <div className="filter-group">
                      <span className="filter-label">Filter per:</span>
                      <select 
                        className="filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="all">All ({staff.length})</option>
                        <option value="checked-in">Checked In</option>
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                        <option value="excused">Excused</option>
                        <option value="pending">Not checked in</option>
                      </select>
                    </div>
                    <div className="search-input-wrapper">
                      <Search size={14} className="search-icon" />
                      <input 
                        type="text" 
                        placeholder="Search for an employee..." 
                        className="toolbar-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div id="printable-sheet">
                  <div className="print-only print-header">
                    <div className="print-title">{selectedClassName}</div>
                    <div className="print-subtitle">
                      {formatDayLabel(selectedDay)}
                    </div>
                  </div>

                  <div className="card sheet-table-wrapper">
                    <table className="sheet-table">
                      <thead>
                        <tr>
                          <th className="sticky-col-header" style={{ width: "50px" }}>#</th>
                          <th className="sticky-col">Staff ↕</th>
                          <th>Status</th>
                          <th>Check-in</th>
                          <th>Check-out</th>
                          <th>Hours</th>
                          <th className="no-print">Mark as</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.length === 0 ? (
                          <tr>
                            <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                              No staff members found matching your search criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredStaff.map((staffMember, index) => {
                            const record = recordForStudent(staffMember._id);
                            const isSaving = savingId === staffMember._id;
                            const avatarBg = getAvatarColor(staffMember.name);

                            return (
                              <tr key={staffMember._id}>
                                <td className="index-cell">{index + 1}</td>
                                <td className="sticky-col">
                                  <div className="staff-info-container">
                                    <div className="staff-avatar" style={{ backgroundColor: avatarBg }}>
                                      {staffMember.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="staff-name">{staffMember.name}</div>
                                      <div className="staff-email">{staffMember.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {record ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                      <StatusBadge status={record.status} />
                                      {record.flagged && (
                                        <AlertTriangle
                                          size={13}
                                          strokeWidth={2}
                                          className="flag-icon"
                                          title={record.flagReason || "Flagged for review"}
                                        />
                                      )}
                                    </span>
                                  ) : (
                                    <span className="status-badge tone-pending">
                                      Not checked in
                                    </span>
                                  )}
                                </td>
                                <td className="time-cell">
                                  {hasTimes(record) && editing?.id === record._id && editing?.field === "in" ? (
                                    renderEditor(record, staffMember._id, isSaving)
                                  ) : hasTimes(record) ? (
                                    <span className="checkout-set">
                                      <span>
                                        {formatTimeWithDate(
                                          record.timestamp,
                                          dateFromKey(selectedDay)
                                        )}
                                      </span>
                                      <button
                                        className="checkout-edit-btn no-print"
                                        title="Correct check-in time"
                                        onClick={() => beginEdit(record, "in")}
                                      >
                                        <Pencil size={11} strokeWidth={2} />
                                      </button>
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="time-cell">
                                  {hasTimes(record) && editing?.id === record._id && editing?.field === "out" ? (
                                    renderEditor(record, staffMember._id, isSaving)
                                  ) : hasTimes(record) && record.checkOutTime ? (
                                    <span className="checkout-set">
                                      <span>
                                        {formatTimeWithDate(record.checkOutTime, record.timestamp)}
                                      </span>
                                      <button
                                        className="checkout-edit-btn no-print"
                                        title="Correct check-out time"
                                        onClick={() => beginEdit(record, "out")}
                                      >
                                        <Pencil size={11} strokeWidth={2} />
                                      </button>
                                    </span>
                                  ) : hasTimes(record) ? (
                                    <button
                                      className="checkout-btn no-print"
                                      disabled={isSaving}
                                      onClick={() => beginEdit(record, "out")}
                                    >
                                      Check out
                                    </button>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="time-cell">
                                  {hasTimes(record) && record.hoursWorked != null ? `${record.hoursWorked}h` : "—"}
                                </td>
                                <td className="no-print">
                                  <div className="mark-buttons">
                                    {MARKABLE_STATUSES.map((key) => {
                                      const cfg = STATUS_CONFIG[key];
                                      return (
                                        <button
                                          key={key}
                                          className={`mark-btn tone-${cfg.tone}${
                                            record?.status === key ? " active" : ""
                                          }`}
                                          title={cfg.label}
                                          disabled={isSaving}
                                          onClick={() => markStatus(staffMember._id, key)}
                                        >
                                          <cfg.icon size={13} strokeWidth={2.5} />
                                        </button>
                                      );
                                    })}
                                    {record && (
                                      <button
                                        className="mark-btn tone-remove"
                                        title="Remove record"
                                        disabled={isSaving}
                                        onClick={() => removeRecord(record._id, staffMember._id)}
                                      >
                                        <Trash2 size={13} strokeWidth={2.5} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer with actions and pagination */}
                  <div className="sheet-bottom-footer no-print">
                    <div className="header-action-group">
                      <button className="btn btn-ghost" onClick={exportCsv}>
                        <Download size={14} strokeWidth={2} /> Export CSV
                      </button>
                      <button className="btn btn-ghost" onClick={exportPdf}>
                        <Printer size={14} strokeWidth={2} /> Print / PDF
                      </button>
                    </div>

                    <div className="pagination-controls">
                      <button className="page-nav-btn" disabled>
                        <ChevronLeft size={14} />
                      </button>
                      <button className="page-num-btn active">1</button>
                      <button className="page-num-btn">2</button>
                      <button className="page-num-btn">3</button>
                      <span className="page-dots">...</span>
                      <button className="page-num-btn">8</button>
                      <button className="page-num-btn">9</button>
                      <button className="page-nav-btn">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}