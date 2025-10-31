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
import AdminPanel from "./features/admin/AdminPanel";
import UserManagement from "./features/admin/AdminUserManagement";
import AdminDashboard from "./features/admin/AdminStats";
import RoleManagement from "./features/admin/AdminRoleManagement";
import { UserProfile } from "./features/profile/Profile";
import { AdminSettings } from "./features/admin/AdminSetting";
import ProjectManagement from "./features/admin/AdminProjectManagement";
import { ResetPasswordPage } from "./features/auth/reset-password";
import NetworkEditorPage from "./features/NetworkEditor/NetworkEditorPage";
import NetworkGraph from "./features/NetworkEditor/NetworkGraph";
import ProjectVisualizationPage from "./features/NetworkEditor/ProjectVisualizationPage";


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
    path: "/reset-password",
    element: <ResetPasswordPage />,
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
      path: "projects/:projectId",
      element: <ProjectVisualizationPage />,
    },
    {
      path: "network-editor",
      element: <NetworkEditorPage />,
      children: [
        {
          path: "graph",
          element: <NetworkGraph />,
        },
      ],
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
      path: "user-profile",
      element: <UserProfile />,
    },
    {
      path: "admin",
      element: (
        <RequireAdmin>
          <AdminPanel />
        </RequireAdmin>
      ),
      children: [
        { index: true, element: <AdminDashboard /> },
        { path: "users", element: <UserManagement /> },
        { path: "role-management", element: <RoleManagement /> },
        { path: "settings", element: <AdminSettings /> },
        { path: "project-management", element: <ProjectManagement /> },
      ],
    },
  ],
},

]);

export default router;