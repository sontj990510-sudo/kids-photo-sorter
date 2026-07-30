import { compareFaceEmbeddings } from './faceDetection'

export type FaceProfileRecord = {
  childId: string
  embeddings: number[][]
  representativeEmbeddings?: number[][]
  learnedEmbeddings?: number[][]
  sourcePhotoCount: number
  skippedPhotoCount: number
  updatedAt: string
}

export type FaceMatch = {
  status: 'matched' | 'review'
  childId?: string
  suggestedChildId?: string
  similarity: number
  secondBestSimilarity: number
}

export type FaceProfileConflict = {
  childId: string
  similarity: number
}

const MATCH_THRESHOLD = 0.62
const MINIMUM_MARGIN = 0.05
const CONFLICT_THRESHOLD = 0.62
const DUPLICATE_THRESHOLD = 0.999
const MAX_PROFILE_EMBEDDINGS = 40

export function addLearnedFaceEmbedding(
  existingProfile: FaceProfileRecord | undefined,
  childId: string,
  embedding: number[],
  sourcePhotoCount: number,
) {
  const representativeEmbeddings =
    existingProfile?.representativeEmbeddings ?? existingProfile?.embeddings ?? []
  const learnedEmbeddings = existingProfile?.learnedEmbeddings ?? []
  const allExistingEmbeddings = [...representativeEmbeddings, ...learnedEmbeddings]
  const isDuplicate = allExistingEmbeddings.some(
    (reference) => compareFaceEmbeddings(embedding, reference) >= DUPLICATE_THRESHOLD,
  )
  const maximumLearnedCount = Math.max(
    0,
    MAX_PROFILE_EMBEDDINGS - representativeEmbeddings.length,
  )
  const nextLearnedEmbeddings = isDuplicate
    ? learnedEmbeddings
    : maximumLearnedCount > 0
      ? [...learnedEmbeddings, embedding].slice(-maximumLearnedCount)
      : []

  return {
    added: !isDuplicate,
    profile: {
      childId,
      representativeEmbeddings,
      learnedEmbeddings: nextLearnedEmbeddings,
      embeddings: [...representativeEmbeddings, ...nextLearnedEmbeddings],
      sourcePhotoCount: existingProfile?.sourcePhotoCount ?? sourcePhotoCount,
      skippedPhotoCount: existingProfile?.skippedPhotoCount ?? 0,
      updatedAt: new Date().toISOString(),
    } satisfies FaceProfileRecord,
  }
}

export function findSimilarOtherChild(
  embedding: number[],
  profiles: FaceProfileRecord[],
  targetChildId: string,
): FaceProfileConflict | undefined {
  const strongestConflict = profiles
    .filter(
      (profile) => profile.childId !== targetChildId && profile.embeddings.length > 0,
    )
    .map((profile) => ({
      childId: profile.childId,
      similarity: Math.max(
        ...profile.embeddings.map((reference) =>
          compareFaceEmbeddings(embedding, reference),
        ),
      ),
    }))
    .sort((left, right) => right.similarity - left.similarity)[0]

  return strongestConflict && strongestConflict.similarity >= CONFLICT_THRESHOLD
    ? strongestConflict
    : undefined
}

export function matchFaceEmbedding(
  embedding: number[] | undefined,
  profiles: FaceProfileRecord[],
): FaceMatch {
  if (!embedding || embedding.length === 0 || profiles.length === 0) {
    return {
      status: 'review',
      similarity: 0,
      secondBestSimilarity: 0,
    }
  }

  const candidates = profiles
    .filter((profile) => profile.embeddings.length > 0)
    .map((profile) => ({
      childId: profile.childId,
      similarity: Math.max(
        ...profile.embeddings.map((reference) => compareFaceEmbeddings(embedding, reference)),
      ),
    }))
    .sort((left, right) => right.similarity - left.similarity)

  const best = candidates[0]
  const secondBestSimilarity = candidates[1]?.similarity ?? 0

  if (!best) {
    return {
      status: 'review',
      similarity: 0,
      secondBestSimilarity: 0,
    }
  }

  const isConfident =
    best.similarity >= MATCH_THRESHOLD &&
    best.similarity - secondBestSimilarity >= MINIMUM_MARGIN

  return {
    status: isConfident ? 'matched' : 'review',
    childId: isConfident ? best.childId : undefined,
    suggestedChildId: best.childId,
    similarity: best.similarity,
    secondBestSimilarity,
  }
}
