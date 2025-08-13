import { Card, CardContent } from "../../components/ui/card";

const HomePage = () => (
  <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center justify-center">
    <Card className="max-w-2xl w-full p-8 text-center shadow-lg rounded-xl bg-white">
      <CardContent className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
          Welcome to
          <span className="text-4xl sm:text-5xl font-extrabold text-blue-900 leading-tight tracking-tight">
            {" "}BIRL's TISON
          </span>
        </h1>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
          Home Page
        </h1>
        <p className="text-lg text-gray-600 mt-4 max-w-xl mx-auto">
          This page has a header and footer.
        </p>
      </CardContent>
    </Card>
  </main>
);

export default HomePage;