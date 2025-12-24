import {RouterProvider} from "react-router-dom";
import { RoleProvider } from "./getRole";
import { ToastProvider } from "@/components/ui/toast";
import router from "./routes";

function App() {
  return (
    <ToastProvider>
      <RoleProvider>
        <RouterProvider router={router} />
      </RoleProvider>
    </ToastProvider>
  );
}

export default App;


