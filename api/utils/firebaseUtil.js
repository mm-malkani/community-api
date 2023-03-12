import admin from 'firebase-admin'
import credentials from "../../serviceAccountKey.json" assert { type: 'json' };

admin.initializeApp(
{
    credential: admin.credential.cert(credentials),
    storageBucket: 'backend-api-95df1.appspot.com'
})

export default admin