/**
 * 公开（未登录）路由壳。承载首页与登录/注册弹窗。
 * 不强制鉴权；服务端任何登录态判断由 page 自行决定。
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-screen flex-col">{children}</div>;
}
