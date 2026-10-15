import "./WeeklySchedule.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const START_HOUR = 7;
const END_HOUR = 21;
const SLOT_COUNT = (END_HOUR - START_HOUR) * 2; // 30-min slots
const ROW_HEIGHT = 22; // px — must match the grid's row track size below

// Department colors, also used by MySchedule.js for its legend
export const COLORS = ["#a8493a", "#4a9268", "#5b83a8", "#c08a2e", "#8a5ba3", "#3d8a7a"];

const timeToSlot = (time) => {
  const [h, m] = time.split(":").map(Number);
  return (h - START_HOUR) * 2 + (m >= 30 ? 1 : 0);
};

const formatTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

// Lays out a day's blocks so overlapping ones sit side by side
function layoutDay(dayEntries) {
  const sorted = [...dayEntries].sort(
    (a, b) => a.startSlot - b.startSlot || a.endSlot - b.endSlot
  );

  const laidOut = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const laneEnds = []; // end slot of the last block placed in each lane
    const withLane = cluster.map((entry) => {
      let lane = laneEnds.findIndex((end) => end <= entry.startSlot);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(entry.endSlot);
      } else {
        laneEnds[lane] = entry.endSlot;
      }
      return { ...entry, laneIndex: lane };
    });
    const laneCount = laneEnds.length;
    withLane.forEach((entry) => laidOut.push({ ...entry, laneCount }));
    cluster = [];
  };

  sorted.forEach((entry) => {
    if (entry.startSlot >= clusterEnd) {
      flushCluster();
      clusterEnd = entry.endSlot;
    } else {
      clusterEnd = Math.max(clusterEnd, entry.endSlot);
    }
    cluster.push(entry);
  });
  flushCluster();

  return laidOut;
}

// entries: [{ day, startTime, endTime, label, colorIndex }]
export default function WeeklySchedule({ entries = [] }) {
  // Skip the closing hour, which has no row
  const hourLabels = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const withSlots = entries
    .map((entry, i) => {
      const dayIndex = DAYS.indexOf(entry.day);
      if (dayIndex === -1) return null;
      return {
        ...entry,
        _key: i,
        dayIndex,
        startSlot: timeToSlot(entry.startTime),
        endSlot: timeToSlot(entry.endTime),
      };
    })
    .filter(Boolean);

  const laidOutByDay = DAYS.map((_, dayIndex) =>
    layoutDay(withSlots.filter((e) => e.dayIndex === dayIndex))
  );

  return (
    <div className="weekly-schedule">
      <div
        className="ws-grid"
        style={{ gridTemplateRows: `32px repeat(${SLOT_COUNT}, ${ROW_HEIGHT}px)` }}
      >
        {/* corner */}
        <div className="ws-corner" style={{ gridColumn: 1, gridRow: 1 }} />

        {/* day headers */}
        {DAYS.map((day, i) => (
          <div className="ws-day-header" key={day} style={{ gridColumn: i + 2, gridRow: 1 }}>
            {day}
          </div>
        ))}

        {/* hour labels + gridlines */}
        {hourLabels.map((hour, i) => (
          <div
            key={hour}
            className="ws-hour-label"
            style={{ gridColumn: 1, gridRow: i * 2 + 2 }}
          >
            {hour % 12 === 0 ? 12 : hour % 12}
            {hour >= 12 ? "PM" : "AM"}
          </div>
        ))}

        {/* gridlines, one per slot row */}
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <div
            key={`line-${i}`}
            className={`ws-gridline${i % 2 === 0 ? " hour" : ""}`}
            style={{ gridColumn: `2 / span ${DAYS.length}`, gridRow: i + 2 }}
          />
        ))}

        {/* One wrapper per day; overlapping blocks sit side by side */}
        {DAYS.map((day, dayIndex) => (
          <div
            key={`day-col-${day}`}
            className="ws-day-col"
            style={{ gridColumn: dayIndex + 2, gridRow: `2 / span ${SLOT_COUNT}` }}
          >
            {laidOutByDay[dayIndex].map((entry) => {
              const color = COLORS[entry.colorIndex % COLORS.length];
              const widthPct = 100 / entry.laneCount;
              return (
                <div
                  key={entry._key}
                  className="ws-block"
                  title={`${entry.label || ""} ${formatTime(entry.startTime)}–${formatTime(entry.endTime)}`}
                  style={{
                    position: "absolute",
                    top: entry.startSlot * ROW_HEIGHT,
                    height: (entry.endSlot - entry.startSlot) * ROW_HEIGHT,
                    left: `${entry.laneIndex * widthPct}%`,
                    width: `${widthPct}%`,
                    background: color,
                  }}
                >
                  <div className="ws-block-label">{entry.label}</div>
                  <div className="ws-block-time">
                    {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {entries.length === 0 && <p className="ws-empty">No schedule blocks yet.</p>}
    </div>
  );
}
