import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminSalariesPage from "./pages/admin/AdminSalariesPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import ManagerLayout from "./pages/manager/ManagerLayout";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import QuickOrderPage from "./pages/manager/QuickOrderPage";
import ManageOrdersPage from "./pages/manager/ManageOrdersPage";
import MenuItemsPage from "./pages/manager/MenuItemsPage";

function ProtectedRoute({ allowedRoles, children }) {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate to={user.role === "admin" ? "/admin" : "/manager"} replace />
    );
  }

  return children;
}

export default function App() {
  const { user, token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Navigate to={token && user ? `/${user.role}` : "/login"} replace />
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<AdminOverviewPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="salaries" element={<AdminSalariesPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="*" element={<Navigate to="/admin/overview" replace />} />
      </Route>
      <Route
        path="/manager"
        element={
          <ProtectedRoute allowedRoles={["manager"]}>
            <ManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard />} />
        <Route
          path="create-order"
          element={<Navigate to="/manager/quick-order" replace />}
        />
        <Route path="items" element={<Navigate to="/manager/menu" replace />} />
        <Route path="quick-order" element={<QuickOrderPage />} />
        <Route path="menu" element={<MenuItemsPage />} />
        <Route path="orders" element={<ManageOrdersPage />} />
        <Route
          path="*"
          element={<Navigate to="/manager/dashboard" replace />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
