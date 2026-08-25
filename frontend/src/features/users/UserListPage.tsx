import { useState } from 'react'
import { Users, Search, Plus, Shield, Mail, Calendar, CheckCircle, XCircle } from 'lucide-react'
import { useUsers } from '@/api/hooks'
import { getRoleLabel, getRoleBadgeClass } from '@/auth/roles'
import { useAuth } from '@/auth/AuthProvider'

export function UserListPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const { user: currentUser } = useAuth()

  const { data: users, isLoading, error } = useUsers()

  const filteredUsers = users?.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const activeCount = users?.filter(u => u.is_active).length || 0
  const instructorCount = users?.filter(u => u.roles.includes('instructor')).length || 0
  const studentCount = users?.filter(u => u.roles.includes('student')).length || 0

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-purple-400" size={24} />
          <h1 className="page-title mb-0">User Management</h1>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{users?.length || 0}</p>
          <p className="text-sm text-navy-400">Total Users</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
          <p className="text-sm text-navy-400">Active</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-purple-400">{instructorCount}</p>
          <p className="text-sm text-navy-400">Instructors</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-cyan-400">{studentCount}</p>
          <p className="text-sm text-navy-400">Students</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" size={16} />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10 w-full max-w-md"
        />
      </div>

      {/* User table */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-navy-400">Loading users...</p>
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <XCircle className="mx-auto text-red-400 mb-4" size={32} />
          <p className="text-red-300">Failed to load users</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">User</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Roles</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">MFA</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-navy-400">Joined</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-navy-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-cyan-600 flex items-center justify-center text-sm font-medium text-white">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{u.full_name}</p>
                          <p className="text-xs text-navy-400 flex items-center gap-1">
                            <Mail size={10} />
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((role) => (
                          <span key={role} className={`badge text-[10px] ${getRoleBadgeClass(role)}`}>
                            {getRoleLabel(role)}
                          </span>
                        ))}
                        {u.roles.length === 0 && (
                          <span className="badge badge-neutral text-[10px]">No Role</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle size={12} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <XCircle size={12} />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.mfa_enabled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <Shield size={12} />
                          Enabled
                        </span>
                      ) : (
                        <span className="text-xs text-navy-500">Disabled</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-navy-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.email !== currentUser?.email && (
                        <button className="text-xs text-navy-400 hover:text-white transition-colors">
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="py-12 text-center">
              <Users className="mx-auto text-navy-600 mb-4" size={32} />
              <p className="text-navy-400">
                {searchQuery ? 'No users match your search.' : 'No users found.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
