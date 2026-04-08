import { Header } from "../../components/layouts/header";
import { Sidebar } from "../../components/layouts/sidebar";
import { auth } from "../../auth";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col relative">
        <Header />
        <main className="flex-1 p-4 pt-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
