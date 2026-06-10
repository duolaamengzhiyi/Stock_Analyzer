/**
 * 登录后路由组壳（FR-005 配合 middleware）。
 * 服务端取 user，未登录直接 302 到首页（middleware 已拦截过一遍，这里做 defense in depth）。
 */
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/?login=1");
  }
  return <div className="flex min-h-screen flex-col">{children}</div>;
}
