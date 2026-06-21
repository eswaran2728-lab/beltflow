'use client';
// TODO: Replace with Supabase auth session check
// Check user role from Supabase session and restrict access accordingly
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
