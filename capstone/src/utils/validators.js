export function validateEmail(value) {
  if (!value.trim()) return "Email is required";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(value)) return "Enter a valid email address";
  return "";
}

export function validatePassword(value) {
  if (!value) return "Password is required";
  if (value.length < 6) return "Password must be at least 6 characters";
  return "";
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return "Please confirm your password";
  if (password !== confirmPassword) return "Passwords do not match";
  return "";
}

export function validateName(value) {
  if (!value.trim()) return "Full name is required";
  if (value.trim().length < 2) return "Name is too short";
  return "";
}

export function validateStudentId(value) {
  if (!value.trim()) return "Staff ID is required";
  return "";
}

export function validateClassName(value) {
  if (!value.trim()) return "Department name is required";
  if (value.trim().length < 3) return "Department name must be at least 3 characters";
  return "";
}

export function validateStudentSelection(value) {
  if (!value) return "Please select a staff member";
  return "";
}
