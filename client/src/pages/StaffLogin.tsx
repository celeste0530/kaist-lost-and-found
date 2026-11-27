import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

// FR-01: staff / administrator login with email + password.
export default function StaffLogin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Administrators land on their page, staff on their center's inventory.
  const home = (role: string) => (role === "Administrator" ? "/admin" : "/staff/inventory");

  if (user) return <Navigate to={home(user.role)} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      // The user state change re-renders this page and the <Navigate> above takes over.
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section>
      <h1>Staff Login</h1>
      <form className="form" onSubmit={onSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Log in</button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  );
}
