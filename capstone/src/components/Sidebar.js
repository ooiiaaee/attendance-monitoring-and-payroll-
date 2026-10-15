import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  QrCode,
  ScanLine,
  ClipboardList,
  History,
  ShieldAlert,
  Settings2,
  CalendarDays,
  CalendarOff,
  Wallet,
  LogOut,
  UserRound,
  ChevronsLeft,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import logoImg from "../assets/kajalogo.png";
import "./Sidebar.css";

const NAV_SECTIONS = [
  {
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["manager", "hr", "staff"] }],
  },
  {
    label: "Management",
    items: [
      { to: "/departments", label: "Departments", icon: Users, roles: ["manager", "hr"] },
      { to: "/sessions", label: "Work Sessions", icon: QrCode, roles: ["manager", "hr"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/attendance", label: "Attendance", icon: ClipboardList, roles: ["manager", "hr"] },
      { to: "/alerts", label: "Alerts", icon: ShieldAlert, roles: ["manager", "hr"] },
      { to: "/payroll", label: "Payroll", icon: Wallet, roles: ["manager", "hr"] },
    ],
  },
  {
    label: "Time",
    items: [
      { to: "/schedule", label: "Schedule", icon: CalendarDays, roles: ["manager", "hr", "staff"] },
      { to: "/leave", label: "Leave", icon: CalendarOff, roles: ["manager", "hr", "staff"] },
      { to: "/checkin", label: "Check In", icon: ScanLine, roles: ["staff"] },
      { to: "/history", label: "History", icon: History, roles: ["staff"] },
    ],
  },
  {
    label: "Admin",
    items: [{ to: "/admin", label: "HR Admin", icon: Settings2, roles: ["hr"] }],
  },
];

const COLLAPSE_STORAGE_KEY = "sidebar:collapsed";
const COLLAPSED_WIDTH = "88px";

function getStoredCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const menuRef = useRef(null);

  const role = user?.role;

  const initials = (user?.name || "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);

  useLayoutEffect(() => {
    if (collapsed) {
      document.documentElement.style.setProperty("--sidebar-width", COLLAPSED_WIDTH);
    } else {
      document.documentElement.style.removeProperty("--sidebar-width");
    }
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
    } catch {
      // Storage unavailable
    }
  }, [collapsed]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-brand">
        <img src={logoImg} alt="KAJA Logo" className="sidebar-logo-img" />
        <span className="sidebar-brand-text">KAJA Attendance</span>
      </div>

      <nav className="sidebar-nav sidebar-nav-primary">
        {visibleSections.map((section, i) => (
          <div className="sidebar-nav-section" key={section.label || `section-${i}`}>
            {i > 0 && <hr className="sidebar-divider" />}
            {section.label && <div className="sidebar-section-label">{section.label}</div>}
            {section.items.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to} className={`sidebar-link${active ? " active" : ""}`}>
                  <Icon size={18} strokeWidth={2} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse button */}
      <div className="sidebar-collapse-container">
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft size={16} strokeWidth={2} />
          <span>Collapse</span>
        </button>
      </div>

      {/* Footer: notification bell and account */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-top">
          <NotificationBell />
        </div>

        <div className="sidebar-user-section">
          <div className="sidebar-user-section-label">User Account</div>
          
          <div className="topbar-account" ref={menuRef}>
            {menuOpen && (
              <div className="topbar-menu">
                <div className="topbar-menu-header">
                  <div className="topbar-menu-name">{user?.name}</div>
                  <div className="topbar-menu-role">{role}</div>
                </div>
                <button
                  className="topbar-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/profile");
                  }}
                >
                  <UserRound size={16} strokeWidth={2} />
                  Profile
                </button>
                <button className="topbar-menu-item danger" onClick={logout}>
                  <LogOut size={16} strokeWidth={2} />
                  Log out
                </button>
              </div>
            )}

            <button 
              className={`topbar-avatar-container role-${role}`} 
              onClick={() => setMenuOpen((o) => !o)}
              title={user?.name}
            >
              {user?.avatar ? (
                <img className="topbar-avatar topbar-avatar-img" src={user.avatar} alt="" />
              ) : (
                <div className={`topbar-avatar role-${role}`}>{initials}</div>
              )}
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-role">{role}</div>
              </div>
              <ChevronUp size={16} className={`sidebar-user-chevron${menuOpen ? " open" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}