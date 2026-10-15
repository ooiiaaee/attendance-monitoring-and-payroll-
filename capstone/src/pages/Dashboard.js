import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { QrCode, ScanLine, Wallet, ArrowRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "../styles/shared.css";
import "./Dashboard.css";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const isManagerOrHR = user?.role === "manager" || user?.role === "hr";

  const [departments, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active selected date card index for the left stack
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  // Track sidebar collapsed state
  const [collapsed, setCollapsed] = useState(
    document.body.classList.contains("sidebar-collapsed") || 
    document.body.classList.contains("collapsed")
  );

  useEffect(() => {
    const checkCollapseState = () => {
      const isCol = 
        document.body.classList.contains("sidebar-collapsed") ||
        document.body.classList.contains("collapsed") ||
        document.querySelector(".sidebar")?.classList.contains("collapsed") ||
        document.querySelector(".sidebar")?.classList.contains("minimized");
      setCollapsed(!!isCol);
    };

    checkCollapseState();

    const observer = new MutationObserver(checkCollapseState);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    const sidebarNode = document.querySelector(".sidebar");
    if (sidebarNode) {
      observer.observe(sidebarNode, { attributes: true, attributeFilter: ["class"] });
    }

    window.addEventListener("resize", checkCollapseState);
    
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", checkCollapseState);
    };
  }, []);

  useEffect(() => {
    const loadTeacherData = async () => {
      const [classesRes, leaveRes] = await Promise.all([
        api.get("/departments"),
        api.get("/leave", { params: { status: "pending" } }),
      ]);
      setClasses(classesRes.data);
      setLeaveRequests(leaveRes.data);
    };

    const loadStudentData = async () => {
      const [classesRes, attendanceRes, leaveRes] = await Promise.all([
        api.get("/departments"),
        api.get(`/attendance/staff/${user._id}`),
        api.get("/leave"),
      ]);
      setClasses(classesRes.data);
      setAttendance(attendanceRes.data);
      setLeaveRequests(leaveRes.data);
    };

    const load = isManagerOrHR ? loadTeacherData : loadStudentData;
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const todayAbbr = DAY_ABBR[today.getDay()];
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Every meeting block today, across all of this user's departments, sorted by time
  const todaysAgenda = departments
    .flatMap((c) =>
      (Array.isArray(c.schedule) ? c.schedule : [])
        .filter((block) => block.day === todayAbbr)
        .map((block) => ({ ...block, classId: c._id, className: c.name }))
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalStudents = departments.reduce((sum, c) => sum + (c.staff?.length || 0), 0);
  const pendingLeaveCount = leaveRequests.length;

  const presentCount = attendance.filter((a) => a.status === "present").length;
  const lateCount = attendance.filter((a) => a.status === "late").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const excusedCount = attendance.filter((a) => a.status === "excused").length;
  const pendingOwnLeaveCount = leaveRequests.filter((r) => r.status === "pending").length;

  if (loading) {
    return (
      <div className={`dashboard-mesh-container ${collapsed ? "sidebar-is-collapsed" : ""}`}>
        <div className="mesh-blob blob-1"></div>
        <div className="mesh-blob blob-2"></div>
        <Sidebar />
        <div className="page-shell">
          <p className="dashboard-loading">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-mesh-container ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      {/* Background blobs */}
      <div className="mesh-blob blob-1"></div>
      <div className="mesh-blob blob-2"></div>
      <div className="mesh-blob blob-3"></div>

      <Sidebar />
      
      <div className="page-shell">
        <h1 className="page-title">
          {isManagerOrHR ? `Good day, ${user?.name?.split(" ")[0]}` : `Hi, ${user?.name?.split(" ")[0]}`}
        </h1>
        <p className="page-subtitle">
          It's {todayLabel}.{" "}
          {isManagerOrHR ? "Here's your agenda for today." : "Here's where things stand today."}
        </p>

        {/* Hero banner */}
        <div className="card bento-hero">
          <div className="hero-content-wrapper">
            <h2 className="hero-main-title">Attendance Dashboard</h2>
            <p className="hero-description">
              {isManagerOrHR 
                ? "Manage your department schedules and daily operations in minutes." 
                : "Track your timeline, active attendance, and daily schedule seamlessly."}
            </p>
            {isManagerOrHR && (
              <Link to="/sessions" className="hero-action-btn">
                <QrCode size={16} strokeWidth={2.5} /> New Schedule
              </Link>
            )}
          </div>
        </div>

        {/* Date cards and timeline/stats */}
        <div className="dashboard-split-layout">
          
          {/* Left column: date cards */}
          <div className="date-stack-column">
            {todaysAgenda.length === 0 ? (
              <div className="card" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                <p>Nothing on the schedule today.</p>
              </div>
            ) : (
              todaysAgenda.map((block, index) => {
                const isActive = activeDateIndex === index;
                return (
                  <div 
                    key={index} 
                    className={`date-stack-card ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveDateIndex(index)}
                  >
                    <div className="date-badge-box">
                      <div className="date-day-pill">{block.day || todayAbbr}</div>
                      <div className="date-number">{today.getDate()}</div>
                    </div>
                    <div className="date-info-content">
                      <h4>{block.className}</h4>
                      <p>{formatTime(block.startTime)} – {formatTime(block.endTime)}</p>
                    </div>
                    {isManagerOrHR ? (
                      <Link to="/sessions" className="date-arrow-icon" onClick={(e) => e.stopPropagation()}>
                        <QrCode size={14} />
                      </Link>
                    ) : (
                      <span className="date-arrow-icon">
                        <ArrowRight size={16} />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right column: timeline or stats */}
          <div className="card timeline-card">
            <div className="timeline-header">
              <div className="timeline-title-group">
                <h3>{isManagerOrHR ? "Overview Stats" : "Attendance Tally"}</h3>
                <span className="timeline-subtitle-badge">Active View</span>
              </div>
            </div>

            {isManagerOrHR ? (
              <div className="manager-stats-grid">
                <div className="card stat-card-primary">
                  <div className="stat-number">{totalStudents}</div>
                  <div className="stat-label">Enrolled staff</div>
                </div>
                <div className="card stat-card-secondary">
                  <div className="stat-number">{pendingLeaveCount}</div>
                  <div className="stat-label">Pending leave requests</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 0' }}>
                {/* Staff attendance stats */}
                <div className="staff-bento-grid">
                  <div className="bento-mini-card">
                    <span className="bento-mini-number">{presentCount}</span>
                    <span className="bento-mini-label">Present</span>
                  </div>
                  <div className="bento-mini-card">
                    <span className="bento-mini-number">{lateCount}</span>
                    <span className="bento-mini-label">Late</span>
                  </div>
                  <div className="bento-mini-card">
                    <span className="bento-mini-number">{absentCount}</span>
                    <span className="bento-mini-label">Absent</span>
                  </div>
                  <div className="bento-mini-card">
                    <span className="bento-mini-number">{excusedCount}</span>
                    <span className="bento-mini-label">Excused</span>
                  </div>
                </div>

                <div className="card bento-stat stat-card-secondary" style={{ marginTop: '15px', padding: '18px 20px' }}>
                  <div className="bento-stat-value" style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{pendingOwnLeaveCount}</div>
                  <div className="bento-stat-label">Pending leave requests</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="quick-links-row">
          {isManagerOrHR ? (
            <>
              <Link to="/departments" className="quick-link">
                Manage departments
              </Link>
              <Link to="/attendance" className="quick-link">
                Attendance sheet
              </Link>
              <Link to="/payroll" className="quick-link">
                <Wallet size={13} strokeWidth={2} /> Payroll report
              </Link>
              <Link to="/leave" className="quick-link">
                Review leave requests
                {pendingLeaveCount > 0 && (
                  <span className="quick-link-count">{pendingLeaveCount}</span>
                )}
              </Link>
              <Link to="/alerts" className="quick-link">
                Alerts
              </Link>
              <Link to="/schedule" className="quick-link">
                Full week view
              </Link>
            </>
          ) : (
            <>
              <Link to="/checkin" className="quick-link primary">
                <ScanLine size={13} strokeWidth={2} /> Scan to check in
              </Link>
              <Link to="/history" className="quick-link">
                Attendance history
              </Link>
              <Link to="/schedule" className="quick-link">
                Full week view
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}