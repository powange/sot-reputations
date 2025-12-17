import type { H3Event } from 'h3'

interface SSEConnection {
  id: string
  send: (event: string, data: unknown) => void
  close: () => void
}

// Map<groupUid, Map<connectionId, SSEConnection>>
const groupConnections = new Map<string, Map<string, SSEConnection>>()

export function addGroupConnection(groupUid: string, connection: SSEConnection): void {
  if (!groupConnections.has(groupUid)) {
    groupConnections.set(groupUid, new Map())
  }
  groupConnections.get(groupUid)!.set(connection.id, connection)
}

export function removeGroupConnection(groupUid: string, connectionId: string): void {
  const connections = groupConnections.get(groupUid)
  if (connections) {
    connections.delete(connectionId)
    if (connections.size === 0) {
      groupConnections.delete(groupUid)
    }
  }
}

export function broadcastToGroup(groupUid: string, event: string, data: unknown): void {
  const connections = groupConnections.get(groupUid)
  if (connections) {
    for (const connection of connections.values()) {
      connection.send(event, data)
    }
  }
}

export function broadcastToGroups(groupUids: string[], event: string, data: unknown): void {
  for (const groupUid of groupUids) {
    broadcastToGroup(groupUid, event, data)
  }
}

export function createSSEStream(event: H3Event, groupUid: string): SSEConnection {
  const connectionId = crypto.randomUUID()

  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const send = (eventName: string, data: unknown) => {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
    event.node.res.write(message)
  }

  const close = () => {
    removeGroupConnection(groupUid, connectionId)
    event.node.res.end()
  }

  // Envoyer un ping initial pour confirmer la connexion
  send('connected', { connectionId })

  const connection: SSEConnection = { id: connectionId, send, close }
  addGroupConnection(groupUid, connection)

  // Nettoyer quand le client se déconnecte
  event.node.req.on('close', () => {
    removeGroupConnection(groupUid, connectionId)
  })

  return connection
}

// Pour le debug
export function getConnectionsCount(groupUid: string): number {
  return groupConnections.get(groupUid)?.size ?? 0
}

export function getAllConnectionsCount(): number {
  let count = 0
  for (const connections of groupConnections.values()) {
    count += connections.size
  }
  return count
}
