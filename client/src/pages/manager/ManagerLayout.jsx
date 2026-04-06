import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";

export default function ManagerLayout() {
  const { user } = useAuth();

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Manager portal</p>
          <h1>Welcome, {user?.name || "Manager"}</h1>
          <p className="muted">Daily operations with dedicated pages.</p>
        </div>
      </header>

      <nav className="manager-nav">
        <NavLink
          to="/manager/quick-order"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Create Order
        </NavLink>
        <NavLink
          to="/manager/menu"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Menu Items
        </NavLink>
        <NavLink
          to="/manager/orders"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Manage Orders
        </NavLink>
        <NavLink
          to="/manager/stock"
          className={({ isActive }) =>
            isActive ? "manager-nav-link active" : "manager-nav-link"
          }
        >
          Manage Stock
        </NavLink>
      </nav>

      <Outlet />
    </main>
  );
}
