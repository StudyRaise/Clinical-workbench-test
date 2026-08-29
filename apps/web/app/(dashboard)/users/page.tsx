'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, Users as UsersIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchUsers, getUser, type UserListItem } from '@/lib/api';

const roleLabel: Record<string, string> = {
  admin: '管理员',
  doctor: '医生',
  nurse: '护士',
  researcher: '科研人员',
  patient: '患者'
};

const roleColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  admin: 'destructive',
  doctor: 'default',
  nurse: 'secondary',
  researcher: 'outline',
  patient: 'secondary'
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const me = getUser();
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    fetchUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : '加载用户列表失败'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">无访问权限</h2>
        <p className="text-sm text-muted-foreground">用户管理仅对管理员（admin）角色开放。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">用户管理</h2>
        <p className="text-muted-foreground">当前机构下的用户列表，仅管理员可见。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UsersIcon className="h-5 w-5" />
            用户列表
          </CardTitle>
          <CardDescription>共 {users.length} 位用户</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">邮箱</th>
                    <th className="px-3 py-2 font-medium">角色</th>
                    <th className="px-3 py-2 font-medium">机构</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-3 py-2">{user.email}</td>
                      <td className="px-3 py-2">
                        <Badge variant={roleColor[user.role] ?? 'secondary'}>
                          {roleLabel[user.role] ?? user.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{user.facilityId ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              暂无用户
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
