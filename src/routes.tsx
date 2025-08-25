import { createBrowserRouter } from "react-router-dom";
import { Login } from './features/auth/login';
import { Signup } from './features/auth/signup';
import { CheckEmail } from './features/auth/check-email.tsx';
import AppLayout from './layouts/AppLayout';
import AdminPanel from './features/admin/AdminPanel.tsx';
import RequireAdmin from './features/admin/RequireAdmin.tsx';
import AccessDenied from './components/access-denied';
import HomePage from './features/home/HomePage';
import AboutPage from './features/about/AboutPage';
import ServicesPage from './features/services/ServicesPage';
import SettingsPage from './features/settings/SettingsPage';
import TestPage from "./features/test.tsx";

const router = createBrowserRouter([

  {path: "/test", element: <TestPage />},
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
    path: "/app",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "about",
        element: <AboutPage />,
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
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPanel />
          </RequireAdmin>
        ),
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  }
]);

export default router;