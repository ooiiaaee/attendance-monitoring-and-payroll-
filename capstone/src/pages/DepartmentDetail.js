import { useState, useEffect, useCallback, Fragment } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  QrCode,
  Users,
  StickyNote,
  TrendingUp,
  Download,
  Send,
  Trash2,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import WeeklySchedule from "../components/WeeklySchedule";
import api from "../api/axios";
import "../styles/shared.css";
import "./DepartmentDetail.css";

export default function DepartmentDetail() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Staff notes
  const [expandedNotesStaffId, setExpandedNotesStaffId] = useState(null);
  const [notesByStaff, setNotesByStaff] = useState({});
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteBusyId, setNoteBusyId] = useState(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/departments/${id}`),
      api.get(`/departments/${id}/summary`),
      api.get(`/sessions/department/${id}`),
      api.get(`/departments/${id}/analytics`),
    ])
      .then(([deptRes, summaryRes, sessionsRes, analyticsRes]) => {
        setDepartment(deptRes.data);
        setSummary(summaryRes.data);
        setSessions(sessionsRes.data);
        setAnalytics(analyticsRes.data);
      })
      .catch(() => setError("Could not load department details."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const formatSessionDate = (d) =>
    new Date(d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const scheduleEntries = (department?.schedule || []).map((b) => ({
    ...b,
    label: department?.name || "",
    colorIndex: 0,
  }));

  // Staff notes
  const toggleNotes = async (staffId) => {
    if (expandedNotesStaffId === staffId) {
      setExpandedNotesStaffId(null);
      return;
    }
    setExpandedNotesStaffId(staffId);
    setNoteText("");
    setNotesError("");

    if (!notesByStaff[staffId]) {
      setNotesLoading(true);
      try {
        const res = await api.get(`/notes/staff/${staffId}`);
        setNotesByStaff((prev) => ({ ...prev, [staffId]: res.data }));
      } catch (err) {
        setNotesError(err.response?.data?.message || "Could not load notes.");
      } finally {
        setNotesLoading(false);
      }
    }
  };

  const submitNote = async (staffId) => {
    if (!noteText.trim()) {
      setNotesError("Write a note before saving.");
      return;
    }
    setNotesError("");
    setNoteSubmitting(true);
    try {
      const res = await api.post(`/notes/staff/${staffId}`, { text: noteText.trim() });
      setNotesByStaff((prev) => ({
        ...prev,
        [staffId]: [res.data, ...(prev[staffId] || [])],
      }));
      setNoteText("");
    } catch (err) {
      setNotesError(err.response?.data?.message || "Could not save note.");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const deleteNote = async (staffId, noteId) => {
    setNoteBusyId(noteId);
    try {
      await api.delete(`/notes/${noteId}`);
      setNotesByStaff((prev) => ({
        ...prev,
        [staffId]: (prev[staffId] || []).filter((n) => n._id !== noteId),
      }));
    } catch (err) {
      setNotesError(err.response?.data?.message || "Could not delete note.");
    } finally {
      setNoteBusyId(null);
    }
  };

  // Analytics / export
  const trend = analytics?.trend || [];

  const exportFullHistory = () => {
    if (!analytics) return;
    const header = ["Staff Name", "Email", "Date", "Status", "Check-in", "Check-out", "Hours"];
    const timeFmt = (d) =>
      d ? new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
    const dateFmt = (d) => (d ? new Date(d).toLocaleDateString() : "");

    const rows = analytics.fullHistory.map((r) => {
      // Absent / excused staff have no check-in, check-out or hours.
      const noShow = r.status === "absent" || r.status === "excused";
      return [
        r.staffName,
        r.staffEmail,
        dateFmt(r.date),
        r.status,
        noShow ? "" : timeFmt(r.checkIn),
        noShow ? "" : timeFmt(r.checkOut),
        !noShow && r.hoursWorked != null ? r.hoursWorked : "",
      ]
        .map((f) => `"${f}"`)
        .join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${department?.name || "department"}-full-history.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <Link to="/departments" className="dept-detail-back">
          <ArrowLeft size={14} strokeWidth={2} /> Back to departments
        </Link>

        {error && <div className="banner banner-error">{error}</div>}

        {loading ? (
          <p className="dashboard-loading">Loading...</p>
        ) : department ? (
          <>
            <h1 className="page-title">{department.name}</h1>
            <p className="page-subtitle">
              Managed by {department.manager?.name || "—"}
            </p>

           {/* Stat cards */}
            <div className="dept-stats-grid">
              <div className="dept-stat-card highlighted">
                <div className="dept-stat-card-header">
                  <span className="dept-stat-label">Total sessions</span>
                </div>
                <div className="dept-stat-value">{summary?.totalSessions ?? "—"}</div>
                <div className="dept-stat-subtext">Active logs tracked</div>
              </div>

              {/* Roster card */}
              <div className="dept-stat-card">
                <div className="dept-stat-card-header">
                  <span className="dept-stat-label">Staff enrolled</span>
                </div>
                <div className="dept-stat-value">{department.staff.length}</div>
                <div className="dept-stat-subtext">Active roster members</div>
              </div>

              {/* Schedule card */}
              <div className="dept-stat-card">
                <div className="dept-stat-card-header">
                  <span className="dept-stat-label">Meetings / week</span>
                </div>
                <div className="dept-stat-value">{(department.schedule || []).length}</div>
                <div className="dept-stat-subtext">Scheduled slots</div>
              </div>
            </div>

            <h2 className="section-heading">Weekly schedule</h2>
            <div className="card dept-schedule-card">
              <WeeklySchedule entries={scheduleEntries} />
            </div>

            <h2 className="section-heading" style={{ marginTop: "28px" }}>
              <TrendingUp
                size={15}
                strokeWidth={2}
                style={{ verticalAlign: "-2px", marginRight: "6px" }}
              />
              Attendance trend
            </h2>
            
            <div className="card dept-trend-card">
              <div className="dept-trend-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="dept-trend-title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Performance Overview
                </div>
               
              </div>

              {trend.length === 0 ? (
                <p className="dept-empty">No sessions yet — trend will appear once you run some.</p>
              ) : (
                (() => {
                  const width = 600;
                  const height = 150;
                  const padding = 20;
                  const chartWidth = width - padding * 2;
                  const chartHeight = height - padding * 2;

                  const points = trend.map((t, index) => {
                    const rate = t.rate !== null ? t.rate : 0;
                    const x = padding + (trend.length === 1 ? chartWidth / 2 : (index / (trend.length - 1)) * chartWidth);
                    const y = padding + chartHeight - (rate / 100) * chartHeight;
                    return { x, y, rate, date: t.date, sessionId: t.sessionId };
                  });

                  const pathString = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
                  const areaString = `${pathString} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

                  return (
                    <>
                      <div className="dept-trend-chart-container" style={{ position: 'relative', width: '100%', height: '160px' }}>
                        <svg viewBox={`0 0 ${width} ${height}`} className="dept-trend-svg" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                          <defs>
                            <linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--electric-rose)" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="var(--electric-rose)" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {[0, 25, 50, 75, 100].map((val) => {
                            const y = padding + chartHeight - (val / 100) * chartHeight;
                            return (
                              <g key={val}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} className="dept-trend-grid-line" />
                                <text x={padding - 12} y={y + 3.5} className="dept-trend-grid-text" textAnchor="end" style={{ fontSize: '10px', fill: 'var(--text-faint)' }}>
                                  {val}
                                </text>
                              </g>
                            );
                          })}

                          <path d={areaString} className="dept-trend-area" fill="url(#pinkGradient)" />
                          <path d={pathString} className="dept-trend-line" fill="none" stroke="var(--electric-rose)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                          {points.map((p, i) => (
                            <circle
                              key={i}
                              cx={p.x}
                              cy={p.y}
                              r={5}
                              className="dept-trend-dot"
                              style={{ fill: '#ffffff', stroke: 'var(--electric-rose)', strokeWidth: '2.5' }}
                              title={`${new Date(p.date).toLocaleDateString()} — ${p.rate !== null ? `${p.rate}%` : "no data"}`}
                            />
                          ))}
                        </svg>
                      </div>

                      <div className="dept-trend-axis-labels" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-faint)' }}>
                        <span>{new Date(trend[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span>{new Date(trend[trend.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </>
                  );
                })()
              )}

              <button
                className="btn btn-ghost dept-trend-export"
                style={{ marginTop: "16px" }}
                onClick={exportFullHistory}
                disabled={!analytics || analytics.fullHistory.length === 0}
              >
                <Download size={14} strokeWidth={2} /> Export full history (CSV)
              </button>
            </div>

            <div className="dept-detail-columns">
              <div>
                <h2 className="section-heading">
                  <Users size={15} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                  Staff roster
                </h2>
                <div className="card dept-roster-card">
                  {department.staff.length === 0 ? (
                    <p className="dept-empty">No staff enrolled yet.</p>
                  ) : (
                    <table className="dept-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Rate</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary?.summary || department.staff.map((s) => ({ staff: s, rate: null }))).map(
                          (row) => (
                            <Fragment key={row.staff._id}>
                              <tr>
                                <td className="dept-cell-strong">{row.staff.name}</td>
                                <td>
                                  {row.rate !== null && row.rate !== undefined ? (
                                    <span
                                      className={`pill ${row.rate < 75 ? "tone-danger solid" : "tone-success"}`}
                                    >
                                      {row.rate}%
                                    </span>
                                  ) : (
                                    <span className="dept-cell-muted">—</span>
                                  )}
                                </td>
                                <td>
                                  <button
                                    className="btn btn-ghost dept-notes-toggle"
                                    onClick={() => toggleNotes(row.staff._id)}
                                  >
                                    <StickyNote size={13} strokeWidth={2} />
                                    {notesByStaff[row.staff._id]
                                      ? `Notes (${notesByStaff[row.staff._id].length})`
                                      : "Notes"}
                                  </button>
                                </td>
                              </tr>
                              {expandedNotesStaffId === row.staff._id && (
                                <tr>
                                  <td colSpan={3} className="dept-notes-panel">
                                    {notesError && (
                                      <div className="banner banner-error" style={{ marginBottom: "10px" }}>
                                        {notesError}
                                      </div>
                                    )}

                                    <div className="dept-notes-form">
                                      <input
                                        className="field-input"
                                        placeholder={`Add a note about ${row.staff.name}...`}
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                      />
                                      <button
                                        className="btn btn-primary"
                                        disabled={noteSubmitting}
                                        onClick={() => submitNote(row.staff._id)}
                                      >
                                        <Send size={13} strokeWidth={2} />
                                        {noteSubmitting ? "Saving..." : "Add"}
                                      </button>
                                    </div>

                                    {notesLoading ? (
                                      <p className="dept-empty">Loading notes...</p>
                                    ) : (notesByStaff[row.staff._id] || []).length === 0 ? (
                                      <p className="dept-empty">No notes yet for this staff member.</p>
                                    ) : (
                                      notesByStaff[row.staff._id].map((n) => (
                                        <div key={n._id} className="dept-note-row">
                                          <div>
                                            <div>{n.text}</div>
                                            <div className="dept-note-meta">
                                              by {n.author?.name || "—"} on{" "}
                                              {new Date(n.createdAt).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                              })}
                                            </div>
                                          </div>
                                          <button
                                            className="dept-note-delete"
                                            disabled={noteBusyId === n._id}
                                            onClick={() => deleteNote(row.staff._id, n._id)}
                                            title="Delete note"
                                          >
                                            <Trash2 size={13} strokeWidth={2} />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div>
                <h2 className="section-heading">
                  <QrCode size={15} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                  Recent sessions
                </h2>
                <div className="card dept-sessions-card">
                  {sessions.length === 0 ? (
                    <p className="dept-empty">No sessions started yet.</p>
                  ) : (
                    sessions.slice(0, 8).map((s) => (
                      <div className="dept-session-row" key={s._id}>
                        {formatSessionDate(s.date)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="dashboard-loading">Department not found.</p>
        )}
      </div>
    </div>
  );
}