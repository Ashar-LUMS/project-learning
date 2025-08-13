import { Card, CardContent } from "./ui/card";
import { Link } from "react-router-dom";

// AccessDenied component to display when a user tries to access a restricted page
// This component can be used in routes that require admin access or other permissions

const AccessDenied = () => (
  <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center justify-center">
    <Card className="max-w-md w-full p-8 text-center shadow-lg rounded-xl bg-white">
      <CardContent className="space-y-4">
        <h1 className="text-3xl font-extrabold text-red-600 leading-tight tracking-tight">
          Access Denied
        </h1>
        <p className="text-lg text-gray-600 mt-4 max-w-xl mx-auto">
          Sorry, you cannot access this page.
          To go back to the home page, click the button below.
        </p>

        <Link
              to={"/app"}
              className="text-primary font-medium hover:underline"
            >
            Go to Home
            </Link>
      </CardContent>
    </Card>
  </main>
);

export default AccessDenied;