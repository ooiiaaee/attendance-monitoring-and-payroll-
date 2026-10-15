import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Clock, UserCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "./NotificationBell.css";

const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const wrapRef = useRef(null);

  const isHR = user?.role === "hr";
  const isManagerOrHR = user?.role === "manager" || user?.role === "hr";
  const isStaff = user?.role === "staff";

  const load = useCallback(async () => {
    try {
      const notifications = [];

      if (isManagerOrHR) {
        const leaveRes = await api.get("/leave", { params: { status: "pending" } });
        leaveRes.data.forEach((r) => {
          notifications.push({
            id: `leave-${r._id}`,
            icon: Clock,
            text: `${r.staff?.name || "A staff member"} requested leave — ${r.department?.name || ""}`,
            to: "/leave",
          });
        });
      }

      if (isHR) {
        const usersRes = await api.get("/auth/users");
        usersRes.data
          .filter((u) => u.role === "manager" && !u.approved)
          .forEach((u) => {
            notifications.push({
              id: `approve-${u._id}`,
              icon: UserCheck,
              text: `${u.name} is awaiting manager approval`,
              to: "/admin",
            });
          });
      }

      if (isStaff) {
        const leaveRes = await api.get("/leave");
        leaveRes.data
          .filter((r) => r.status === "pending")
          .forEach((r) => {
            notifications.push({
              id: `mine-${r._id}`,
              icon: Clock,
              text: `Your leave request for ${r.department?.name || "a department"} is pending review`,
              to: "/leave",
            });
          });
      }

      setItems(notifications);
    } catch (err) {
      // fail silently
    }
  }, [isManagerOrHR, isHR, isStaff]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button className="notification-bell-trigger" onClick={() => setOpen((o) => !o)}>
        <Bell size={17} strokeWidth={2} />
        {items.length > 0 && <span className="notification-bell-badge">{items.length}</span>}
      </button>

      {open && (
        <div className="notification-bell-menu">
          <div className="notification-bell-header">Notifications</div>
          {items.length === 0 ? (
            <div className="notification-bell-empty">You're all caught up.</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                className="notification-bell-item"
                onClick={() => {
                  setOpen(false);
                  navigate(item.to);
                }}
              >
                <item.icon size={15} strokeWidth={2} />
                <span>{item.text}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
