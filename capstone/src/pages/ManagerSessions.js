import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, X, Timer, MapPin, Copy, Check } from "lucide-react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import "../styles/shared.css";
import "./ManagerSessions.css";

// Resolves to { lat, lng } or null if unavailable
const getLocation = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });

export default function TeacherSessions() {
  const [departments, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [checkingActive, setCheckingActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api
      .get("/departments")
      .then((res) => {
        setClasses(res.data);
        if (res.data.length > 0) setSelectedClassId(res.data[0]._id);
      })
      .catch(() => setError("Could not load your departments."))
      .finally(() => setLoadingClasses(false));
  }, []);

  // Resume an already running session for the selected department
  const loadActiveSession = useCallback(async (departmentId) => {
    if (!departmentId) return;
    setCheckingActive(true);
    try {
      const res = await api.get(`/sessions/department/${departmentId}`);
      const mostRecent = res.data[0];
      const stillValid = mostRecent && new Date(mostRecent.qrExpiresAt).getTime() > Date.now();
      setActiveSession(stillValid ? mostRecent : null);
    } catch (err) {
      // Non-fatal: falls back to "no active session"
    } finally {
      setCheckingActive(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) loadActiveSession(selectedClassId);
  }, [selectedClassId, loadActiveSession]);

  useEffect(() => {
    if (!activeSession) return;
    const tick = () => {
      const msLeft = new Date(activeSession.qrExpiresAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(msLeft / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const startSession = async () => {
    if (!selectedClassId) {
      setSelectionError("Please select a department first.");
      return;
    }
    setSelectionError("");
    setError("");
    setStarting(true);
    try {
      const loc = await getLocation();
      const res = await api.post("/sessions", {
        departmentId: selectedClassId,
        ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
      });
      setActiveSession(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not start session.");
    } finally {
      setStarting(false);
    }
  };

  const regenerateQr = useCallback(async () => {
    if (!activeSession) return;
    setError("");
    try {
      const res = await api.post(`/sessions/${activeSession._id}/regenerate-qr`);
      setActiveSession(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not regenerate QR code.");
    }
  }, [activeSession]);

  const copyCode = async () => {
    if (!activeSession) return;
    try {
      await navigator.clipboard.writeText(activeSession.qrToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // Clipboard can fail on older browsers or non-HTTPS
    }
  };

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const selectedClassName = departments.find((c) => c._id === selectedClassId)?.name || "";

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Start a work session</h1>
        <p className="page-subtitle">
          Pick a department and generate a QR code staff can scan to check in.
        </p>

        {error && <div className="banner banner-error">{error}</div>}

        {loadingClasses ? (
          <p className="dashboard-loading">Loading your departments...</p>
        ) : departments.length === 0 ? (
          <p className="dashboard-loading">
            You don't have any departments yet. HR will assign you one before you can start a work session.
          </p>
        ) : (
          <>
            <div className="card session-controls">
              <select
                className="field-input"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectionError("");
                  setActiveSession(null);
                }}
                disabled={!!activeSession || checkingActive}
                style={{ flex: 1 }}
              >
                {departments.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {!activeSession && (
                <button
                  className="btn btn-primary"
                  onClick={startSession}
                  disabled={starting || checkingActive}
                >
                  {checkingActive ? "Checking..." : starting ? "Starting..." : "Start session"}
                </button>
              )}
            </div>
            {selectionError && <div className="banner banner-error">{selectionError}</div>}
          </>
        )}

        {activeSession && (
          <div className="card qr-card">
            <div className="qr-department-name">{selectedClassName}</div>
            <div className="qr-wrapper">
              <QRCodeSVG value={activeSession.qrToken} size={240} fgColor="#14161f" level="H" />
            </div>

            <div className="qr-manual-code">
              <span className="qr-manual-code-label">Can't scan? Give this code:</span>
              <div className="qr-manual-code-row">
                <code className="qr-manual-code-value">{activeSession.qrToken}</code>
                <button className="qr-copy-btn" onClick={copyCode} title="Copy code">
                  {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div className={`qr-timer${secondsLeft === 0 ? " expired" : ""}`}>
              <Timer size={14} strokeWidth={2} />
              {secondsLeft > 0 ? `Expires in ${formatTime(secondsLeft)}` : "QR code expired"}
            </div>

            <div
              className={`qr-location-note${activeSession.location?.lat == null ? " unverified" : ""}`}
            >
              <MapPin size={13} strokeWidth={2} />
              {activeSession.location?.lat != null
                ? "Check-ins are location-verified"
                : "Location not captured — check-ins for this session won't be verified"}
            </div>

            <div className="qr-actions">
              <button className="btn btn-secondary" onClick={regenerateQr}>
                <RefreshCw size={14} strokeWidth={2} /> Regenerate
              </button>
              <button className="btn btn-ghost" onClick={() => setActiveSession(null)}>
                <X size={14} strokeWidth={2} /> End view
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
