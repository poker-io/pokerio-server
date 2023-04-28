import admin from 'firebase-admin'
import { getMessaging } from 'firebase-admin/messaging'
import { readFileSync } from 'fs'

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

export const verifyFCMToken = async (fcmToken) => {
  if (process.env.JEST_WORKER_ID !== undefined) {
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

export async function sendFirebaseMessage(message: any) {
  if (process.env.JEST_WORKER_ID === undefined) {
    // We don't want to send messages when testing.
    // Sending firebase message to all players except the one who just joined.
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
