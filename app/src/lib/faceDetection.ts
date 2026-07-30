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

export type RepresentativePhotoAssessment = {
  status: 'good' | 'warning' | 'error'
  score: number
  faceCount: number
  brightness: number
  sharpness: number
  issues: string[]
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

async function measurePhoto(file: File) {
  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(imageUrl)
    const maximumSide = 180
    const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(24, Math.round(image.naturalWidth * scale))
    const height = Math.max(24, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    canvas.width = width
    canvas.height = height

    if (!context) {
      return { brightness: 128, sharpness: 100 }
    }

    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    const grayscale = new Float32Array(width * height)
    let brightnessTotal = 0

    for (let index = 0; index < grayscale.length; index += 1) {
      const pixelIndex = index * 4
      const value =
        pixels[pixelIndex] * 0.299 +
        pixels[pixelIndex + 1] * 0.587 +
        pixels[pixelIndex + 2] * 0.114
      grayscale[index] = value
      brightnessTotal += value
    }

    let laplacianTotal = 0
    let laplacianSquaredTotal = 0
    let laplacianCount = 0

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x
        const laplacian =
          grayscale[index - width] +
          grayscale[index + width] +
          grayscale[index - 1] +
          grayscale[index + 1] -
          grayscale[index] * 4
        laplacianTotal += laplacian
        laplacianSquaredTotal += laplacian * laplacian
        laplacianCount += 1
      }
    }

    const laplacianMean = laplacianTotal / Math.max(1, laplacianCount)
    const sharpness =
      laplacianSquaredTotal / Math.max(1, laplacianCount) -
      laplacianMean * laplacianMean

    return {
      brightness: Math.round(brightnessTotal / Math.max(1, grayscale.length)),
      sharpness: Math.round(sharpness),
    }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export async function assessRepresentativePhoto(
  file: File,
  slot: 'front-1' | 'front-2' | 'left' | 'right' | 'full-body' | 'close-up',
): Promise<RepresentativePhotoAssessment> {
  const [analysis, photoMetrics] = await Promise.all([
    analyzeFacesInFile(file),
    measurePhoto(file),
  ])
  const issues: string[] = []
  const onlyFace = analysis.faces.length === 1 ? analysis.faces[0] : undefined
  let score = 100

  if (analysis.faces.length === 0) {
    return {
      status: 'error',
      score: 0,
      faceCount: 0,
      brightness: photoMetrics.brightness,
      sharpness: photoMetrics.sharpness,
      issues: ['얼굴을 찾지 못했어요. 얼굴이 보이는 다른 사진을 선택해 주세요.'],
    }
  }

  if (analysis.faces.length > 1) {
    return {
      status: 'error',
      score: 0,
      faceCount: analysis.faces.length,
      brightness: photoMetrics.brightness,
      sharpness: photoMetrics.sharpness,
      issues: ['여러 사람의 얼굴이 보여요. 해당 아이만 나온 사진을 선택해 주세요.'],
    }
  }

  if (!onlyFace?.embedding?.length) {
    return {
      status: 'error',
      score: 0,
      faceCount: 1,
      brightness: photoMetrics.brightness,
      sharpness: photoMetrics.sharpness,
      issues: ['얼굴 특징을 읽지 못했어요. 더 선명한 사진을 선택해 주세요.'],
    }
  }

  const faceArea = onlyFace.width * onlyFace.height
  const minimumFaceArea =
    slot === 'full-body' ? 0.004 : slot === 'close-up' ? 0.1 : 0.025

  if (onlyFace.score < 0.55) {
    issues.push('얼굴 인식 신뢰도가 낮아요.')
    score -= 24
  }

  if (faceArea < minimumFaceArea) {
    issues.push(
      slot === 'full-body'
        ? '전신사진에서 얼굴이 너무 작아요. 조금 더 가까운 전신사진을 권장해요.'
        : slot === 'close-up'
          ? '근접사진치고 얼굴이 작아요. 얼굴이 더 크게 나온 사진을 권장해요.'
          : '얼굴이 너무 작아요. 조금 더 가까이 찍은 사진을 권장해요.',
    )
    score -= 22
  }

  if (photoMetrics.brightness < 45) {
    issues.push('사진이 너무 어두워요.')
    score -= 20
  } else if (photoMetrics.brightness > 225) {
    issues.push('사진이 너무 밝아 얼굴 윤곽이 약할 수 있어요.')
    score -= 16
  }

  if (photoMetrics.sharpness < 28) {
    issues.push('사진이 흐리거나 초점이 약해 보여요.')
    score -= 22
  }

  return {
    status: issues.length > 0 ? 'warning' : 'good',
    score: Math.max(1, Math.round(score)),
    faceCount: 1,
    brightness: photoMetrics.brightness,
    sharpness: photoMetrics.sharpness,
    issues,
  }
}

export function compareFaceEmbeddings(first: number[], second: number[]) {
  if (first.length === 0 || first.length !== second.length) {
    return 0
  }

  return match.similarity(first, second)
}
