import { LogOut, UserCheck, Save, KeyRound, Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "../styles/shared.css";
import { validatePassword, validateConfirmPassword } from "../utils/validators";
import { fileToAvatarDataUrl } from "../utils/imageUtils";
import "./Profile.css";

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const fileInputRef = useRef(null);
  const [avatarError, setAvatarError] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);

  const initials = (user?.name || "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!name.trim() || !email.trim()) {
      setProfileError("Name and email can't be empty.");
      return;
    }

    setSavingProfile(true);
    try {
      await api.put("/auth/me", { name: name.trim(), email: email.trim() });
      await refreshUser();
      setProfileSuccess("Profile updated.");
    } catch (err) {
      setProfileError(err.response?.data?.message || "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;

    setAvatarError("");
    setSavingAvatar(true);
    try {
      const avatar = await fileToAvatarDataUrl(file);
      await api.put("/auth/me/avatar", { avatar });
      await refreshUser(); // updates the sidebar picture too
    } catch (err) {
      setAvatarError(err.response?.data?.message || err.message || "Could not update your picture.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError("");
    setSavingAvatar(true);
    try {
      await api.delete("/auth/me/avatar");
      await refreshUser();
    } catch (err) {
      setAvatarError(err.response?.data?.message || "Could not remove your picture.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }
    const lengthError = validatePassword(newPassword);
    if (lengthError) {
      setPasswordError(lengthError);
      return;
    }
    const matchError = validateConfirmPassword(newPassword, confirmPassword);
    if (matchError) {
      setPasswordError(matchError);
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.put("/auth/me/password", { currentPassword, newPassword });
      // Use the new token so this device stays logged in
      localStorage.setItem("token", res.data.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated. Other devices have been signed out.");
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Could not change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <Sidebar />
      <div className="page-shell">
        <h1 className="page-title">Your profile</h1>
        <p className="page-subtitle">Manage your account details.</p>

        <div className="card profile-card" style={{ marginBottom: "24px" }}>
          <div className="profile-header">
            <button
              type="button"
              className={`profile-avatar profile-avatar-btn role-${user?.role}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={savingAvatar}
              title="Change profile picture"
            >
              {user?.avatar ? <img src={user.avatar} alt="" /> : initials}
              <span className="profile-avatar-overlay">
                <Camera size={16} strokeWidth={2} />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarPick}
              style={{ display: "none" }}
            />
            <div>
              <div className="profile-name">{user?.name}</div>
              <div className="pill capitalize tone-accent" style={{ marginTop: "4px" }}>{user?.role}</div>
              <div className="profile-avatar-actions">
                <button
                  type="button"
                  className="profile-link-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={savingAvatar}
                >
                  {savingAvatar ? "Saving..." : user?.avatar ? "Change photo" : "Add photo"}
                </button>
                {user?.avatar && (
                  <button
                    type="button"
                    className="profile-link-btn profile-link-danger"
                    onClick={handleAvatarRemove}
                    disabled={savingAvatar}
                  >
                    <Trash2 size={12} strokeWidth={2} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          {avatarError && <div className="banner banner-error">{avatarError}</div>}

          {user?.role === "staff" && user?.staffId && (
            <div className="profile-detail-row" style={{ marginBottom: "20px" }}>
              <UserCheck size={16} strokeWidth={2} />
              <div>
                <div className="profile-detail-label">Staff ID</div>
                <div className="profile-detail-value">{user.staffId}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleProfileSave} noValidate>
            {profileError && <div className="banner banner-error">{profileError}</div>}
            {profileSuccess && <div className="banner banner-success">{profileSuccess}</div>}

            <div className="auth-field">
              <label className="field-label">Name</label>
              <input
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={savingProfile}>
              <Save size={14} strokeWidth={2} />
              {savingProfile ? "Saving..." : "Save changes"}
            </button>
          </form>

          <form
            onSubmit={handlePasswordSave}
            noValidate
            style={{ borderTop: "1px solid var(--border)", marginTop: "26px", paddingTop: "22px" }}
          >
            <div className="profile-section-heading">
              <KeyRound size={15} strokeWidth={2} />
              Change password
            </div>

            {passwordError && <div className="banner banner-error">{passwordError}</div>}
            {passwordSuccess && <div className="banner banner-success">{passwordSuccess}</div>}

            <div className="auth-field">
              <label className="field-label">Current password</label>
              <input
                className="field-input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label className="field-label">New password</label>
              <input
                className="field-input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label className="field-label">Confirm new password</label>
              <input
                className="field-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={savingPassword}>
              <KeyRound size={14} strokeWidth={2} />
              {savingPassword ? "Updating..." : "Update password"}
            </button>
          </form>

          <p className="profile-forgot-note">
            Forgot your current password? Ask an HR admin to reset it for you from the HR Admin
            panel.
          </p>
        </div>

        <button className="btn btn-ghost profile-logout" onClick={logout}>
          <LogOut size={15} strokeWidth={2} />
          Log out
        </button>
      </div>
    </div>
  );
}
