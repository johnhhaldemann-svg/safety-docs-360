import { redirect } from "next/navigation";

export default function HomePage() {
  const isLoggedIn = true;

  if (!isLoggedIn) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-white p-10 text-black">
      <h1 className="text-3xl font-bold">SafetyDocs360</h1>
      <p className="mt-4">Welcome to the portal. You are logged in.</p>
    </main>
  );
}