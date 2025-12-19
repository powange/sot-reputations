import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { BaseTableRow } from '~/types/reputation'

/**
 * Crée la colonne "Succès" - le rendu est géré via slot #name-cell dans les pages
 */
export function createSuccessColumn<T extends BaseTableRow>(): TableColumn<T> {
  return {
    accessorKey: 'name',
    header: 'Succès'
  }
}

/**
 * Crée la colonne "Max" - le rendu avec popover est géré via slot #maxThreshold-cell dans les pages
 */
export function createMaxColumn<T extends BaseTableRow>(): TableColumn<T> {
  return {
    accessorKey: 'maxThreshold',
    header: 'Max',
    meta: { class: { th: 'w-full', td: 'w-full' } }
  }
}

/**
 * Crée la colonne "Progression" pour un utilisateur unique
 */
export function createProgressColumn<T extends { progress: string; completed: boolean; hasProgress: boolean }>(): TableColumn<T> {
  return {
    accessorKey: 'progress',
    header: 'Progression',
    cell: ({ row }) => {
      let colorClass = 'text-muted'
      if (row.original.completed) {
        colorClass = 'text-success font-medium'
      } else if (row.original.hasProgress) {
        colorClass = 'text-warning'
      }

      return h('span', { class: colorClass }, row.original.progress)
    }
  }
}

/**
 * Crée une colonne utilisateur pour le tableau de groupe
 */
export function createUserColumn<T extends Record<string, unknown>>(
  userId: number,
  username: string,
  lastImportAt: string | null,
  formatLastImport: (date: string | null) => string
): TableColumn<T> {
  return {
    accessorKey: `user_${userId}`,
    header: () => h('div', {}, [
      h('div', { class: 'font-medium' }, username),
      h('div', { class: 'text-xs text-muted font-normal whitespace-nowrap' }, formatLastImport(lastImportAt))
    ]),
    cell: ({ row }) => {
      const value = row.original[`user_${userId}_display`] as string
      const completed = row.original[`user_${userId}_completed`] as boolean
      const hasProgress = row.original[`user_${userId}_hasProgress`] as boolean

      let colorClass = 'text-muted'
      if (completed) {
        colorClass = 'text-success font-medium'
      } else if (hasProgress) {
        colorClass = 'text-warning'
      }

      return h('span', { class: colorClass }, value)
    }
  }
}
