import { Search } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import type { User } from "@/types";
import { Drawer, ErrorNote, PageHeader, formatDate } from "@/components/ui";

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState<User | null>(null);
  const [err, setErr] = useState("");
  const load = (s = q) => api.get<User[]>(`/api/admin/users?q=${encodeURIComponent(s)}`).then(setUsers);
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const patch = async (u: User, body: Partial<User>) => {
    setErr("");
    try {
      await api.patch(`/api/admin/users/${u.id}`, body);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Users" subtitle="View, search, change roles and disable or enable accounts." />
      <div className="relative mb-4 max-w-md">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input pl-10" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-3"><ErrorNote>{err}</ErrorNote></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-paper-300 bg-paper-100 text-xs uppercase tracking-wide text-ink-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-paper-300">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-semibold">{u.full_name}</td>
                <td className="px-4 py-3 text-ink-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select className="input w-auto py-1 text-sm" value={u.role} disabled={u.id === me?.id} onChange={(e) => patch(u, { role: e.target.value as User["role"] })}>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-ink-500">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">{u.is_active ? <span className="chip bg-leaf-50 text-leaf-700">Active</span> : <span className="chip bg-brick-50 text-brick">Disabled</span>}</td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-ghost btn-sm" onClick={() => setView(u)}>View</button>
                  {u.id !== me?.id && (
                    <button className={u.is_active ? "btn-danger btn-sm ml-1" : "btn-secondary btn-sm ml-1"} onClick={() => patch(u, { is_active: !u.is_active })}>{u.is_active ? "Disable" : "Enable"}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer open={!!view} onClose={() => setView(null)} title={view?.full_name ?? ""}>
        {view && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-semibold">Email</dt><dd>{view.email}</dd>
            <dt className="font-semibold">Role</dt><dd>{view.role}</dd>
            <dt className="font-semibold">Status</dt><dd>{view.is_active ? "Active" : "Disabled"}</dd>
            <dt className="font-semibold">Language</dt><dd>{view.preferred_language}</dd>
            <dt className="font-semibold">Applications</dt><dd>{view.applications ?? 0}</dd>
            <dt className="font-semibold">Created</dt><dd>{formatDate(view.created_at, true)}</dd>
            <dt className="font-semibold">Last login</dt><dd>{formatDate(view.last_login_at, true)}</dd>
            {Object.entries(view.profile).map(([k, v]) => (<Fragment key={k}><dt className="font-semibold capitalize">{k.replace("_", " ")}</dt><dd>{String(v)}</dd></Fragment>))}
          </dl>
        )}
      </Drawer>
    </div>
  );
}
