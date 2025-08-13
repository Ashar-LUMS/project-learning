import React from "react";

const AdminPanel = () => (
  <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center justify-center">
    <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
    <p>Only admins can see this page.</p>
    {/* Add admin features here */}
  </main>
);

export default AdminPanel;