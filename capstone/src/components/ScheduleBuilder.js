import { useState } from "react";
import { Plus, X } from "lucide-react";
import "./ScheduleBuilder.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Generates ["07:00", "07:30", ..., "21:00"]
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const formatTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

// Controlled component: value = array of {day, startTime, endTime}, calls onChange(newArray)
export default function ScheduleBuilder({ value = [], onChange }) {
  const [selectedDays, setSelectedDays] = useState([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [error, setError] = useState("");

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const addBlocks = () => {
    setError("");
    if (selectedDays.length === 0) {
      setError("Select at least one day.");
      return;
    }
    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }

    const newBlocks = selectedDays.map((day) => ({ day, startTime, endTime }));
    // avoid exact duplicate blocks
    const merged = [...value];
    newBlocks.forEach((nb) => {
      const exists = merged.some(
        (b) => b.day === nb.day && b.startTime === nb.startTime && b.endTime === nb.endTime
      );
      if (!exists) merged.push(nb);
    });

    onChange(merged);
    setSelectedDays([]);
  };

  const removeBlock = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="schedule-builder">
      <div className="sb-day-row">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            className={`sb-day-btn${selectedDays.includes(day) ? " active" : ""}`}
            onClick={() => toggleDay(day)}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="sb-time-row">
        <select
          className="field-input"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {formatTime(t)}
            </option>
          ))}
        </select>
        <span className="sb-time-sep">to</span>
        <select
          className="field-input"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {formatTime(t)}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary sb-add-btn" onClick={addBlocks}>
          <Plus size={14} strokeWidth={2} /> Add
        </button>
      </div>

      {error && <div className="field-error">{error}</div>}

      {value.length > 0 && (
        <div className="sb-chip-row">
          {value.map((block, i) => (
            <span className="sb-chip" key={i}>
              {block.day} {formatTime(block.startTime)}–{formatTime(block.endTime)}
              <button type="button" onClick={() => removeBlock(i)}>
                <X size={12} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
