import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import AdminPage from "./pages/AdminPage";
import CenterDetails from "./pages/CenterDetails";
import CenterInventory from "./pages/CenterInventory";
import CenterList from "./pages/CenterList";
import ItemDetails from "./pages/ItemDetails";
import ItemForm from "./pages/ItemForm";
import LostItemList from "./pages/LostItemList";
import LostItemMap from "./pages/LostItemMap";
import StaffLogin from "./pages/StaffLogin";

function RequireAuth({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/staff/login" replace />;
  if (admin && user.role !== "Administrator") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          KAIST Lost &amp; Found
        </Link>
        <nav>
          <Link to="/">Items</Link>
          <Link to="/map">Map</Link>
          <Link to="/centers">Centers</Link>
          {user && <Link to="/staff/inventory">My Center</Link>}
          {user?.role === "Administrator" && <Link to="/admin">Admin</Link>}
          {user ? (
            <button onClick={() => void logout()}>Log out ({user.displayName})</button>
          ) : (
            <Link to="/staff/login">Staff Login</Link>
          )}
        </nav>
      </header>

      <main className="content">
        <Routes>
          {/* Public */}
          <Route path="/" element={<LostItemList />} />
          <Route path="/map" element={<LostItemMap />} />
          <Route path="/items/:id" element={<ItemDetails />} />
          <Route path="/centers" element={<CenterList />} />
          <Route path="/centers/:id" element={<CenterDetails />} />
          <Route path="/staff/login" element={<StaffLogin />} />

          {/* Center staff */}
          <Route path="/staff/inventory" element={<RequireAuth><CenterInventory /></RequireAuth>} />
          <Route path="/staff/items/new" element={<RequireAuth><ItemForm /></RequireAuth>} />
          <Route path="/staff/items/:id/edit" element={<RequireAuth><ItemForm /></RequireAuth>} />

          {/* Administrator */}
          <Route path="/admin" element={<RequireAuth admin><AdminPage /></RequireAuth>} />

          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
