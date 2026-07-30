import { Human, match } from '@vladmandic/human'
import type { Config } from '@vladmandic/human'

export type DetectedFaceBox = {
  x: number
  y: number
  width: number
  height: number
  score: number
}

export type DetectedFace = DetectedFaceBox & {
  embedding?: number[]
}

export type FaceDetectionResult = {
  faces: DetectedFace[]
  durationMs: number
}

const MODEL_BASE_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/'

const humanConfig: Partial<Config> = {
  backend: 'webgl',
  modelBasePath: MODEL_BASE_PATH,
  cacheModels: true,
  warmup: 'face',
  debug: false,
  filter: {
    enabled: true,
    width: 1280,
    height: 0,
    return: true,
    autoBrightness: true,
  },
  face: {
    enabled: true,
    detector: {
      modelPath: 'blazeface.json',
      maxDetected: 30,
      minConfidence: 0.35,
      minSize: 24,
      rotation: false,
      return: false,
    },
    mesh: { enabled: false },
    attention: { enabled: false },
    iris: { enabled: false },
    description: {
      enabled: true,
      modelPath: 'faceres.json',
      minConfidence: 0.5,
    },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
    gear: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
}

let humanPromise: Promise<Human> | null = null

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('사진을 읽지 못했어요.'))
    image.src = url
  })
}

async function createHuman() {
  const human = new Human(humanConfig)
  await human.load()
  await human.warmup()
  return human
}

function getHuman() {
  if (!humanPromise) {
    humanPromise = createHuman().catch((error) => {
      humanPromise = null
      throw error
    })
  }

  return humanPromise
}

export async function analyzeFacesInFile(file: File): Promise<FaceDetectionResult> {
  const imageUrl = URL.createObjectURL(file)

  try {
    const [human, image] = await Promise.all([getHuman(), loadImage(imageUrl)])
    const startedAt = performance.now()
    const result = await human.detect(image)

    if (result.error) {
      throw new Error(result.error)
    }

    const faces = result.face.map((face) => {
      const [rawX, rawY, rawWidth, rawHeight] = face.boxRaw
      const x = clamp(rawX)
      const y = clamp(rawY)

      return {
        x,
        y,
        width: Math.min(clamp(rawWidth), 1 - x),
        height: Math.min(clamp(rawHeight), 1 - y),
        score: face.boxScore,
        embedding: face.embedding?.slice(),
      }
    })

    return {
      faces,
      durationMs: Math.round(performance.now() - startedAt),
    }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export function compareFaceEmbeddings(first: number[], second: number[]) {
  if (first.length === 0 || first.length !== second.length) {
    return 0
  }

  return match.similarity(first, second)
}
