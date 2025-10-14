import { isSignedIn } from "@/echo";
import Link from "next/link";
import { EchoAccount } from "@/components/echo-account-next";

export default async function NavBar() {
  return (
    <nav className="w-full border-b py-3">
      <div className="container mx-auto flex items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          Merit Echo
        </Link>
        <div className="flex items-center gap-3">
          <EchoAccount />
        </div>
      </div>
    </nav>
  );
}
