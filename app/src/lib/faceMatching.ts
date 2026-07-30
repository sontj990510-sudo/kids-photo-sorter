import { compareFaceEmbeddings } from './faceDetection'

export type FaceProfileRecord = {
  childId: string
  embeddings: number[][]
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

const MATCH_THRESHOLD = 0.62
const MINIMUM_MARGIN = 0.05

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
