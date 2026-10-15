import { useState, useEffect, useRef, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { CheckCircle2, XCircle, Send } from "lucide-react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import "../styles/shared.css";
import "./StaffCheckin.css";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

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

export default function StudentCheckin() {
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");
  const scannerRef = useRef(null);
  const scannerRegionRef = useRef(null);
  const submittingRef = useRef(false);

  const submitCheckin = useCallback(async (qrToken) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setResult(null);

    try {
      const loc = await getLocation();
      const res = await api.post("/attendance/checkin", {
        qrToken,
        ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
      });
      let message =
        res.data.type === "checkout"
          ? `Checked out${
              res.data.hoursWorked != null ? ` — ${res.data.hoursWorked} hrs logged.` : "."
            }`
          : `Checked in — marked ${res.data.status}.`;
      if (res.data.flagged) {
        message += " Your manager will review this check-in.";
      }
      setResult({ type: "success", message });
    } catch (err) {
      setResult({
        type: "error",
        message: err.response?.data?.message || "Check-in failed. Please try again.",
      });
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Use a fresh element per run so StrictMode's double effect doesn't draw two scanners
    const region = scannerRegionRef.current;
    if (!region) return undefined;
    const host = document.createElement("div");
    host.id = `${SCANNER_ELEMENT_ID}-${Math.random().toString(36).slice(2)}`;
    region.appendChild(host);

    const scanner = new Html5QrcodeScanner(
      host.id,
      { fps: 10, qrbox: { width: 220, height: 220 } },
      false
    );

    const onScanSuccess = (decodedText) => {
      try {
        scanner.pause(true);
      } catch (e) {
        // pause() fails for file-upload scans; that's expected
      }
      submitCheckin(decodedText).finally(() => {
        setTimeout(() => {
          try {
            scanner.resume();
          } catch (e) {}
        }, 2000);
      });
    };

    scanner.render(onScanSuccess, () => {});
    scannerRef.current = scanner;

    return () => {
      const removeHost = () => host.remove();
      try {
        scanner.clear().catch(() => {}).finally(removeHost);
      } catch (e) {
        removeHost();
      }
    };
  }, [submitCheckin]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      setManualError("Enter the code shown on your manager's screen.");
      return;
    }
    setManualError("");
    submitCheckin(manualCode.trim());
  };

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Scan to check in</h1>
        <p className="page-subtitle">
          Point your camera at the QR code your manager is displaying. Scan it again later to check out.
        </p>

        {result && (
          <div className={`result-banner ${result.type}`}>
            {result.type === "success" ? (
              <CheckCircle2 size={16} strokeWidth={2} />
            ) : (
              <XCircle size={16} strokeWidth={2} />
            )}
            {result.message}
          </div>
        )}

        {submitting && <div className="checkin-status">Checking in...</div>}

        <div className="card scanner-frame">
          <div id={SCANNER_ELEMENT_ID} ref={scannerRegionRef}></div>
        </div>

        <div className="checkin-divider">or enter manually</div>

        <form className="card manual-form" onSubmit={handleManualSubmit} noValidate>
          <div className="manual-form-row">
            <input
              className="field-input"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste or type the session code"
            />
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              <Send size={14} strokeWidth={2} /> Submit
            </button>
          </div>
          {manualError && <span className="field-error">{manualError}</span>}
        </form>
      </div>
    </div>
  );
}
