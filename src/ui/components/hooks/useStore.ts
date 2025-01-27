import { useEffect, useRef, useState } from 'react'
import qs from 'querystring'

import { Status } from '../constants'
import * as api from '../../../@types/api'
import { AppQueue, AppJob } from '../../../@types/app'

const interval = 5000

type State = {
  data: null | api.GetQueues
  loading: boolean
}

type SelectedStatuses = Record<AppQueue['name'], Status>

export interface Store {
  state: State
  retryJob: (queueName: string) => (job: AppJob) => () => Promise<void>
  retryAll: (queueName: string) => () => Promise<void>
  cleanAllDelayed: (queueName: string) => () => Promise<void>
  cleanAllFailed: (queueName: string) => () => Promise<void>
  selectedStatuses: SelectedStatuses
  setSelectedStatuses: React.Dispatch<React.SetStateAction<SelectedStatuses>>
}

export const useStore = (basePath: string): Store => {
  const [state, setState] = useState({
    data: null,
    loading: true,
  } as State)
  const [selectedStatuses, setSelectedStatuses] = useState(
    {} as SelectedStatuses,
  )

  const poll = useRef(undefined as undefined | NodeJS.Timeout)
  const stopPolling = () => {
    if (poll.current) {
      clearTimeout(poll.current)
      poll.current = undefined
    }
  }

  useEffect(() => {
    stopPolling()
    runPolling()

    return stopPolling
  }, [selectedStatuses])

  const runPolling = () => {
    update()
      .catch(error => console.error('Failed to poll', error))
      .then(() => {
        const timeoutId = setTimeout(runPolling, interval)
        poll.current = timeoutId
      })
  }

  const update = () =>
    fetch(`${basePath}/queues/?${qs.encode(selectedStatuses)}`)
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then(data => setState({ data, loading: false }))

  const retryJob = (queueName: string) => (job: AppJob) => () =>
    fetch(`${basePath}/queues/${queueName}/${job.id}/retry`, {
      method: 'put',
    }).then(update)

  const retryAll = (queueName: string) => () =>
    fetch(`${basePath}/queues/${queueName}/retry`, {
      method: 'put',
    }).then(update)

  const cleanAllDelayed = (queueName: string) => () =>
    fetch(`${basePath}/queues/${queueName}/clean/delayed`, {
      method: 'put',
    }).then(update)

  const cleanAllFailed = (queueName: string) => () =>
    fetch(`${basePath}/queues/${queueName}/clean/failed`, {
      method: 'put',
    }).then(update)

  return {
    state,
    retryJob,
    retryAll,
    cleanAllDelayed,
    cleanAllFailed,
    selectedStatuses,
    setSelectedStatuses,
  }
}
