import { Card, CardContent } from "./ui/card";

const UserLocked = () => (
  <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center justify-center">
    <Card className="max-w-md w-full p-8 text-center shadow-lg rounded-xl bg-white">
      <CardContent className="space-y-4">
        <h1 className="text-3xl font-extrabold text-red-600 leading-tight tracking-tight">
          User Locked
        </h1>
        <p className="text-lg text-gray-600 mt-4 max-w-xl mx-auto">
          Dear User, Your Account is locked due to disciplinary reasons.
          Please Contact an Admin. 
        </p>
      </CardContent>
    </Card>
  </main>
);

export default UserLocked;