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

interface PendingInvite {
  id: number
  groupId: number
  groupUid: string
  groupName: string
  userId: number
  invitedBy: number
  invitedByUsername: string
  createdAt: string
}

export function useGroups() {
  const groups = useState<Group[]>('user-groups', () => [])
  const pendingInvites = useState<PendingInvite[]>('pending-invites', () => [])
  const isLoadingGroups = useState<boolean>('loading-groups', () => false)

  async function fetchGroups() {
    isLoadingGroups.value = true
    try {
      const response = await $fetch<{ groups: Group[] }>('/api/groups')
      groups.value = response.groups
    } catch {
      groups.value = []
    } finally {
      isLoadingGroups.value = false
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

  async function fetchPendingInvites() {
    try {
      const response = await $fetch<PendingInvite[]>('/api/me/pending-invites')
      pendingInvites.value = response
    } catch {
      pendingInvites.value = []
    }
  }

  async function acceptInvite(inviteId: number) {
    const response = await $fetch<{ success: boolean, message: string }>(`/api/pending-invites/${inviteId}/accept`, {
      method: 'POST'
    })
    pendingInvites.value = pendingInvites.value.filter(i => i.id !== inviteId)
    // Recharger les groupes pour inclure le nouveau
    await fetchGroups()
    return response
  }

  async function rejectInvite(inviteId: number) {
    const response = await $fetch<{ success: boolean, message: string }>(`/api/pending-invites/${inviteId}/reject`, {
      method: 'POST'
    })
    pendingInvites.value = pendingInvites.value.filter(i => i.id !== inviteId)
    return response
  }

  return {
    groups: readonly(groups),
    pendingInvites: readonly(pendingInvites),
    isLoadingGroups: readonly(isLoadingGroups),
    fetchGroups,
    createGroup,
    deleteGroup,
    inviteMember,
    promoteMember,
    leaveGroup,
    fetchPendingInvites,
    acceptInvite,
    rejectInvite
  }
}
