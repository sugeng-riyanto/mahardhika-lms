import { useState } from 'react'
import { Users, Search, Plus, Shield, Mail, Calendar, CheckCircle, XCircle, Edit, Trash2, Eye } from 'lucide-react'
import { useUsers } from '@/api/hooks'
import { apiClient } from '@/api/client'
import { getRoleLabel, getRoleBadgeClass } from '@/auth/roles'
import { useAuth } from '@/auth/AuthProvider'
import { CrudModal, type CrudField } from '@/components/CrudModal'

const USER_FIELDS: CrudField[] = [
  { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'user@example.com' },
  { name: 'full_name', label: 'Full Name', type: 'text', required: true, placeholder: 'John Doe' },
  { name: 'is_active', label: 'Active', type: 'toggle' },
  { name: 'mfa_enabled', label: 'MFA Enabled', type: 'toggle' },
]

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'sponsorship', label: 'Sponsor' },
  { value: 'third_party', label: 'Third Party' },
]

interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'delete' | 'view'
  data: Record<string, unknown>
}

export function UserListPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'create', data: {} })
  const { user: currentUser } = useAuth()
  const { data: users, isLoading, error, refetch } = useUsers()

  const filteredUsers = users?.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const activeCount = users?.filter(u => u.is_active).length || 0
  const instructorCount = users?.filter(u => u.roles.includes('instructor')).length || 0
  const studentCount = users?.filter(u => u.roles.includes('student')).length || 0

  const openCreate = () => setModal({
    isOpen: true,
    mode: 'create',
    data: { email: '', full_name: '', is_active: true, mfa_enabled: false },
  })

  const openEdit = (u: typeof filteredUsers[0]) => setModal({
    isOpen: true,
    mode: 'edit',
    data: { id: u.id, email: u.email, full_name: u.full_name, is_active: u.is_active, mfa_enabled: u.mfa_enabled },
  })

  const openView = (u: typeof filteredUsers[0]) => setModal({
    isOpen: true,
    mode: 'view',
    data: { ...u, roles_display: u.roles.map(r => getRoleLabel(r)).join(', ') || 'No Role' },
  })

  const openDelete = (u: typeof filteredUsers[0]) => setModal({
    isOpen: true,
    mode: 'delete',
    data: { id: u.id, full_name: u.full_name, email: u.email },
  })

  const handleSave = async (data: Record<string, unknown>) => {
    if (modal.mode === 'create') {
      await apiClient.post('/users/', data)
    } else if (modal.mode === 'edit' && data.id) {
      await apiClient.patch(`/users/${data.id}/`, data)
    }
    await refetch()
  }

  const handleDelete = async () => {
    if (modal.data.id) {
      await apiClient.delete(`/users/${modal.data.id}/`)
      await refetch()
    }
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-purple-400" size={24} />
          <h1 className="page-title mb-0">User Management</h1>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openView(u)}
                          className="p-1.5 text-navy-400 hover:text-cyan-400 transition-colors"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {u.email !== currentUser?.email && (
                          <>
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 text-navy-400 hover:text-yellow-400 transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => openDelete(u)}
                              className="p-1.5 text-navy-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
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

      {/* CRUD Modal */}
      <CrudModal
        isOpen={modal.isOpen}
        mode={modal.mode}
        title={modal.mode === 'view' ? 'User' : 'User'}
        fields={USER_FIELDS}
        data={modal.data}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setModal({ isOpen: false, mode: 'create', data: {} })}
      />
    </div>
  )
}
