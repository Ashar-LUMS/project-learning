import {RouterProvider} from "react-router-dom";
import { RoleProvider } from "./getRole";
import router from "./routes";

function App() {
  return (
      <RoleProvider>
        <RouterProvider router={router} />
      </RoleProvider>
  );
}

export default App;


