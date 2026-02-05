import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { getFirebase } from './firebase'

function safeName(value: string): string {
  return value
    .trim()
    .replaceAll(/[\s/\\]+/g, '_')
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '')
}

export async function uploadEmployeePhoto(file: File): Promise<string> {
  const app = getFirebase().app
  const storage = getStorage(app)
  const name = safeName(file.name || 'photo')
  const objectPath = `employeePhotos/${Date.now()}_${name}`
  const objectRef = ref(storage, objectPath)
  const snap = await uploadBytes(objectRef, file, { contentType: file.type || undefined })
  return await getDownloadURL(snap.ref)
}

