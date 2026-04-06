import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin portal</p>
          <h1>Welcome, {user?.name || "Admin"}</h1>
          <p className="muted">
            Full control across overview, orders, salaries, and analytics.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={logout}>
          Logout
        </button>
      </header>

      <nav className="manager-nav">
        <NavLink
          to="/admin/overview"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Overview
        </NavLink>
        <NavLink
          to="/admin/orders"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Orders
        </NavLink>
        <NavLink
          to="/admin/salaries"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Salaries
        </NavLink>
        <NavLink
          to="/admin/analytics"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Analytics
        </NavLink>
      </nav>

      <Outlet />
    </main>
  );
}
