import { compareFaceEmbeddings } from './faceDetection'

export type FaceProfileRecord = {
  childId: string
  embeddings: number[][]
  representativeEmbeddings?: number[][]
  learnedEmbeddings?: number[][]
  learnedSamples?: LearnedFaceSample[]
  sourcePhotoCount: number
  skippedPhotoCount: number
  updatedAt: string
}

export type LearnedFaceSample = {
  id: string
  embedding: number[]
  addedAt: string
  sourceFileName?: string
}

export type FaceMatch = {
  status: 'matched' | 'review'
  childId?: string
  suggestedChildId?: string
  similarity: number
  secondBestSimilarity: number
  supportingSamples?: number
  requiredThreshold?: number
}

export type FaceProfileConflict = {
  childId: string
  similarity: number
}

const MATCH_THRESHOLD = 0.58
const MINIMUM_MARGIN = 0.055
const MINIMUM_SUPPORT_SIMILARITY = 0.52
const CONFLICT_THRESHOLD = 0.62
const DUPLICATE_THRESHOLD = 0.999
const MAX_PROFILE_EMBEDDINGS = 40

function createLearnedSampleId() {
  return globalThis.crypto?.randomUUID?.() ?? `learned-${Date.now()}-${Math.random()}`
}

function normalizeLearnedSamples(profile: FaceProfileRecord | undefined) {
  if (!profile) {
    return []
  }

  if (
    profile.learnedSamples &&
    profile.learnedSamples.length === (profile.learnedEmbeddings?.length ?? 0)
  ) {
    return profile.learnedSamples
  }

  return (profile.learnedEmbeddings ?? []).map((embedding, index) => ({
    id: `legacy-${profile.childId}-${index}`,
    embedding,
    addedAt: profile.updatedAt,
  }))
}

function getRobustProfileSimilarity(embedding: number[], references: number[][]) {
  const similarities = references
    .map((reference) => compareFaceEmbeddings(embedding, reference))
    .sort((left, right) => right - left)
  const strongestSimilarity = similarities[0] ?? 0
  const topSimilarities = similarities.slice(0, 3)
  const similarity =
    topSimilarities.length === 1
      ? topSimilarities[0]
      : topSimilarities.length === 2
        ? topSimilarities[0] * 0.65 + topSimilarities[1] * 0.35
        : topSimilarities[0] * 0.55 +
          topSimilarities[1] * 0.3 +
          topSimilarities[2] * 0.15
  const supportingSamples = similarities.filter(
    (candidate) =>
      candidate >=
      Math.max(MINIMUM_SUPPORT_SIMILARITY, strongestSimilarity - 0.12),
  ).length

  return {
    similarity,
    strongestSimilarity,
    supportingSamples,
  }
}

export function addLearnedFaceEmbedding(
  existingProfile: FaceProfileRecord | undefined,
  childId: string,
  embedding: number[],
  sourcePhotoCount: number,
  sourceFileName?: string,
) {
  const representativeEmbeddings =
    existingProfile?.representativeEmbeddings ?? existingProfile?.embeddings ?? []
  const learnedSamples = normalizeLearnedSamples(existingProfile)
  const learnedEmbeddings = learnedSamples.map((sample) => sample.embedding)
  const allExistingEmbeddings = [...representativeEmbeddings, ...learnedEmbeddings]
  const isDuplicate = allExistingEmbeddings.some(
    (reference) => compareFaceEmbeddings(embedding, reference) >= DUPLICATE_THRESHOLD,
  )
  const maximumLearnedCount = Math.max(
    0,
    MAX_PROFILE_EMBEDDINGS - representativeEmbeddings.length,
  )
  const nextLearnedSamples = isDuplicate
    ? learnedSamples
    : maximumLearnedCount > 0
      ? [
          ...learnedSamples,
          {
            id: createLearnedSampleId(),
            embedding,
            addedAt: new Date().toISOString(),
            sourceFileName,
          },
        ].slice(-maximumLearnedCount)
      : []
  const nextLearnedEmbeddings = nextLearnedSamples.map((sample) => sample.embedding)

  return {
    added: !isDuplicate,
    profile: {
      childId,
      representativeEmbeddings,
      learnedEmbeddings: nextLearnedEmbeddings,
      learnedSamples: nextLearnedSamples,
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
      similarity: getRobustProfileSimilarity(embedding, profile.embeddings)
        .strongestSimilarity,
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
    .map((profile) => {
      const comparison = getRobustProfileSimilarity(embedding, profile.embeddings)

      return {
        childId: profile.childId,
        ...comparison,
        referenceCount: profile.embeddings.length,
      }
    })
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

  const requiredThreshold = Math.max(
    MATCH_THRESHOLD,
    secondBestSimilarity + MINIMUM_MARGIN,
  )
  const requiredSupport = Math.min(2, best.referenceCount)
  const isConfident =
    best.similarity >= requiredThreshold &&
    best.supportingSamples >= requiredSupport

  return {
    status: isConfident ? 'matched' : 'review',
    childId: isConfident ? best.childId : undefined,
    suggestedChildId: best.childId,
    similarity: best.similarity,
    secondBestSimilarity,
    supportingSamples: best.supportingSamples,
    requiredThreshold,
  }
}
