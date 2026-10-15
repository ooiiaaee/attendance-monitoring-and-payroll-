import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, CalendarDays, ArrowUpRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import ScheduleBuilder from "../components/ScheduleBuilder";
import WeeklySchedule from "../components/WeeklySchedule";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { validateClassName, validateStudentSelection } from "../utils/validators";
import "../styles/shared.css";
import "./DepartmentManagement.css";

export default function ClassManagement() {
  const { user } = useAuth();
  const isHR = user?.role === "hr";
  const [departments, setClasses] = useState([]);
  const [staff, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [nameError, setNameError] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [enrollSelections, setEnrollSelections] = useState({});
  const [enrollErrors, setEnrollErrors] = useState({});
  const [enrolling, setEnrolling] = useState({});

  const [expandedClassId, setExpandedClassId] = useState(null);
  const [editSchedule, setEditSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  // HR only: who can be put in charge of a department
  const [managers, setManagers] = useState([]);
  const [newManagerId, setNewManagerId] = useState("");
  const [managerError, setManagerError] = useState("");
  const [managerSelections, setManagerSelections] = useState({}); // deptId -> chosen manager id
  const [managerErrors, setManagerErrors] = useState({});
  const [savingManager, setSavingManager] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [classesRes, studentsRes, usersRes] = await Promise.all([
        api.get("/departments"),
        api.get("/auth/staff"),
        isHR ? api.get("/auth/users") : Promise.resolve(null),
      ]);
      setClasses(classesRes.data);
      setStudents(studentsRes.data);
      if (usersRes) {
        setManagers(
          usersRes.data.filter(
            (u) => u.role === "manager" && u.approved !== false && u.isActive !== false
          )
        );
      }
    } catch (err) {
      setFormError("Could not load departments or staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHR]);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setFormError("");
    const err = validateClassName(name);
    setNameError(err);
    setManagerError("");
    if (isHR && !newManagerId) {
      setManagerError("Choose who will manage this department.");
      return;
    }
    if (err) return;

    setCreating(true);
    try {
      await api.post("/departments", {
        name: name.trim(),
        schedule: scheduleBlocks,
        ...(isHR ? { managerId: newManagerId } : {}),
      });
      setName("");
      setScheduleBlocks([]);
      setNewManagerId("");
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not create department.");
    } finally {
      setCreating(false);
    }
  };

  const handleEnroll = async (classId) => {
    const staffId = enrollSelections[classId];
    const err = validateStudentSelection(staffId);
    setEnrollErrors((prev) => ({ ...prev, [classId]: err }));
    if (err) return;

    setEnrolling((prev) => ({ ...prev, [classId]: true }));
    try {
      await api.post(`/departments/${classId}/enroll`, { staffId });
      setEnrollSelections((prev) => ({ ...prev, [classId]: "" }));
      await loadData();
    } catch (err) {
      setEnrollErrors((prev) => ({
        ...prev,
        [classId]: err.response?.data?.message || "Could not enroll staff.",
      }));
    } finally {
      setEnrolling((prev) => ({ ...prev, [classId]: false }));
    }
  };

  // Staff who aren't enrolled in a department yet
  // Approved managers and HR, plus the current manager
  const managerOptionsFor = (classItem) => {
    const options = managers.map((m) => ({ _id: m._id, name: m.name }));
    if (user && !options.some((o) => o._id === user._id)) {
      options.push({ _id: user._id, name: "Me (HR admin)" });
    }
    const current = classItem.manager;
    if (current && !options.some((o) => o._id === current._id)) {
      options.push({ _id: current._id, name: `${current.name} (current)` });
    }
    return options;
  };

  const handleChangeManager = async (classItem) => {
    const chosen = managerSelections[classItem._id];
    if (!chosen) return;
    setManagerErrors((prev) => ({ ...prev, [classItem._id]: "" }));
    setSavingManager((prev) => ({ ...prev, [classItem._id]: true }));
    try {
      await api.put(`/departments/${classItem._id}/manager`, { managerId: chosen });
      setManagerSelections((prev) => {
        const next = { ...prev };
        delete next[classItem._id];
        return next;
      });
      await loadData();
    } catch (err) {
      setManagerErrors((prev) => ({
        ...prev,
        [classItem._id]: err.response?.data?.message || "Could not change the manager.",
      }));
    } finally {
      setSavingManager((prev) => ({ ...prev, [classItem._id]: false }));
    }
  };

  const availableStudentsFor = (classItem) => {
    const enrolledIds = new Set(classItem.staff.map((s) => s._id));
    return staff.filter((s) => !enrolledIds.has(s._id) && !s.department);
  };

  const toggleExpand = (classItem) => {
    if (expandedClassId === classItem._id) {
      setExpandedClassId(null);
    } else {
      setExpandedClassId(classItem._id);
      // Guard against old free-text schedule values
      const safeSchedule = Array.isArray(classItem.schedule) ? classItem.schedule : [];
      setEditSchedule((prev) => ({ ...prev, [classItem._id]: safeSchedule }));
    }
  };

  const saveSchedule = async (classId) => {
    setSavingSchedule(true);
    try {
      await api.put(`/departments/${classId}`, { schedule: editSchedule[classId] });
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not save schedule.");
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Your departments</h1>
        <p className="page-subtitle">
          {isHR
            ? "Create departments, choose their manager, set the weekly schedule, and enroll staff."
            : "Set the weekly schedule and enroll staff in the departments HR has assigned to you."}
        </p>

        {formError && <div className="banner banner-error">{formError}</div>}

        {isHR && (
          <form className="card create-form" onSubmit={handleCreateClass} noValidate>
            <div className="auth-field">
              <label className="field-label">Department name</label>
              <input
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setNameError(validateClassName(name))}
                placeholder="e.g. Engineering, Marketing"
              />
              {nameError && <span className="field-error">{nameError}</span>}
            </div>

            {isHR && (
              <div className="auth-field">
                <label className="field-label">Manager</label>
                <select
                  className="field-input"
                  value={newManagerId}
                  onChange={(e) => {
                    setNewManagerId(e.target.value);
                    setManagerError("");
                  }}
                >
                  <option value="">Select who will manage this department...</option>
                  {managers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                  <option value={user._id}>Me (HR admin)</option>
                </select>
                {managerError && <span className="field-error">{managerError}</span>}
                {managers.length === 0 && (
                  <span className="field-hint">
                    There are no approved managers yet — approve one in the Admin Panel first.
                  </span>
                )}
              </div>
            )}

            <div className="auth-field">
              <label className="field-label">Schedule</label>
              <ScheduleBuilder value={scheduleBlocks} onChange={setScheduleBlocks} />
            </div>

            {scheduleBlocks.length > 0 && (
              <div className="live-schedule-preview">
                <div className="live-preview-label">Preview</div>
                <WeeklySchedule
                  entries={scheduleBlocks.map((b) => ({ ...b, label: name || "New department", colorIndex: 0 }))}
                />
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={creating}>
              <Plus size={15} strokeWidth={2.5} />
              {creating ? "Creating..." : "Create department"}
            </button>
          </form>
        )}

        <h2 className="section-heading" style={{ marginTop: isHR ? "28px" : "8px" }}>
          {isHR ? "All departments" : "Assigned to you"}
        </h2>

        {loading ? (
          <p className="dashboard-loading">Loading...</p>
        ) : departments.length === 0 ? (
          <p className="dashboard-loading">
            {isHR
              ? "No departments yet — create one above."
              : "No departments are assigned to you yet. HR creates departments and assigns a manager to each."}
          </p>
        ) : (
          <div className="department-grid">
            {departments.map((classItem) => (
              <div className="card department-card" key={classItem._id}>
                <div className="department-card-header">
                  <div style={{ flex: 1 }}>
                    <div className="department-card-name">{classItem.name}</div>
                    <div className="department-card-schedule">
                      {Array.isArray(classItem.schedule) && classItem.schedule.length > 0
                        ? `${classItem.schedule.length} meeting${classItem.schedule.length !== 1 ? "s" : ""}/week`
                        : "No schedule set"}
                    </div>
                  </div>
                  <Link to={`/departments/${classItem._id}`} className="department-card-detail-link">
                    <ArrowUpRight size={15} strokeWidth={2} />
                  </Link>
                </div>

                {isHR && (
                  <div className="department-card-manager">
                    <div className="department-card-manager-label">
                      Manager:{" "}
                      <strong>{classItem.manager?.name || "none — account removed"}</strong>
                    </div>
                    <div className="department-card-manager-row">
                      <select
                        className="field-input"
                        value={managerSelections[classItem._id] ?? classItem.manager?._id ?? ""}
                        onChange={(e) =>
                          setManagerSelections((prev) => ({
                            ...prev,
                            [classItem._id]: e.target.value,
                          }))
                        }
                      >
                        {!classItem.manager && <option value="">Select a manager...</option>}
                        {managerOptionsFor(classItem).map((o) => (
                          <option key={o._id} value={o._id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleChangeManager(classItem)}
                        disabled={
                          savingManager[classItem._id] ||
                          !managerSelections[classItem._id] ||
                          managerSelections[classItem._id] === classItem.manager?._id
                        }
                      >
                        {savingManager[classItem._id] ? "..." : "Change"}
                      </button>
                    </div>
                    {managerErrors[classItem._id] && (
                      <span className="field-error">{managerErrors[classItem._id]}</span>
                    )}
                  </div>
                )}

                <div className="department-card-staff">
                  <strong>{classItem.staff.length}</strong> enrolled
                  {classItem.staff.length > 0 && (
                    <ul>
                      {classItem.staff.map((s) => (
                        <li key={s._id}>{s.name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="department-card-enroll">
                  <select
                    className="field-input"
                    value={enrollSelections[classItem._id] || ""}
                    onChange={(e) =>
                      setEnrollSelections((prev) => ({
                        ...prev,
                        [classItem._id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {availableStudentsFor(classItem).length === 0
                        ? "No unassigned staff available"
                        : "Select a staff member..."}
                    </option>
                    {availableStudentsFor(classItem).map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEnroll(classItem._id)}
                    disabled={enrolling[classItem._id]}
                  >
                    {enrolling[classItem._id] ? "..." : "Enroll"}
                  </button>
                </div>
                {enrollErrors[classItem._id] && (
                  <span className="field-error">{enrollErrors[classItem._id]}</span>
                )}

                <button
                  className="btn btn-ghost department-card-schedule-toggle"
                  onClick={() => toggleExpand(classItem)}
                >
                  <CalendarDays size={14} strokeWidth={2} />
                  {expandedClassId === classItem._id ? "Hide schedule" : "View / edit schedule"}
                </button>

                {expandedClassId === classItem._id && (
                  <div className="department-schedule-editor">
                    <ScheduleBuilder
                      value={editSchedule[classItem._id] || []}
                      onChange={(blocks) =>
                        setEditSchedule((prev) => ({ ...prev, [classItem._id]: blocks }))
                      }
                    />
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: "12px", marginBottom: "16px" }}
                      onClick={() => saveSchedule(classItem._id)}
                      disabled={savingSchedule}
                    >
                      {savingSchedule ? "Saving..." : "Save schedule"}
                    </button>

                    <WeeklySchedule
                      entries={(editSchedule[classItem._id] || []).map((b) => ({
                        ...b,
                        label: classItem.name,
                        colorIndex: 0,
                      }))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
