import { createBrowserRouter } from "react-router-dom";
import { Login } from './features/auth/login';
import { ForgotPasswordForm } from './features/auth/forget-password';
import { Signup } from './features/auth/signup';
import { CheckEmail } from './features/auth/check-email';
import AppLayout from './layouts/AppLayout';
import RequireAdmin from './features/admin/RequireAdmin';
import AccessDenied from './components/access-denied';
import UserLocked from './components/user-locked';
import HomePage from './features/home/HomePage';
import ServicesPage from './features/services/ServicesPage';
import SettingsPage from './features/settings/SettingsPage';
import AdminPanel from "./features/admin/AdminPanel"; // Import AdminPanel (the layout)
import UserManagement from "./features/admin/AdminUserManagement"; // Your existing user management
import AdminDashboard from "./features/admin/AdminStats";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/check-email",
    element: <CheckEmail />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordForm />,
  },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "services",
        element: <ServicesPage />,
      },
      {
        path: "access-denied",
        element: <AccessDenied />,
      },
      {
        path: "locked",
        element: <UserLocked />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPanel />
          </RequireAdmin>
        ),
        children: [
          {
            index: true,
            element: <AdminDashboard />,
          },
          {
            path: "users",
            element: <UserManagement />,
          },
        ],
      },
    ],
  }
]);

export default router;