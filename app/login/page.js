import LoginClient from "./LoginClient";
import { getAppConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  const config = getAppConfig();
  return { title: `${config.appName} - Login` };
}

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  const config = getAppConfig();
  return <LoginClient title={config.loginTitle} subtitle={config.loginSubtitle} />;
}
