import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, errorMessage } from './client'

const get = (url, params) => api.get(url, { params }).then((response) => response.data)

export const useProperties = () => useQuery({ queryKey: ['properties'], queryFn: () => get('/properties/') })

export const useOverview = () => useQuery({ queryKey: ['overview'], queryFn: () => get('/properties/overview/') })

export const useReminders = () => useQuery({ queryKey: ['reminders'], queryFn: () => get('/reminders/') })

export const useDashboard = (homeId) =>
  useQuery({ queryKey: ['dashboard', homeId], queryFn: () => get(`/properties/${homeId}/dashboard/`) })

export const usePayments = (homeId, month) =>
  useQuery({ queryKey: ['payments', homeId, month], queryFn: () => get('/payments/', { property: homeId, month }) })

export const useCalendar = (homeId, month) =>
  useQuery({ queryKey: ['calendar', homeId, month], queryFn: () => get('/calendar/', { property: homeId, month }) })

export const useUtilities = (homeId) =>
  useQuery({ queryKey: ['utilities', homeId], queryFn: () => get('/utilities/', { property: homeId }) })

export const useReadings = (homeId, utilityId) =>
  useQuery({
    queryKey: ['readings', homeId, utilityId],
    queryFn: () => get('/meter-readings/', { property: homeId, utility: utilityId || undefined }),
  })

// File links are signed for 10 minutes, so documents refresh every 5.
export const useDocuments = (homeId) =>
  useQuery({
    queryKey: ['documents', homeId],
    queryFn: () => get('/documents/', { property: homeId }),
    refetchInterval: 5 * 60 * 1000,
  })

export const useContracts = (homeId) =>
  useQuery({ queryKey: ['contracts', homeId], queryFn: () => get('/contracts/', { property: homeId }) })

/**
 * Any write. Refreshes every query afterwards: the data is small, and it keeps the
 * dashboard, calendar and reminders in sync without per-screen cache rules.
 */
export function useSave(mutationFn, { success, notifyErrors = true } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries()
      if (success) notifications.show({ color: 'teal', message: success })
    },
    onError: (error) => {
      if (notifyErrors) notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) })
    },
  })
}

export function uploadDocument({ property, kind, file, room = '', description = '', takenOn = '' }) {
  const form = new FormData()
  form.append('property', property)
  form.append('kind', kind)
  form.append('file', file)
  if (room) form.append('room', room)
  if (description) form.append('description', description)
  if (takenOn) form.append('taken_on', takenOn)
  return api.post('/documents/', form).then((response) => response.data)
}
