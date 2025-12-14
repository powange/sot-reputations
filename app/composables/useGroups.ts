interface Group {
  id: number
  uid: string
  name: string
  createdAt: string
  createdBy: number
  role: 'admin' | 'member'
}

interface GroupMember {
  id: number
  groupId: number
  userId: number
  username: string
  role: 'admin' | 'member'
  joinedAt: string
  lastImportAt: string | null
}

export function useGroups() {
  const groups = useState<Group[]>('user-groups', () => [])

  async function fetchGroups() {
    try {
      const response = await $fetch<{ groups: Group[] }>('/api/groups')
      groups.value = response.groups
    } catch {
      groups.value = []
    }
  }

  async function createGroup(name: string) {
    const response = await $fetch<{ success: boolean, group: Group }>('/api/groups', {
      method: 'POST',
      body: { name }
    })

    // Ajouter le groupe avec le rôle admin
    groups.value.push({ ...response.group, role: 'admin' })

    return response.group
  }

  async function deleteGroup(uid: string) {
    await $fetch(`/api/groups/${uid}`, { method: 'DELETE' })
    groups.value = groups.value.filter(g => g.uid !== uid)
  }

  async function inviteMember(uid: string, username: string) {
    return await $fetch<{ success: boolean, message: string }>(`/api/groups/${uid}/invite`, {
      method: 'POST',
      body: { username }
    })
  }

  async function promoteMember(uid: string, userId: number) {
    return await $fetch<{ success: boolean, message: string }>(`/api/groups/${uid}/promote`, {
      method: 'POST',
      body: { userId }
    })
  }

  async function leaveGroup(uid: string) {
    await $fetch(`/api/groups/${uid}/leave`, { method: 'POST' })
    groups.value = groups.value.filter(g => g.uid !== uid)
  }

  return {
    groups: readonly(groups),
    fetchGroups,
    createGroup,
    deleteGroup,
    inviteMember,
    promoteMember,
    leaveGroup
  }
}
