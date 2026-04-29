import { Redirect } from "expo-router";
import { useAuthToken } from "@/auth/session";

export default function Index() {
  const { token, loading } = useAuthToken();
  if (loading) return null;
  return <Redirect href={token ? "/dashboard" : "/login"} />;
}
