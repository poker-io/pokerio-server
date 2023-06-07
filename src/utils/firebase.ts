import admin from 'firebase-admin'
import { getMessaging, type Message } from 'firebase-admin/messaging'
import { readFileSync } from 'fs'
import { type PoolClient } from 'pg'
import { getPlayersInGame } from './commonRequest'

const serviceAccount = JSON.parse(
  readFileSync('./src/serviceAccount.json', 'utf-8')
)

admin.initializeApp({
  credential: admin.credential.cert({
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
    projectId: serviceAccount.project_id,
  }),
})

export function isTestingEnv() {
  return process.env.JEST_WORKER_ID !== undefined
}

export async function verifyFCMToken(fcmToken) {
  if (isTestingEnv()) {
    // We don't want to verify tokens when testing
    return true
  } else {
    let sentSuccessfully = true
    await admin
      .messaging()
      .send(
        {
          token: fcmToken,
        },
        true
      )
      .catch(() => {
        sentSuccessfully = false
      })
    return sentSuccessfully
  }
}

export async function sendFirebaseMessage(message: Message) {
  // We don't want to send messages when testing.
  if (!isTestingEnv()) {
    await getMessaging()
      .send(message)
      .then((response) => {
        console.log('Successfully sent message:', response)
      })
      .catch((error) => {
        console.log('Error sending message:', error)
      })
  }
}

export async function sendFirebaseMessageToEveryone(
  message: TokenMessage,
  gameId: string,
  client: PoolClient
) {
  const players = await getPlayersInGame(gameId, client)

  for (const player of players) {
    message.token = player.token
    await sendFirebaseMessage(message)
  }
}
