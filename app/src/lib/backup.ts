import type { FaceProfileRecord } from './faceMatching'

export type BackupAppSettings = {
  id: 'app-settings'
  onboardingCompleted: boolean
  classSize: number
  lastBackupAt?: string
  updatedAt: string
}

export type BackupChildRecord = {
  id: string
  name: string
  photoFiles: File[]
  createdAt: string
  updatedAt: string
}

export type GivingTreeBackupPayload = {
  format: 'giving-tree-backup'
  version: 1
  exportedAt: string
  children: BackupChildRecord[]
  faceProfiles: FaceProfileRecord[]
  settings: BackupAppSettings
}

type SerializedPhoto = {
  name: string
  type: string
  lastModified: number
  data: string
}

type SerializedChild = Omit<BackupChildRecord, 'photoFiles'> & {
  photoFiles: SerializedPhoto[]
}

type SerializedBackupPayload = Omit<GivingTreeBackupPayload, 'children'> & {
  children: SerializedChild[]
}

type EncryptedBackupEnvelope = {
  format: 'giving-tree-encrypted-backup'
  version: 1
  algorithm: 'AES-GCM'
  iterations: number
  salt: string
  iv: string
  data: string
}

const BACKUP_ITERATIONS = 210_000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function deriveBackupKey(password: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      iterations,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function serializePhoto(file: File): Promise<SerializedPhoto> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  return {
    name: file.name,
    type: file.type || 'image/jpeg',
    lastModified: file.lastModified,
    data: bytesToBase64(bytes),
  }
}

async function serializeBackup(payload: GivingTreeBackupPayload) {
  const children: SerializedChild[] = []

  for (const child of payload.children) {
    const photoFiles: SerializedPhoto[] = []

    for (const file of child.photoFiles) {
      photoFiles.push(await serializePhoto(file))
    }

    children.push({
      id: child.id,
      name: child.name,
      photoFiles,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    })
  }

  return JSON.stringify({
    ...payload,
    children,
  } satisfies SerializedBackupPayload)
}

function parseSerializedBackup(serialized: string): GivingTreeBackupPayload {
  const parsed = JSON.parse(serialized) as Partial<SerializedBackupPayload>

  if (
    parsed.format !== 'giving-tree-backup' ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.children) ||
    !Array.isArray(parsed.faceProfiles) ||
    !parsed.settings
  ) {
    throw new Error('Giving Tree 백업 파일 형식이 아니에요.')
  }

  const children: BackupChildRecord[] = parsed.children.map((child) => {
    if (
      typeof child.id !== 'string' ||
      typeof child.name !== 'string' ||
      !Array.isArray(child.photoFiles)
    ) {
      throw new Error('백업 파일의 아이 정보가 올바르지 않아요.')
    }

    return {
      id: child.id,
      name: child.name,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
      photoFiles: child.photoFiles.map(
        (photo) =>
          new File([base64ToBytes(photo.data)], photo.name, {
            type: photo.type,
            lastModified: photo.lastModified,
          }),
      ),
    }
  })

  return {
    format: 'giving-tree-backup',
    version: 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    children,
    faceProfiles: parsed.faceProfiles,
    settings: {
      id: 'app-settings',
      onboardingCompleted: Boolean(parsed.settings.onboardingCompleted),
      classSize: Math.min(40, Math.max(1, Number(parsed.settings.classSize) || 20)),
      lastBackupAt: parsed.settings.lastBackupAt,
      updatedAt: parsed.settings.updatedAt ?? new Date().toISOString(),
    },
  }
}

export async function createEncryptedBackupFile(
  payload: GivingTreeBackupPayload,
  password: string,
) {
  const serialized = await serializeBackup(payload)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveBackupKey(password, salt, BACKUP_ITERATIONS)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(serialized),
  )
  const envelope: EncryptedBackupEnvelope = {
    format: 'giving-tree-encrypted-backup',
    version: 1,
    algorithm: 'AES-GCM',
    iterations: BACKUP_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  }
  const date = new Date().toISOString().slice(0, 10)

  return new File([JSON.stringify(envelope)], `giving-tree-backup-${date}.givingtree`, {
    type: 'application/octet-stream',
    lastModified: Date.now(),
  })
}

export async function readEncryptedBackupFile(file: File, password: string) {
  const envelope = JSON.parse(await file.text()) as Partial<EncryptedBackupEnvelope>

  if (
    envelope.format !== 'giving-tree-encrypted-backup' ||
    envelope.version !== 1 ||
    envelope.algorithm !== 'AES-GCM' ||
    typeof envelope.iterations !== 'number' ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.data !== 'string'
  ) {
    throw new Error('Giving Tree 암호화 백업 파일이 아니에요.')
  }

  try {
    const salt = base64ToBytes(envelope.salt)
    const iv = base64ToBytes(envelope.iv)
    const key = await deriveBackupKey(password, salt, envelope.iterations)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(envelope.data),
    )

    return parseSerializedBackup(decoder.decode(decrypted))
  } catch (error) {
    if (error instanceof Error && error.message.includes('백업')) {
      throw error
    }

    throw new Error('백업 비밀번호가 틀리거나 파일이 손상됐어요.', {
      cause: error,
    })
  }
}
