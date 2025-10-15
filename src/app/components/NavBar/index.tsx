import { EchoAccount } from "@/components/echo-account-next";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default async function NavBar() {
  return (
    <nav className="w-full border-b py-3 px-4">
      <div className="flex items-center justify-between">
        <SidebarTrigger />
        <div className="flex items-center gap-3">
          <EchoAccount />
        </div>
      </div>
    </nav>
  );
}
