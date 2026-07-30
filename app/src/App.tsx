import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { openDB } from 'idb'
import {
  createEncryptedBackupFile,
  readEncryptedBackupFile,
} from './lib/backup'
import type { BackupAppSettings } from './lib/backup'
import {
  analyzeFacesInFile,
  assessRepresentativePhoto,
} from './lib/faceDetection'
import type {
  DetectedFaceBox,
  RepresentativePhotoAssessment,
} from './lib/faceDetection'
import {
  addLearnedFaceEmbedding,
  findSimilarOtherChild,
  matchFaceEmbedding,
} from './lib/faceMatching'
import type { FaceMatch, FaceProfileRecord } from './lib/faceMatching'
import './App.css'

type PreviewItem = {
  id: string
  file: File
  url: string
  slot?: RepresentativePhotoSlot
}

type AnalyzedFace = DetectedFaceBox & {
  embedding?: number[]
  match: FaceMatch
}

type FaceAnalysis = {
  faces: AnalyzedFace[]
  durationMs: number
  error?: string
}

type PendingLearning = {
  faceKey: string
  itemId: string
  faceIndex: number
  childId: string
}

type LearningConflict = PendingLearning & {
  otherChildId: string
  similarity: number
}

type ShareReceipt = {
  count: number
  completedAt: string
}

type LightboxPhoto = {
  src: string
  alt: string
  faces?: AnalyzedFace[]
}

type ChildRecord = {
  id: string
  name: string
  photoFiles: File[]
  photoSlotOrder?: RepresentativePhotoSlot[]
  createdAt: string
  updatedAt: string
}

type TabKey = 'register' | 'classify'
type RepresentativePhotoSlot =
  | 'front-1'
  | 'front-2'
  | 'left'
  | 'right'
  | 'full-body'
  | 'close-up'

type DraftPhotoAssessment =
  | RepresentativePhotoAssessment
  | {
      status: 'checking'
      score: 0
      faceCount: 0
      brightness: 0
      sharpness: 0
      issues: string[]
    }

const REPRESENTATIVE_PHOTO_SLOTS: ReadonlyArray<{
  key: RepresentativePhotoSlot
  title: string
  icon: string
  guide: string
}> = [
  {
    key: 'front-1',
    title: '정면 1',
    icon: '🙂',
    guide: '밝은 곳에서 카메라를 바라본 얼굴',
  },
  {
    key: 'front-2',
    title: '정면 2',
    icon: '😊',
    guide: '표정이나 거리를 조금 바꾼 정면',
  },
  {
    key: 'left',
    title: '왼쪽 얼굴',
    icon: '◀',
    guide: '아이의 왼쪽 얼굴이 보이게',
  },
  {
    key: 'right',
    title: '오른쪽 얼굴',
    icon: '▶',
    guide: '아이의 오른쪽 얼굴이 보이게',
  },
  {
    key: 'full-body',
    title: '전신',
    icon: '🧍',
    guide: '머리부터 발끝까지, 얼굴도 선명하게',
  },
  {
    key: 'close-up',
    title: '근접',
    icon: '🔍',
    guide: '얼굴이 화면에 크게 보이게',
  },
]

const DB_NAME = 'kids-photo-sorter-db'
const DB_VERSION = 3
const CHILDREN_STORE_NAME = 'children'
const FACE_PROFILES_STORE_NAME = 'faceProfiles'
const SETTINGS_STORE_NAME = 'settings'
const SETTINGS_ID = 'app-settings'
const REQUIRED_REPRESENTATIVE_PHOTOS = REPRESENTATIVE_PHOTO_SLOTS.length
const MIN_CLASS_SIZE = 1
const MAX_CLASS_SIZE = 40

function formatReceiptTime(completedAt: string) {
  return new Date(completedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function GivingTreeMark() {
  return (
    <svg
      className="giving-tree-mark"
      viewBox="0 0 160 160"
      role="img"
      aria-label="Giving Tree 나무 로고"
    >
      <path
        d="M75 136c9-23 5-43 4-62h13c-1 18 1 39 13 62H75Z"
        fill="#9a6544"
      />
      <path
        d="M85 102c-11-9-19-18-25-29M88 91c10-9 17-17 23-27"
        fill="none"
        stroke="#9a6544"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <circle cx="53" cy="62" r="31" fill="#8fc86b" />
      <circle cx="86" cy="46" r="37" fill="#5ea76f" />
      <circle cx="116" cy="68" r="30" fill="#77bb63" />
      <circle cx="80" cy="76" r="35" fill="#6db664" />
      <circle cx="48" cy="55" r="7" fill="#f6c768" />
      <circle cx="103" cy="42" r="7" fill="#f09b72" />
      <circle cx="111" cy="75" r="6" fill="#f6c768" />
      <path
        d="M72 47c-5-8-17-3-13 6 2 5 13 11 13 11s11-7 13-12c3-9-9-13-13-5Z"
        fill="#fff8df"
      />
      <path
        d="M45 131c20-7 64-7 84 0"
        fill="none"
        stroke="#d7e7bd"
        strokeLinecap="round"
        strokeWidth="8"
      />
    </svg>
  )
}

async function openChildrenDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(CHILDREN_STORE_NAME)) {
        const store = database.createObjectStore(CHILDREN_STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }

      if (!database.objectStoreNames.contains(FACE_PROFILES_STORE_NAME)) {
        database.createObjectStore(FACE_PROFILES_STORE_NAME, { keyPath: 'childId' })
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'id' })
      }
    },
  })
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('register')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [childName, setChildName] = useState('')
  const [draftPreviewItems, setDraftPreviewItems] = useState<PreviewItem[]>([])
  const [draftPhotoAssessments, setDraftPhotoAssessments] = useState<
    Partial<Record<RepresentativePhotoSlot, DraftPhotoAssessment>>
  >({})
  const [children, setChildren] = useState<ChildRecord[]>([])
  const [faceProfiles, setFaceProfiles] = useState<Record<string, FaceProfileRecord>>({})
  const [editingChildId, setEditingChildId] = useState<string | null>(null)
  const [childImageUrls, setChildImageUrls] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isPreparingProfiles, setIsPreparingProfiles] = useState(false)
  const [profileProgress, setProfileProgress] = useState({
    label: '',
    completed: 0,
    total: 0,
  })
  const [faceAnalyses, setFaceAnalyses] = useState<Record<string, FaceAnalysis>>({})
  const [learningSelections, setLearningSelections] = useState<Record<string, string>>({})
  const [learningFaceKey, setLearningFaceKey] = useState<string | null>(null)
  const [pendingLearning, setPendingLearning] = useState<PendingLearning | null>(null)
  const [learningConflict, setLearningConflict] = useState<LearningConflict | null>(null)
  const [learningHistoryChildId, setLearningHistoryChildId] = useState<string | null>(
    null,
  )
  const [excludedChildPhotos, setExcludedChildPhotos] = useState<Record<string, true>>({})
  const [shareReceipts, setShareReceipts] = useState<Record<string, ShareReceipt>>({})
  const [lightboxPhoto, setLightboxPhoto] = useState<LightboxPhoto | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [classSize, setClassSize] = useState(20)
  const [draftClassSize, setDraftClassSize] = useState(20)
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>()
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null)
  const [classSettingsOpen, setClassSettingsOpen] = useState(false)
  const [isClassSizeSaving, setIsClassSizeSaving] = useState(false)
  const [backupDialogOpen, setBackupDialogOpen] = useState(false)
  const [backupPassword, setBackupPassword] = useState('')
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState('')
  const [restorePassword, setRestorePassword] = useState('')
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [isBackupBusy, setIsBackupBusy] = useState(false)
  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({ completed: 0, total: 0 })

  const classifyInputRef = useRef<HTMLInputElement | null>(null)
  const registerInputRef = useRef<HTMLInputElement | null>(null)
  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const previewItemsRef = useRef<PreviewItem[]>([])
  const draftPreviewItemsRef = useRef<PreviewItem[]>([])
  const activeObjectUrlsRef = useRef<string[]>([])
  const childImageUrlsRef = useRef<Record<string, string>>({})
  const idSequenceRef = useRef(0)
  const activeDraftSlotRef = useRef<RepresentativePhotoSlot | null>(null)

  useEffect(() => {
    previewItemsRef.current = previewItems
  }, [previewItems])

  useEffect(() => {
    draftPreviewItemsRef.current = draftPreviewItems
  }, [draftPreviewItems])

  useEffect(() => {
    if (!pendingLearning || learningConflict) {
      return
    }

    const timerId = window.setTimeout(() => {
      setPendingLearning(null)
      setStatusMessage('추가 학습 확인 시간이 지나 취소됐어요. 필요하면 다시 눌러주세요.')
    }, 8000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [learningConflict, pendingLearning])

  useEffect(() => {
    if (!lightboxPhoto) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxPhoto(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [lightboxPhoto])

  useEffect(() => {
    return () => {
      previewItemsRef.current.forEach(({ url }) => URL.revokeObjectURL(url))
      activeObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      activeObjectUrlsRef.current = []
    }
  }, [])

  const revokeObjectUrl = (url: string) => {
    URL.revokeObjectURL(url)
    activeObjectUrlsRef.current = activeObjectUrlsRef.current.filter((currentUrl) => currentUrl !== url)
  }

  const createObjectUrl = (file: File) => {
    const url = URL.createObjectURL(file)
    activeObjectUrlsRef.current.push(url)
    return url
  }

  const createPreviewId = () => {
    const nextId = idSequenceRef.current + 1
    idSequenceRef.current = nextId
    return `preview-${nextId}`
  }

  const loadChildren = useCallback(async () => {
    try {
      const database = await openChildrenDB()
      const [savedChildren, savedProfiles, savedSettings] = await Promise.all([
        database.getAll(CHILDREN_STORE_NAME) as Promise<ChildRecord[]>,
        database.getAll(FACE_PROFILES_STORE_NAME) as Promise<FaceProfileRecord[]>,
        database.get(SETTINGS_STORE_NAME, SETTINGS_ID) as Promise<
          BackupAppSettings | undefined
        >,
      ])
      const sortedChildren = [...savedChildren].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )

      Object.values(childImageUrlsRef.current).forEach((url) => revokeObjectUrl(url))

      const nextChildImageUrls: Record<string, string> = {}
      sortedChildren.forEach((child) => {
        if (child.photoFiles.length > 0) {
          nextChildImageUrls[child.id] = createObjectUrl(child.photoFiles[0])
        }
      })

      childImageUrlsRef.current = nextChildImageUrls
      setChildren(sortedChildren)
      setChildImageUrls(nextChildImageUrls)
      setFaceProfiles(
        Object.fromEntries(savedProfiles.map((profile) => [profile.childId, profile])),
      )
      if (savedSettings) {
        const nextClassSize = Math.min(
          MAX_CLASS_SIZE,
          Math.max(MIN_CLASS_SIZE, savedSettings.classSize),
        )
        setClassSize(nextClassSize)
        setDraftClassSize(nextClassSize)
        setLastBackupAt(savedSettings.lastBackupAt)
        setOnboardingCompleted(savedSettings.onboardingCompleted)
        setOnboardingStep(savedSettings.onboardingCompleted ? null : 0)
      } else {
        setOnboardingCompleted(false)
        setOnboardingStep(0)
      }
    } catch (error) {
      if (error instanceof Error) {
        setStatusMessage(`아이 목록을 불러오지 못했어요. ${error.message}`)
      }
      setOnboardingStep(0)
    } finally {
      setSettingsLoaded(true)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadChildren()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadChildren])

  useEffect(() => {
    if (!settingsLoaded || !navigator.storage?.persisted) {
      return
    }

    void navigator.storage
      .persisted()
      .then((persistent) => setStoragePersistent(persistent))
      .catch(() => setStoragePersistent(null))
  }, [settingsLoaded])

  useEffect(() => {
    if (
      !backupDialogOpen &&
      !classSettingsOpen &&
      onboardingStep === null &&
      !learningHistoryChildId
    ) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (learningHistoryChildId) {
        setLearningHistoryChildId(null)
      } else if (backupDialogOpen) {
        setBackupDialogOpen(false)
      } else if (classSettingsOpen && !isClassSizeSaving) {
        setClassSettingsOpen(false)
      } else if (onboardingCompleted) {
        setOnboardingStep(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    backupDialogOpen,
    classSettingsOpen,
    isClassSizeSaving,
    learningHistoryChildId,
    onboardingCompleted,
    onboardingStep,
  ])

  const clearDraftPreview = () => {
    setLightboxPhoto(null)
    draftPreviewItems.forEach(({ url }) => revokeObjectUrl(url))
    draftPreviewItemsRef.current = []
    setDraftPreviewItems([])
    setDraftPhotoAssessments({})
    activeDraftSlotRef.current = null
  }

  const saveAppSettings = async (
    nextSettings: Omit<BackupAppSettings, 'id' | 'updatedAt'>,
  ) => {
    const database = await openChildrenDB()
    const settings: BackupAppSettings = {
      id: SETTINGS_ID,
      ...nextSettings,
      updatedAt: new Date().toISOString(),
    }

    await database.put(SETTINGS_STORE_NAME, settings)
    setClassSize(settings.classSize)
    setDraftClassSize(settings.classSize)
    setLastBackupAt(settings.lastBackupAt)
    setOnboardingCompleted(settings.onboardingCompleted)
    return settings
  }

  const requestPersistentStorage = async () => {
    if (!navigator.storage?.persist) {
      setStoragePersistent(null)
      return false
    }

    try {
      const persistent = await navigator.storage.persist()
      setStoragePersistent(persistent)
      return persistent
    } catch {
      setStoragePersistent(null)
      return false
    }
  }

  const handleFinishOnboarding = async () => {
    if (isOnboardingSaving) {
      return
    }

    const nextClassSize = Math.min(
      MAX_CLASS_SIZE,
      Math.max(MIN_CLASS_SIZE, Math.round(draftClassSize)),
    )
    setIsOnboardingSaving(true)

    try {
      await saveAppSettings({
        onboardingCompleted: true,
        classSize: nextClassSize,
        lastBackupAt,
      })
      const persistent = await requestPersistentStorage()
      setOnboardingStep(null)
      setActiveTab('register')
      setStatusMessage(
        persistent
          ? `${nextClassSize}명 반으로 시작할게요. 이 아이폰의 영구 저장도 준비됐어요.`
          : `${nextClassSize}명 반으로 시작할게요. 중요한 데이터는 백업 파일로도 보관해 주세요.`,
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `시작 설정을 저장하지 못했어요. ${error.message}`
          : '시작 설정을 저장하지 못했어요.',
      )
    } finally {
      setIsOnboardingSaving(false)
    }
  }

  const openOnboardingGuide = () => {
    setDraftClassSize(classSize)
    setOnboardingStep(0)
  }

  const openClassSettings = () => {
    setDraftClassSize(classSize)
    setClassSettingsOpen(true)
  }

  const handleSaveClassSize = async () => {
    if (isClassSizeSaving) {
      return
    }

    const minimumClassSize = Math.max(MIN_CLASS_SIZE, children.length)
    const nextClassSize = Math.min(
      MAX_CLASS_SIZE,
      Math.max(minimumClassSize, Math.round(draftClassSize)),
    )

    setIsClassSizeSaving(true)

    try {
      await saveAppSettings({
        onboardingCompleted: true,
        classSize: nextClassSize,
        lastBackupAt,
      })
      setClassSettingsOpen(false)
      setStatusMessage(`우리 반 인원을 ${nextClassSize}명으로 수정했어요.`)
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `반 인원을 저장하지 못했어요. ${error.message}`
          : '반 인원을 저장하지 못했어요.',
      )
    } finally {
      setIsClassSizeSaving(false)
    }
  }

  const openBackupDialog = () => {
    setBackupPassword('')
    setBackupPasswordConfirm('')
    setRestorePassword('')
    setRestoreFile(null)
    setBackupDialogOpen(true)
  }

  const recordBackupCompletion = async () => {
    const completedAt = new Date().toISOString()
    await saveAppSettings({
      onboardingCompleted: true,
      classSize,
      lastBackupAt: completedAt,
    })
    return completedAt
  }

  const handleCreateBackup = async () => {
    if (isBackupBusy) {
      return
    }

    if (backupPassword.length < 6) {
      setStatusMessage('백업 비밀번호는 6자 이상으로 입력해 주세요.')
      return
    }

    if (backupPassword !== backupPasswordConfirm) {
      setStatusMessage('백업 비밀번호 두 개가 서로 달라요.')
      return
    }

    setIsBackupBusy(true)
    setStatusMessage('대표사진과 얼굴 학습 정보를 안전하게 암호화하고 있어요.')

    try {
      const settings: BackupAppSettings = {
        id: SETTINGS_ID,
        onboardingCompleted: true,
        classSize,
        lastBackupAt,
        updatedAt: new Date().toISOString(),
      }
      const backupFile = await createEncryptedBackupFile(
        {
          format: 'giving-tree-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          children,
          faceProfiles: Object.values(faceProfiles),
          settings,
        },
        backupPassword,
      )
      const sharePayload = {
        files: [backupFile],
        title: 'Giving Tree 암호화 백업',
        text: '이 파일을 iCloud Drive에 안전하게 보관해 주세요.',
      }

      if (navigator.canShare?.(sharePayload)) {
        await navigator.share(sharePayload)
      } else {
        const downloadUrl = URL.createObjectURL(backupFile)
        const anchor = document.createElement('a')
        anchor.href = downloadUrl
        anchor.download = backupFile.name
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      }

      const completedAt = await recordBackupCompletion()
      setBackupPassword('')
      setBackupPasswordConfirm('')
      setStatusMessage(
        `암호화 백업을 만들었어요. ${new Date(completedAt).toLocaleString('ko-KR')} · iCloud Drive에 저장했는지 확인해 주세요.`,
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatusMessage('백업 파일 저장을 취소했어요.')
      } else {
        setStatusMessage(
          error instanceof Error
            ? `백업 파일을 만들지 못했어요. ${error.message}`
            : '백업 파일을 만들지 못했어요.',
        )
      }
    } finally {
      setIsBackupBusy(false)
    }
  }

  const handleSelectRestoreFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setRestoreFile(file)
    setStatusMessage(file ? `${file.name} 파일을 선택했어요.` : '')
    event.target.value = ''
  }

  const handleRestoreBackup = async () => {
    if (isBackupBusy) {
      return
    }

    if (!restoreFile) {
      setStatusMessage('복원할 Giving Tree 백업 파일을 먼저 선택해 주세요.')
      return
    }

    if (!restorePassword) {
      setStatusMessage('백업할 때 사용한 비밀번호를 입력해 주세요.')
      return
    }

    const confirmed = window.confirm(
      `현재 아이 정보와 얼굴 학습 데이터를 백업 파일 내용으로 바꿀까요?\n\n` +
        '현재 데이터가 필요하다면 먼저 새 백업을 만들어 주세요.',
    )

    if (!confirmed) {
      return
    }

    setIsBackupBusy(true)
    setStatusMessage('백업 비밀번호를 확인하고 데이터를 복원하고 있어요.')

    try {
      const backup = await readEncryptedBackupFile(restoreFile, restorePassword)
      const database = await openChildrenDB()
      const transaction = database.transaction(
        [CHILDREN_STORE_NAME, FACE_PROFILES_STORE_NAME, SETTINGS_STORE_NAME],
        'readwrite',
      )
      const childrenStore = transaction.objectStore(CHILDREN_STORE_NAME)
      const profilesStore = transaction.objectStore(FACE_PROFILES_STORE_NAME)
      const settingsStore = transaction.objectStore(SETTINGS_STORE_NAME)

      const restoreOperations = [
        childrenStore.clear(),
        profilesStore.clear(),
        settingsStore.clear(),
        ...backup.children.map((child) => childrenStore.put(child)),
        ...backup.faceProfiles.map((profile) => profilesStore.put(profile)),
        settingsStore.put({
          ...backup.settings,
          id: SETTINGS_ID,
          onboardingCompleted: true,
          updatedAt: new Date().toISOString(),
        } satisfies BackupAppSettings),
      ]
      await Promise.all(restoreOperations)
      await transaction.done

      handleClearClassification()
      clearDraftPreview()
      setBackupDialogOpen(false)
      setRestorePassword('')
      setRestoreFile(null)
      await loadChildren()
      setStatusMessage(
        `백업 복원이 완료됐어요. 아이 ${backup.children.length}명의 정보를 불러왔어요.`,
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `백업을 복원하지 못했어요. ${error.message}`
          : '백업을 복원하지 못했어요.',
      )
    } finally {
      setIsBackupBusy(false)
    }
  }

  const handlePrepareProfiles = async (targetChildren: ChildRecord[]) => {
    if (targetChildren.length === 0 || isPreparingProfiles || isAnalyzing) {
      return
    }

    const totalPhotoCount = targetChildren.reduce(
      (total, child) => total + child.photoFiles.length,
      0,
    )
    let completedPhotoCount = 0
    let preparedChildCount = 0

    setIsPreparingProfiles(true)
    setFaceAnalyses({})
    setExcludedChildPhotos({})
    setShareReceipts({})
    setPendingLearning(null)
    setLearningConflict(null)
    setAnalysisProgress({ completed: 0, total: 0 })
    setProfileProgress({
      label: '얼굴 인식 모델을 준비하고 있어요.',
      completed: 0,
      total: totalPhotoCount,
    })
    setStatusMessage('대표사진은 이 기기 안에서만 분석됩니다. 잠시 기다려 주세요.')

    try {
      const database = await openChildrenDB()

      for (const child of targetChildren) {
        const representativeEmbeddings: number[][] = []
        const learnedEmbeddings = faceProfiles[child.id]?.learnedEmbeddings ?? []
        const learnedSamples = faceProfiles[child.id]?.learnedSamples
        let skippedPhotoCount = 0

        for (const photoFile of child.photoFiles) {
          setProfileProgress({
            label: `${child.name} 대표사진 분석 중`,
            completed: completedPhotoCount,
            total: totalPhotoCount,
          })

          try {
            const analysis = await analyzeFacesInFile(photoFile)
            const onlyFace = analysis.faces.length === 1 ? analysis.faces[0] : undefined

            if (onlyFace?.embedding && onlyFace.embedding.length > 0) {
              representativeEmbeddings.push(onlyFace.embedding)
            } else {
              skippedPhotoCount += 1
            }
          } catch {
            skippedPhotoCount += 1
          }

          completedPhotoCount += 1
          setProfileProgress({
            label: `${child.name} 대표사진 분석 중`,
            completed: completedPhotoCount,
            total: totalPhotoCount,
          })
        }

        if (representativeEmbeddings.length > 0 || learnedEmbeddings.length > 0) {
          const profile: FaceProfileRecord = {
            childId: child.id,
            representativeEmbeddings,
            learnedEmbeddings,
            learnedSamples,
            embeddings: [...representativeEmbeddings, ...learnedEmbeddings],
            sourcePhotoCount: child.photoFiles.length,
            skippedPhotoCount,
            updatedAt: new Date().toISOString(),
          }

          await database.put(FACE_PROFILES_STORE_NAME, profile)
          setFaceProfiles((previousProfiles) => ({
            ...previousProfiles,
            [child.id]: profile,
          }))
          preparedChildCount += 1
        } else {
          await database.delete(FACE_PROFILES_STORE_NAME, child.id)
          setFaceProfiles((previousProfiles) => {
            const nextProfiles = { ...previousProfiles }
            delete nextProfiles[child.id]
            return nextProfiles
          })
        }
      }

      setStatusMessage(
        `${targetChildren.length}명 중 ${preparedChildCount}명의 AI 얼굴 준비가 완료됐어요. ` +
          '건너뛴 사진은 얼굴이 없거나 여러 명이 나온 사진이에요.',
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `AI 얼굴 준비를 완료하지 못했어요. ${error.message}`
          : 'AI 얼굴 준비를 완료하지 못했어요.',
      )
    } finally {
      setIsPreparingProfiles(false)
    }
  }

  const handleSelectClassification = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) {
      return
    }

    const uniqueFiles = files.filter((file) => {
      return !selectedFiles.some(
        (existingFile) =>
          existingFile.name === file.name &&
          existingFile.size === file.size &&
          existingFile.lastModified === file.lastModified,
      )
    })

    if (uniqueFiles.length === 0) {
      setStatusMessage('이미 선택한 사진이에요. 다른 사진을 골라주세요.')
      event.target.value = ''
      return
    }

    const nextPreviewItems = uniqueFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}-${createPreviewId()}`,
      file,
      url: createObjectUrl(file),
    }))

    setSelectedFiles((previousFiles) => [...previousFiles, ...uniqueFiles])
    setPreviewItems((previousItems) => [...previousItems, ...nextPreviewItems])
    setFaceAnalyses({})
    setLearningSelections({})
    setExcludedChildPhotos({})
    setShareReceipts({})
    setPendingLearning(null)
    setLearningConflict(null)
    setAnalysisProgress({ completed: 0, total: 0 })
    setStatusMessage(`${uniqueFiles.length}장의 사진을 추가했어요.`)
    event.target.value = ''
  }

  const handleClearClassification = () => {
    setLightboxPhoto(null)
    previewItems.forEach(({ url }) => revokeObjectUrl(url))
    previewItemsRef.current = []
    setPreviewItems([])
    setSelectedFiles([])
    setFaceAnalyses({})
    setLearningSelections({})
    setExcludedChildPhotos({})
    setShareReceipts({})
    setPendingLearning(null)
    setLearningConflict(null)
    setAnalysisProgress({ completed: 0, total: 0 })
    setStatusMessage('선택한 사진을 모두 비웠어요.')
  }

  const handleRemoveClassificationItem = (itemId: string) => {
    setLightboxPhoto(null)
    const targetItem = previewItems.find((item) => item.id === itemId)
    if (targetItem) {
      revokeObjectUrl(targetItem.url)
    }

    setPreviewItems((previousItems) => previousItems.filter((item) => item.id !== itemId))
    setSelectedFiles((previousFiles) =>
      previousFiles.filter((file) => {
        const matchingItem = previewItems.find((item) => item.id === itemId)
        return matchingItem?.file !== file
      }),
    )
    setFaceAnalyses((previousAnalyses) => {
      const nextAnalyses = { ...previousAnalyses }
      delete nextAnalyses[itemId]
      return nextAnalyses
    })
    setLearningSelections((previousSelections) =>
      Object.fromEntries(
        Object.entries(previousSelections).filter(([key]) => !key.startsWith(`${itemId}:`)),
      ),
    )
    setExcludedChildPhotos((previousExclusions) =>
      Object.fromEntries(
        Object.entries(previousExclusions).filter(
          ([key]) => !key.endsWith(`::${itemId}`),
        ),
      ),
    )
    setShareReceipts({})
    setPendingLearning(null)
    setLearningConflict(null)
    setStatusMessage('선택한 사진을 삭제했어요.')
  }

  const handleAnalyzeFaces = async () => {
    if (previewItems.length === 0 || isAnalyzing || isPreparingProfiles) {
      return
    }

    const itemsToAnalyze = [...previewItems]
    const profilesToUse = Object.values(faceProfiles)
    const nextAnalyses: Record<string, FaceAnalysis> = {}
    let failedCount = 0

    setIsAnalyzing(true)
    setFaceAnalyses({})
    setLearningSelections({})
    setExcludedChildPhotos({})
    setShareReceipts({})
    setPendingLearning(null)
    setLearningConflict(null)
    setAnalysisProgress({ completed: 0, total: itemsToAnalyze.length })
    setStatusMessage(
      profilesToUse.length > 0
        ? '얼굴을 찾고 등록된 아이와 비교하고 있어요.'
        : '준비된 아이 얼굴이 없어 얼굴 위치만 찾습니다. 아이 등록 탭에서 AI 얼굴 준비를 해주세요.',
    )

    try {
      for (let index = 0; index < itemsToAnalyze.length; index += 1) {
        const item = itemsToAnalyze[index]

        try {
          const detection = await analyzeFacesInFile(item.file)
          nextAnalyses[item.id] = {
            durationMs: detection.durationMs,
            faces: detection.faces.map((face) => ({
              x: face.x,
              y: face.y,
              width: face.width,
              height: face.height,
              score: face.score,
              embedding: face.embedding,
              match: matchFaceEmbedding(face.embedding, profilesToUse),
            })),
          }
        } catch (error) {
          failedCount += 1
          nextAnalyses[item.id] = {
            faces: [],
            durationMs: 0,
            error: error instanceof Error ? error.message : '얼굴을 분석하지 못했어요.',
          }
        }

        setFaceAnalyses({ ...nextAnalyses })
        setAnalysisProgress({ completed: index + 1, total: itemsToAnalyze.length })
      }

      const detectedFaceCount = Object.values(nextAnalyses).reduce(
        (total, analysis) => total + analysis.faces.length,
        0,
      )
      const matchedFaceCount = Object.values(nextAnalyses).reduce(
        (total, analysis) =>
          total + analysis.faces.filter((face) => face.match.status === 'matched').length,
        0,
      )
      const reviewFaceCount = detectedFaceCount - matchedFaceCount

      setStatusMessage(
        failedCount > 0
          ? `${itemsToAnalyze.length}장 중 ${failedCount}장은 분석하지 못했어요. ` +
              `아이 ${matchedFaceCount}명을 분류했고 ${reviewFaceCount}명은 확인이 필요해요.`
          : `${itemsToAnalyze.length}장에서 얼굴 ${detectedFaceCount}개를 찾았어요. ` +
              `아이 ${matchedFaceCount}명을 분류했고 ${reviewFaceCount}명은 확인이 필요해요.`,
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const cancelLearningConfirmation = () => {
    setPendingLearning(null)
    setLearningConflict(null)
    setStatusMessage('추가 학습을 취소했어요.')
  }

  const saveLearnFace = async (itemId: string, faceIndex: number, childId: string) => {
    const child = children.find((candidate) => candidate.id === childId)
    const face = faceAnalyses[itemId]?.faces[faceIndex]
    const faceKey = `${itemId}:${faceIndex}`

    if (!child || !face?.embedding || learningFaceKey) {
      setStatusMessage('학습할 얼굴과 아이를 다시 선택해 주세요.')
      return
    }

    setPendingLearning(null)
    setLearningConflict(null)
    setLearningFaceKey(faceKey)

    try {
      const { profile, added } = addLearnedFaceEmbedding(
        faceProfiles[child.id],
        child.id,
        face.embedding,
        child.photoFiles.length,
        previewItems.find((item) => item.id === itemId)?.file.name,
      )
      const database = await openChildrenDB()
      await database.put(FACE_PROFILES_STORE_NAME, profile)

      const nextProfiles = {
        ...faceProfiles,
        [child.id]: profile,
      }
      const profilesToUse = Object.values(nextProfiles)

      setFaceProfiles(nextProfiles)
      setFaceAnalyses((previousAnalyses) =>
        Object.fromEntries(
          Object.entries(previousAnalyses).map(([analysisItemId, analysis]) => [
            analysisItemId,
            {
              ...analysis,
              faces: analysis.faces.map((analyzedFace, analyzedFaceIndex) => ({
                ...analyzedFace,
                match:
                  analysisItemId === itemId && analyzedFaceIndex === faceIndex
                    ? {
                        status: 'matched',
                        childId: child.id,
                        suggestedChildId: child.id,
                        similarity: 1,
                        secondBestSimilarity: 0,
                      }
                    : matchFaceEmbedding(analyzedFace.embedding, profilesToUse),
              })),
            },
          ]),
        ),
      )
      setLearningSelections((previousSelections) => ({
        ...previousSelections,
        [faceKey]: child.id,
      }))
      setExcludedChildPhotos((previousExclusions) => {
        const nextExclusions = { ...previousExclusions }
        delete nextExclusions[`${child.id}::${itemId}`]
        return nextExclusions
      })
      setShareReceipts({})
      setStatusMessage(
        added
          ? `${child.name} 얼굴을 추가 학습했어요. 현재 사진들도 새 정보로 다시 분류했어요.`
          : `이미 학습된 ${child.name} 얼굴이에요. 이 사진의 분류만 확인했어요.`,
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `추가 학습을 저장하지 못했어요. ${error.message}`
          : '추가 학습을 저장하지 못했어요.',
      )
    } finally {
      setLearningFaceKey(null)
    }
  }

  const handleLearnFace = (itemId: string, faceIndex: number, childId: string) => {
    const child = children.find((candidate) => candidate.id === childId)
    const face = faceAnalyses[itemId]?.faces[faceIndex]
    const faceKey = `${itemId}:${faceIndex}`

    if (!child || !face?.embedding || learningFaceKey) {
      setStatusMessage('학습할 얼굴과 아이를 다시 선택해 주세요.')
      return
    }

    const isSecondConfirmation =
      pendingLearning?.faceKey === faceKey && pendingLearning.childId === childId

    if (!isSecondConfirmation) {
      setPendingLearning({ faceKey, itemId, faceIndex, childId })
      setLearningConflict(null)
      setStatusMessage(
        `${child.name} 얼굴로 학습하려면 8초 안에 ‘한 번 더 눌러 학습 확정’을 눌러주세요.`,
      )
      return
    }

    const conflict = findSimilarOtherChild(
      face.embedding,
      Object.values(faceProfiles),
      child.id,
    )

    if (conflict) {
      setLearningConflict({
        faceKey,
        itemId,
        faceIndex,
        childId,
        otherChildId: conflict.childId,
        similarity: conflict.similarity,
      })
      setStatusMessage(
        `${childNamesById[conflict.childId] ?? '다른 아이'} 얼굴과 유사합니다. 경고 내용을 확인해 주세요.`,
      )
      return
    }

    void saveLearnFace(itemId, faceIndex, childId)
  }

  const handleConfirmLearningConflict = () => {
    if (!learningConflict) {
      return
    }

    const { itemId, faceIndex, childId } = learningConflict
    void saveLearnFace(itemId, faceIndex, childId)
  }

  const shareFiles = async (
    files: File[],
    title: string,
    text: string,
    successMessage: string,
    receiptKey: string,
  ) => {
    if (files.length === 0) {
      return
    }

    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !('share' in navigator) ||
      !('canShare' in navigator)
    ) {
      setStatusMessage('이 브라우저에서는 사진 공유를 지원하지 않아요. 다른 기기나 브라우저를 이용해 주세요.')
      return
    }

    const sharePayload = {
      files,
      title,
      text,
    }

    try {
      if (navigator.canShare?.(sharePayload)) {
        await navigator.share(sharePayload)
        setShareReceipts((previousReceipts) => ({
          ...previousReceipts,
          [receiptKey]: {
            count: files.length,
            completedAt: new Date().toISOString(),
          },
        }))
        setStatusMessage(successMessage)
      } else {
        setStatusMessage('이 기기에서는 사진 파일 공유가 지원되지 않아요. 사진을 직접 저장한 뒤 보내주세요.')
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStatusMessage('공유를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    }
  }

  const handleShare = async () => {
    await shareFiles(
      selectedFiles,
      '아이들 사진 정리 테스트',
      '사진을 함께 확인해 보세요.',
      '사진을 공유했어요.',
      'all',
    )
  }

  const handleShareChildPhotos = async (child: ChildRecord, items: PreviewItem[]) => {
    const confirmed = window.confirm(
      `${child.name} 사진 ${items.length}장을 직접 확인했나요?\n\n` +
        'AI 분류는 틀릴 수 있으므로 다른 아이 사진이 포함되지 않았는지 확인한 뒤 보내주세요.',
    )

    if (!confirmed) {
      return
    }

    await shareFiles(
      items.map((item) => item.file),
      `${child.name} 사진`,
      `${child.name} 사진을 확인해 주세요.`,
      `${child.name} 사진을 공유했어요.`,
      child.id,
    )
  }

  const openRepresentativePhotoPicker = (slot: RepresentativePhotoSlot) => {
    activeDraftSlotRef.current = slot
    registerInputRef.current?.click()
  }

  const handleSelectDraftPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const slot = activeDraftSlotRef.current
    activeDraftSlotRef.current = null
    event.target.value = ''

    if (!file || !slot) {
      return
    }

    const duplicateItem = draftPreviewItems.find(
      (item) =>
        item.slot !== slot &&
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified,
    )

    if (duplicateItem) {
      const duplicateSlot = REPRESENTATIVE_PHOTO_SLOTS.find(
        (candidate) => candidate.key === duplicateItem.slot,
      )
      setStatusMessage(
        `이 사진은 이미 ${duplicateSlot?.title ?? '다른 칸'}에 있어요. 각 칸에는 다른 사진을 선택해 주세요.`,
      )
      return
    }

    const previousItem = draftPreviewItems.find((item) => item.slot === slot)
    if (previousItem) {
      revokeObjectUrl(previousItem.url)
    }

    const nextItem: PreviewItem = {
      id: `${file.name}-${file.lastModified}-${file.size}-${createPreviewId()}`,
      file,
      url: createObjectUrl(file),
      slot,
    }
    const slotTitle =
      REPRESENTATIVE_PHOTO_SLOTS.find((candidate) => candidate.key === slot)?.title ??
      '대표사진'

    setDraftPreviewItems((previousItems) => {
      const nextItems = [
        ...previousItems.filter((item) => item.slot !== slot),
        nextItem,
      ]
      draftPreviewItemsRef.current = nextItems
      return nextItems
    })
    setDraftPhotoAssessments((previousAssessments) => ({
      ...previousAssessments,
      [slot]: {
        status: 'checking',
        score: 0,
        faceCount: 0,
        brightness: 0,
        sharpness: 0,
        issues: [],
      },
    }))
    setStatusMessage(`${slotTitle} 사진의 얼굴과 선명도를 확인하고 있어요.`)

    try {
      const assessment = await assessRepresentativePhoto(file, slot)
      if (
        !draftPreviewItemsRef.current.some(
          (currentItem) => currentItem.id === nextItem.id,
        )
      ) {
        return
      }
      setDraftPhotoAssessments((previousAssessments) => ({
        ...previousAssessments,
        [slot]: assessment,
      }))
      setStatusMessage(
        assessment.status === 'good'
          ? `${slotTitle} 사진이 좋아요.`
          : assessment.status === 'warning'
            ? `${slotTitle} 사진을 사용할 수 있지만 더 좋은 사진을 권장해요.`
            : `${slotTitle} 사진을 다시 선택해 주세요.`,
      )
    } catch (error) {
      if (
        !draftPreviewItemsRef.current.some(
          (currentItem) => currentItem.id === nextItem.id,
        )
      ) {
        return
      }
      setDraftPhotoAssessments((previousAssessments) => ({
        ...previousAssessments,
        [slot]: {
          status: 'error',
          score: 0,
          faceCount: 0,
          brightness: 0,
          sharpness: 0,
          issues: [
            error instanceof Error
              ? error.message
              : '사진을 확인하지 못했어요. 다른 사진을 선택해 주세요.',
          ],
        },
      }))
      setStatusMessage(`${slotTitle} 사진을 확인하지 못했어요. 다른 사진을 선택해 주세요.`)
    }
  }

  const handleRemoveDraftItem = (itemId: string) => {
    setLightboxPhoto(null)
    const targetItem = draftPreviewItems.find((item) => item.id === itemId)
    if (targetItem) {
      revokeObjectUrl(targetItem.url)
      if (targetItem.slot) {
        setDraftPhotoAssessments((previousAssessments) => {
          const nextAssessments = { ...previousAssessments }
          delete nextAssessments[targetItem.slot as RepresentativePhotoSlot]
          return nextAssessments
        })
      }
    }

    setDraftPreviewItems((previousItems) => {
      const nextItems = previousItems.filter((item) => item.id !== itemId)
      draftPreviewItemsRef.current = nextItems
      return nextItems
    })
    setStatusMessage('선택한 대표사진을 삭제했어요.')
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isPreparingProfiles) {
      return
    }

    const trimmedName = childName.trim()
    if (!trimmedName) {
      setStatusMessage('아이 이름을 입력해 주세요.')
      return
    }

    const orderedDraftItems = REPRESENTATIVE_PHOTO_SLOTS.map((slot) =>
      draftPreviewItems.find((item) => item.slot === slot.key),
    )
    const missingSlots = REPRESENTATIVE_PHOTO_SLOTS.filter(
      (_, index) => !orderedDraftItems[index],
    )

    if (missingSlots.length > 0) {
      setStatusMessage(
        `대표사진 6장을 모두 채워주세요. 남은 칸: ${missingSlots.map((slot) => slot.title).join(', ')}`,
      )
      return
    }

    const checkingSlot = REPRESENTATIVE_PHOTO_SLOTS.find(
      (slot) => draftPhotoAssessments[slot.key]?.status === 'checking',
    )
    if (checkingSlot) {
      setStatusMessage(`${checkingSlot.title} 사진 확인이 끝날 때까지 잠시 기다려 주세요.`)
      return
    }

    const failedSlots = REPRESENTATIVE_PHOTO_SLOTS.filter(
      (slot) => draftPhotoAssessments[slot.key]?.status === 'error',
    )
    if (failedSlots.length > 0) {
      setStatusMessage(
        `다시 선택해야 하는 사진이 있어요: ${failedSlots.map((slot) => slot.title).join(', ')}`,
      )
      return
    }

    const warningSlots = REPRESENTATIVE_PHOTO_SLOTS.filter(
      (slot) => draftPhotoAssessments[slot.key]?.status === 'warning',
    )
    if (
      warningSlots.length > 0 &&
      !window.confirm(
        `${warningSlots.map((slot) => slot.title).join(', ')} 사진은 선명도나 밝기 개선을 권장해요.\n\n그래도 이 사진으로 저장할까요?`,
      )
    ) {
      return
    }

    setIsSaving(true)

    try {
      const database = await openChildrenDB()
      const now = new Date().toISOString()
      const completeDraftItems = orderedDraftItems.filter(
        (item): item is PreviewItem => Boolean(item),
      )
      const payload: ChildRecord = {
        id: editingChildId ?? `child-${createPreviewId()}`,
        name: trimmedName,
        photoFiles: completeDraftItems.map((item) => item.file),
        photoSlotOrder: REPRESENTATIVE_PHOTO_SLOTS.map((slot) => slot.key),
        createdAt: editingChildId
          ? children.find((child) => child.id === editingChildId)?.createdAt ?? now
          : now,
        updatedAt: now,
      }

      await database.put(CHILDREN_STORE_NAME, payload)
      const learnedEmbeddings = faceProfiles[payload.id]?.learnedEmbeddings ?? []
      const learnedSamples = faceProfiles[payload.id]?.learnedSamples
      if (editingChildId && learnedEmbeddings.length > 0) {
        await database.put(FACE_PROFILES_STORE_NAME, {
          childId: payload.id,
          representativeEmbeddings: [],
          learnedEmbeddings,
          learnedSamples,
          embeddings: learnedEmbeddings,
          sourcePhotoCount: payload.photoFiles.length,
          skippedPhotoCount: 0,
          updatedAt: now,
        } satisfies FaceProfileRecord)
      } else {
        await database.delete(FACE_PROFILES_STORE_NAME, payload.id)
      }
      setFaceAnalyses({})
      setExcludedChildPhotos({})
      setShareReceipts({})
      setPendingLearning(null)
      setLearningConflict(null)
      await loadChildren()
      setChildName('')
      clearDraftPreview()
      setEditingChildId(null)
      setStatusMessage(
        editingChildId
          ? '아이 정보를 수정했어요. 변경된 대표사진으로 AI 얼굴 준비를 다시 해주세요.'
          : '아이를 등록했어요. 목록에서 AI 얼굴 준비를 눌러주세요.',
      )
    } catch (error) {
      if (error instanceof Error) {
        setStatusMessage(`저장하지 못했어요. ${error.message}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditChild = (child: ChildRecord) => {
    clearDraftPreview()
    setEditingChildId(child.id)
    setChildName(child.name)
    const nextDraftItems = child.photoFiles
      .slice(0, REQUIRED_REPRESENTATIVE_PHOTOS)
      .map((file, index) => {
        const savedSlot = child.photoSlotOrder?.[index]
        const slot =
          savedSlot &&
          REPRESENTATIVE_PHOTO_SLOTS.some((candidate) => candidate.key === savedSlot)
            ? savedSlot
            : REPRESENTATIVE_PHOTO_SLOTS[index]?.key

        return {
          id: `${file.name}-${file.lastModified}-${file.size}-${createPreviewId()}`,
          file,
          url: createObjectUrl(file),
          slot,
        }
      })
      .filter(
        (
          item,
        ): item is PreviewItem & { slot: RepresentativePhotoSlot } =>
          Boolean(item.slot),
      )
    setDraftPreviewItems(nextDraftItems)
    draftPreviewItemsRef.current = nextDraftItems
    setDraftPhotoAssessments({})
    setActiveTab('register')
    setStatusMessage(
      child.photoFiles.length < REQUIRED_REPRESENTATIVE_PHOTOS
        ? `${child.name}의 기존 사진을 불러왔어요. 새 기준에 맞게 빈 사진 칸을 채워주세요.`
        : `${child.name} 정보를 수정할 수 있어요. 기존 사진은 그대로 유지됩니다.`,
    )
  }

  const handleDeleteChild = async (child: ChildRecord) => {
    if (isPreparingProfiles) {
      return
    }

    const confirmed = window.confirm(`${child.name} 정보를 정말 삭제할까요?`)
    if (!confirmed) {
      return
    }

    try {
      const database = await openChildrenDB()
      const transaction = database.transaction(
        [CHILDREN_STORE_NAME, FACE_PROFILES_STORE_NAME],
        'readwrite',
      )
      await Promise.all([
        transaction.objectStore(CHILDREN_STORE_NAME).delete(child.id),
        transaction.objectStore(FACE_PROFILES_STORE_NAME).delete(child.id),
        transaction.done,
      ])
      const childImageUrl = childImageUrlsRef.current[child.id]
      if (childImageUrl) {
        revokeObjectUrl(childImageUrl)
      }
      delete childImageUrlsRef.current[child.id]
      setChildren((previousChildren) => previousChildren.filter((item) => item.id !== child.id))
      setChildImageUrls((previousChildImageUrls) => {
        const nextChildImageUrls = { ...previousChildImageUrls }
        delete nextChildImageUrls[child.id]
        return nextChildImageUrls
      })
      setFaceProfiles((previousProfiles) => {
        const nextProfiles = { ...previousProfiles }
        delete nextProfiles[child.id]
        return nextProfiles
      })
      setFaceAnalyses({})
      setExcludedChildPhotos({})
      setShareReceipts({})
      setPendingLearning(null)
      setLearningConflict(null)
      setStatusMessage('아이 정보를 삭제했어요.')
    } catch (error) {
      if (error instanceof Error) {
        setStatusMessage(`삭제하지 못했어요. ${error.message}`)
      }
    }
  }

  const handleRemoveLearning = async (child: ChildRecord, learningIndex: number) => {
    if (isAnalyzing || isPreparingProfiles || learningFaceKey) {
      setStatusMessage('진행 중인 분석이나 학습이 끝난 뒤 학습 기록을 삭제해 주세요.')
      return
    }

    const currentProfile = faceProfiles[child.id]
    const learnedEmbeddings = currentProfile?.learnedEmbeddings ?? []

    if (
      !currentProfile ||
      learnedEmbeddings.length === 0 ||
      learningIndex < 0 ||
      learningIndex >= learnedEmbeddings.length
    ) {
      setStatusMessage(`${child.name}에게 삭제할 추가 학습 기록이 없어요.`)
      return
    }

    const confirmed = window.confirm(
      `${child.name}의 추가 학습 ${learningIndex + 1}번을 삭제할까요?\n\n` +
        '대표사진 6장으로 준비한 얼굴 정보는 그대로 유지됩니다.',
    )

    if (!confirmed) {
      return
    }

    try {
      const representativeEmbeddings =
        currentProfile.representativeEmbeddings ??
        currentProfile.embeddings.slice(
          0,
          Math.max(0, currentProfile.embeddings.length - learnedEmbeddings.length),
        )
      const nextLearnedEmbeddings = learnedEmbeddings.filter(
        (_, index) => index !== learningIndex,
      )
      const nextLearnedSamples = currentProfile.learnedSamples?.filter(
        (_, index) => index !== learningIndex,
      )
      const nextEmbeddings = [...representativeEmbeddings, ...nextLearnedEmbeddings]
      const database = await openChildrenDB()
      const nextProfiles = { ...faceProfiles }

      if (nextEmbeddings.length > 0) {
        const nextProfile: FaceProfileRecord = {
          ...currentProfile,
          representativeEmbeddings,
          learnedEmbeddings: nextLearnedEmbeddings,
          learnedSamples: nextLearnedSamples,
          embeddings: nextEmbeddings,
          updatedAt: new Date().toISOString(),
        }
        await database.put(FACE_PROFILES_STORE_NAME, nextProfile)
        nextProfiles[child.id] = nextProfile
      } else {
        await database.delete(FACE_PROFILES_STORE_NAME, child.id)
        delete nextProfiles[child.id]
      }

      const profilesToUse = Object.values(nextProfiles)
      setFaceProfiles(nextProfiles)
      setFaceAnalyses((previousAnalyses) =>
        Object.fromEntries(
          Object.entries(previousAnalyses).map(([itemId, analysis]) => [
            itemId,
            {
              ...analysis,
              faces: analysis.faces.map((face) => ({
                ...face,
                match: matchFaceEmbedding(face.embedding, profilesToUse),
              })),
            },
          ]),
        ),
      )
      setExcludedChildPhotos({})
      setShareReceipts({})
      setPendingLearning(null)
      setLearningConflict(null)
      if (nextLearnedEmbeddings.length === 0) {
        setLearningHistoryChildId(null)
      }
      setStatusMessage(
        `${child.name}의 추가 학습 ${learningIndex + 1}번을 삭제하고 현재 사진을 다시 분류했어요.`,
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `학습 기록을 삭제하지 못했어요. ${error.message}`
          : '학습 기록을 삭제하지 못했어요.',
      )
    }
  }

  const handleExcludeChildPhoto = (child: ChildRecord, item: PreviewItem) => {
    setExcludedChildPhotos((previousExclusions) => ({
      ...previousExclusions,
      [`${child.id}::${item.id}`]: true,
    }))
    setShareReceipts((previousReceipts) => {
      const nextReceipts = { ...previousReceipts }
      delete nextReceipts[child.id]
      return nextReceipts
    })
    setStatusMessage(
      `${item.file.name} 사진을 ${child.name} 공유 목록에서 제외했어요. 원본 사진은 삭제되지 않았어요.`,
    )
  }

  const handleRestoreChildPhotos = (child: ChildRecord) => {
    setExcludedChildPhotos((previousExclusions) =>
      Object.fromEntries(
        Object.entries(previousExclusions).filter(
          ([key]) => !key.startsWith(`${child.id}::`),
        ),
      ),
    )
    setShareReceipts((previousReceipts) => {
      const nextReceipts = { ...previousReceipts }
      delete nextReceipts[child.id]
      return nextReceipts
    })
    setStatusMessage(`${child.name} 목록에서 제외했던 사진을 다시 포함했어요.`)
  }

  const childNamesById = Object.fromEntries(children.map((child) => [child.id, child.name]))
  const preparedChildCount = children.filter((child) => faceProfiles[child.id]).length
  const groupedChildResults = children
    .map((child) => {
      const allItems = previewItems.filter((item) =>
        faceAnalyses[item.id]?.faces.some((face) => face.match.childId === child.id),
      )
      const items = allItems.filter(
        (item) => !excludedChildPhotos[`${child.id}::${item.id}`],
      )

      return {
        child,
        items,
        excludedCount: allItems.length - items.length,
      }
    })
    .filter((group) => group.items.length > 0 || group.excludedCount > 0)
  const reviewItems = previewItems.filter((item) => {
    const analysis = faceAnalyses[item.id]
    return Boolean(
      analysis && !analysis.faces.some((face) => face.match.status === 'matched'),
    )
  })
  const confirmedPhotoCount = previewItems.filter((item) =>
    faceAnalyses[item.id]?.faces.some((face) => face.match.status === 'matched'),
  ).length
  const unconfirmedPhotoCount = previewItems.length - confirmedPhotoCount
  const analyzedItemCount = Object.keys(faceAnalyses).length
  const classProgress = Math.min(100, (children.length / Math.max(1, classSize)) * 100)
  const learningHistoryChild = learningHistoryChildId
    ? children.find((child) => child.id === learningHistoryChildId)
    : undefined
  const learningHistoryProfile = learningHistoryChild
    ? faceProfiles[learningHistoryChild.id]
    : undefined
  const learningHistoryItems = (learningHistoryProfile?.learnedEmbeddings ?? []).map(
    (_, index) => ({
      index,
      sample: learningHistoryProfile?.learnedSamples?.[index],
    }),
  )

  if (!settingsLoaded) {
    return (
      <main className="app-loading-screen" aria-live="polite">
        <div className="loading-tree">
          <GivingTreeMark />
        </div>
        <p>Giving Tree를 준비하고 있어요…</p>
      </main>
    )
  }

  return (
    <main className="photo-sorter-app">
      <section className="shell">
        <header className="compact-brand-header">
          <div className="compact-brand-mark">
            <GivingTreeMark />
          </div>
          <h1>Giving Tree</h1>
        </header>

        <nav className="tab-list" aria-label="기능 탭">
          <button
            type="button"
            className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <span aria-hidden="true">🌱</span> 아이 등록
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'classify' ? 'active' : ''}`}
            onClick={() => setActiveTab('classify')}
          >
            <span aria-hidden="true">🍃</span> 사진 분류
          </button>
        </nav>

        <section className="utility-bar" aria-label="반 현황과 앱 관리">
          <div className="class-progress-summary">
            <div className="class-progress-heading">
              <span className="class-leaf-badge" aria-hidden="true">🌿</span>
              <div className="class-progress-copy">
                <span>우리 반 성장 현황</span>
                <strong>
                  {children.length} / {classSize}명
                </strong>
              </div>
            </div>
            <div className="class-progress-track" aria-hidden="true">
              <span style={{ width: `${classProgress}%` }} />
            </div>
            <button
              type="button"
              className="class-size-edit-button"
              onClick={openClassSettings}
            >
              반 인원 수정
            </button>
          </div>
          <div className="utility-actions">
            <button type="button" onClick={openBackupDialog}>
              <span aria-hidden="true">↓</span>
              <strong>백업</strong>
            </button>
            <button type="button" onClick={openOnboardingGuide}>
              <span aria-hidden="true">?</span>
              <strong>사용 안내</strong>
            </button>
          </div>
        </section>

        {activeTab === 'register' ? (
          <section className="register-section">
            <form className="controls-card register-card" onSubmit={handleRegister}>
              <div className="form-copy">
                <h2>아이 등록</h2>
                <p>아이 이름과 대표사진을 등록해 두면 나중에 다시 확인하기 쉬워요.</p>
              </div>

              <label className="field-label" htmlFor="child-name">
                아이 이름
              </label>
              <input
                id="child-name"
                className="name-input"
                value={childName}
                onChange={(event) => setChildName(event.target.value)}
                placeholder="예: 민서"
                maxLength={20}
              />

              <input
                ref={registerInputRef}
                type="file"
                accept="image/*"
                onChange={handleSelectDraftPhotos}
                hidden
              />

              <div className="representative-photo-heading">
                <div>
                  <h3>AI 대표사진 6장</h3>
                  <p>한 아이만 나오고 얼굴이 선명한 사진을 각 칸에 넣어주세요.</p>
                </div>
                <div className="representative-photo-count" aria-live="polite">
                  <strong>{draftPreviewItems.length}</strong>
                  <span>/ {REQUIRED_REPRESENTATIVE_PHOTOS}</span>
                </div>
              </div>

              <div className="representative-slot-grid" aria-live="polite">
                {REPRESENTATIVE_PHOTO_SLOTS.map((slot) => {
                  const item = draftPreviewItems.find(
                    (candidate) => candidate.slot === slot.key,
                  )
                  const assessment = draftPhotoAssessments[slot.key]
                  const qualityLabel =
                    assessment?.status === 'checking'
                      ? '확인 중'
                      : assessment?.status === 'good'
                        ? '좋음'
                        : assessment?.status === 'warning'
                          ? '확인 권장'
                          : assessment?.status === 'error'
                            ? '다시 선택'
                            : item
                              ? '기존 사진'
                              : '필수'

                  return (
                    <article
                      className={`representative-photo-slot ${
                        item ? 'slot-filled' : 'slot-empty'
                      } ${assessment ? `slot-${assessment.status}` : ''}`}
                      key={slot.key}
                    >
                      <header>
                        <span className="representative-slot-icon" aria-hidden="true">
                          {slot.icon}
                        </span>
                        <div>
                          <h4>{slot.title}</h4>
                          <p>{slot.guide}</p>
                        </div>
                        <span className="slot-quality-badge">{qualityLabel}</span>
                      </header>

                      {item ? (
                        <>
                          <button
                            type="button"
                            className="representative-photo-preview"
                            onClick={() =>
                              setLightboxPhoto({
                                src: item.url,
                                alt: `${slot.title} 대표사진`,
                              })
                            }
                            aria-label={`${slot.title} 대표사진 크게 보기`}
                          >
                            <img src={item.url} alt={`${slot.title} 대표사진`} />
                            <span>눌러서 확대</span>
                          </button>
                          {assessment?.status === 'checking' ? (
                            <p className="slot-assessment-message">
                              얼굴과 사진 품질을 확인하고 있어요…
                            </p>
                          ) : assessment?.issues.length ? (
                            <p className="slot-assessment-message">
                              {assessment.issues[0]}
                            </p>
                          ) : assessment?.status === 'good' ? (
                            <p className="slot-assessment-message">
                              얼굴 1명 · 밝기와 선명도가 좋아요.
                            </p>
                          ) : (
                            <p className="slot-assessment-message">
                              저장된 기존 사진이에요. 교체하면 자동으로 품질을 확인해요.
                            </p>
                          )}
                          <div className="representative-slot-actions">
                            <button
                              type="button"
                              onClick={() => openRepresentativePhotoPicker(slot.key)}
                              disabled={isPreparingProfiles}
                            >
                              교체
                            </button>
                            <button
                              type="button"
                              className="slot-delete-button"
                              onClick={() => handleRemoveDraftItem(item.id)}
                              disabled={isPreparingProfiles || assessment?.status === 'checking'}
                            >
                              삭제
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="representative-slot-select"
                          onClick={() => openRepresentativePhotoPicker(slot.key)}
                          disabled={isPreparingProfiles}
                        >
                          <span aria-hidden="true">＋</span>
                          사진 넣기
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>

              <div className="representative-photo-footer">
                <p className="helper-text">
                  선택 즉시 얼굴 수·밝기·선명도를 기기 안에서 확인합니다. 사진은 서버에
                  전송되지 않아요.
                </p>
                <button
                  type="button"
                  className="text-reset-button"
                  onClick={clearDraftPreview}
                  disabled={draftPreviewItems.length === 0 || isPreparingProfiles}
                >
                  6장 모두 비우기
                </button>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSaving || isPreparingProfiles}
                >
                  {editingChildId ? '수정 완료' : '아이 등록하기'}
                </button>
                {editingChildId ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      clearDraftPreview()
                      setEditingChildId(null)
                      setChildName('')
                      setStatusMessage('수정이 취소됐어요.')
                    }}
                  >
                    취소
                  </button>
                ) : null}
              </div>
            </form>

            <section className="controls-card child-list-card">
              <div className="profile-toolbar">
                <div className="form-copy">
                  <h2>등록한 아이 목록</h2>
                  <p>
                    반 등록 {children.length}/{classSize}명 · AI 준비 완료 {preparedChildCount}명
                  </p>
                </div>
                <button
                  type="button"
                  className="analysis-button profile-all-button"
                  onClick={() => void handlePrepareProfiles(children)}
                  disabled={children.length === 0 || isPreparingProfiles || isAnalyzing}
                >
                  {isPreparingProfiles ? '얼굴 준비 중…' : '모든 아이 AI 얼굴 준비'}
                </button>
              </div>

              {isPreparingProfiles ? (
                <div className="analysis-progress profile-progress" role="status" aria-live="polite">
                  <span
                    className="analysis-progress-bar"
                    style={{
                      width: `${
                        profileProgress.total > 0
                          ? (profileProgress.completed / profileProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                  <p>
                    {profileProgress.label} · {profileProgress.completed}/{profileProgress.total}장
                  </p>
                </div>
              ) : null}

              {statusMessage ? <p className="status-message">{statusMessage}</p> : null}

              {children.length > 0 ? (
                <div className="child-grid">
                  {children.map((child) => (
                    <article className="child-card" key={child.id}>
                      <div className="child-card-image">
                        {childImageUrls[child.id] ? (
                          <button
                            type="button"
                            className="photo-view-button"
                            onClick={() =>
                              setLightboxPhoto({
                                src: childImageUrls[child.id],
                                alt: `${child.name} 대표사진`,
                              })
                            }
                            aria-label={`${child.name} 대표사진 크게 보기`}
                          >
                            <img src={childImageUrls[child.id]} alt={child.name} />
                            <span className="zoom-badge" aria-hidden="true">
                              확대
                            </span>
                          </button>
                        ) : (
                          <div className="child-placeholder">📷</div>
                        )}
                      </div>
                      <div className="child-card-content">
                        <h3>{child.name}</h3>
                        <p>{new Date(child.createdAt).toLocaleDateString('ko-KR')}</p>
                        <p>
                          대표사진 {Math.min(child.photoFiles.length, REQUIRED_REPRESENTATIVE_PHOTOS)}/
                          {REQUIRED_REPRESENTATIVE_PHOTOS}장
                        </p>
                        {faceProfiles[child.id] ? (
                          <p className="profile-ready">
                            AI 준비 완료 · 얼굴 {faceProfiles[child.id].embeddings.length}개
                            {faceProfiles[child.id].learnedEmbeddings?.length
                              ? ` · 추가 학습 ${
                                  faceProfiles[child.id].learnedEmbeddings?.length ?? 0
                                }개`
                              : ''}
                            {faceProfiles[child.id].skippedPhotoCount > 0
                              ? ` · ${faceProfiles[child.id].skippedPhotoCount}장 건너뜀`
                              : ''}
                          </p>
                        ) : (
                          <p className="profile-needed">AI 얼굴 준비 필요</p>
                        )}
                      </div>
                      <div className="child-card-actions">
                        <button
                          type="button"
                          className="analysis-button"
                          onClick={() => void handlePrepareProfiles([child])}
                          disabled={isPreparingProfiles || isAnalyzing}
                        >
                          {faceProfiles[child.id] ? 'AI 다시 준비' : 'AI 얼굴 준비'}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleEditChild(child)}
                          disabled={isPreparingProfiles}
                        >
                          수정
                        </button>
                        {(faceProfiles[child.id]?.learnedEmbeddings?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            className="learning-undo-button"
                            onClick={() => setLearningHistoryChildId(child.id)}
                            disabled={
                              isAnalyzing || isPreparingProfiles || Boolean(learningFaceKey)
                            }
                          >
                            학습 기록 관리
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => void handleDeleteChild(child)}
                          disabled={isPreparingProfiles}
                        >
                          삭제
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty">
                  <div className="empty-icon" aria-hidden="true">
                    👶
                  </div>
                  <h3>아직 등록한 아이가 없어요</h3>
                  <p>아래 양식으로 아이를 먼저 등록해 주세요.</p>
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="classify-section">
            <section className="controls-card">
              <div className="button-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => classifyInputRef.current?.click()}
                  disabled={isAnalyzing || isPreparingProfiles}
                >
                  사진 선택하기
                </button>
                <button
                  type="button"
                  className="analysis-button"
                  onClick={() => void handleAnalyzeFaces()}
                  disabled={selectedFiles.length === 0 || isAnalyzing || isPreparingProfiles}
                >
                  {isAnalyzing ? '분류 중…' : '얼굴 찾기·아이별 분류'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleClearClassification}
                  disabled={selectedFiles.length === 0 || isAnalyzing || isPreparingProfiles}
                >
                  전체 지우기
                </button>
                <button
                  type="button"
                  className="share-button"
                  onClick={handleShare}
                  disabled={selectedFiles.length === 0 || isAnalyzing || isPreparingProfiles}
                >
                  카카오톡으로 공유
                </button>
              </div>

              <input
                ref={classifyInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleSelectClassification}
                hidden
              />

              <div className="photo-stats" aria-label="사진 분류 현황">
                <div className="photo-stat">
                  <strong>{selectedFiles.length}</strong>
                  <span>업로드된 총 사진</span>
                </div>
                <div className={`photo-stat ${unconfirmedPhotoCount > 0 ? 'warning' : 'complete'}`}>
                  <strong>{unconfirmedPhotoCount}</strong>
                  <span>총 {selectedFiles.length}장 중 확인 안 된 사진</span>
                </div>
              </div>

              <div className="selection-summary">
                <p className="hint">
                  AI 준비 완료 {preparedChildCount}명 · 공유 전에는 분류 결과를 직접 확인해 주세요.
                </p>
              </div>

              {shareReceipts.all ? (
                <p className="share-receipt" role="status">
                  ✓ 전송 완료 · {shareReceipts.all.count}장 ·{' '}
                  {formatReceiptTime(shareReceipts.all.completedAt)}
                </p>
              ) : null}

              {isAnalyzing ? (
                <div className="analysis-progress" role="status" aria-live="polite">
                  <span
                    className="analysis-progress-bar"
                    style={{
                      width: `${analysisProgress.total > 0 ? (analysisProgress.completed / analysisProgress.total) * 100 : 0}%`,
                    }}
                  />
                  <p>
                    {analysisProgress.completed} / {analysisProgress.total}장 분석 중
                  </p>
                </div>
              ) : null}

              {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
            </section>

            <section className="preview-card" aria-live="polite">
              {previewItems.length > 0 ? (
                <div className="preview-grid">
                  {previewItems.map(({ file, url, id }) => {
                    const analysis = faceAnalyses[id]
                    const matchedNames = analysis
                      ? Array.from(
                          new Set(
                            analysis.faces
                              .map((face) =>
                                face.match.childId
                                  ? childNamesById[face.match.childId]
                                  : undefined,
                              )
                              .filter((name): name is string => Boolean(name)),
                          ),
                        )
                      : []
                    const reviewFaceCount =
                      analysis?.faces.filter((face) => face.match.status === 'review').length ?? 0

                    return (
                      <article className="preview-tile" key={id}>
                        <button
                          type="button"
                          className="remove-photo-button"
                          onClick={() => handleRemoveClassificationItem(id)}
                          aria-label={`${file.name} 삭제`}
                          disabled={isAnalyzing || isPreparingProfiles}
                        >
                          ×
                        </button>
                        <div className="analysis-image-frame">
                          <button
                            type="button"
                            className="photo-view-button"
                            onClick={() =>
                              setLightboxPhoto({
                                src: url,
                                alt: file.name,
                                faces: analysis?.faces,
                              })
                            }
                            aria-label={`${file.name} 크게 보기`}
                          >
                            <img src={url} alt={file.name} />
                            <span className="zoom-badge" aria-hidden="true">
                              확대
                            </span>
                          </button>
                          {analysis?.faces.map((face, faceIndex) => {
                            const matchedName = face.match.childId
                              ? childNamesById[face.match.childId]
                              : undefined
                            const suggestedName = face.match.suggestedChildId
                              ? childNamesById[face.match.suggestedChildId]
                              : undefined
                            const label = `${faceIndex + 1} · ${
                              matchedName ??
                              (suggestedName ? `후보 ${suggestedName}` : '확인')
                            }`

                            return (
                              <span
                                className={`face-box ${
                                  matchedName ? 'face-box-matched' : 'face-box-review'
                                }`}
                                key={`${id}-face-${faceIndex}`}
                                title={`${label} · 유사도 ${Math.round(face.match.similarity * 100)}%`}
                                style={{
                                  left: `${face.x * 100}%`,
                                  top: `${face.y * 100}%`,
                                  width: `${face.width * 100}%`,
                                  height: `${face.height * 100}%`,
                                }}
                              >
                                <span>{label}</span>
                              </span>
                            )
                          })}
                        </div>
                        {analysis ? (
                          <div className={`face-result ${analysis.error ? 'failed' : ''}`}>
                            {analysis.error
                              ? '분석 실패'
                              : matchedNames.length > 0 || reviewFaceCount > 0
                                ? `${matchedNames.length > 0 ? `분류: ${matchedNames.join(', ')}` : ''}${
                                    matchedNames.length > 0 && reviewFaceCount > 0 ? ' · ' : ''
                                  }${reviewFaceCount > 0 ? `확인 필요 ${reviewFaceCount}명` : ''}`
                                : '얼굴을 찾지 못했어요'}
                          </div>
                        ) : null}
                        {analysis && analysis.faces.length > 0 && children.length > 0 ? (
                          <div className="face-learning-list">
                            {analysis.faces.map((face, faceIndex) => {
                              const faceKey = `${id}:${faceIndex}`
                              const selectedChildId =
                                learningSelections[faceKey] ?? face.match.childId ?? ''
                              const currentName = face.match.childId
                                ? childNamesById[face.match.childId]
                                : face.match.suggestedChildId
                                  ? `확인 필요 · 후보 ${
                                      childNamesById[face.match.suggestedChildId] ?? '없음'
                                    }`
                                  : '확인 필요'
                              const isPendingLearning =
                                pendingLearning?.faceKey === faceKey &&
                                pendingLearning.childId === selectedChildId
                              const conflictForFace =
                                learningConflict?.faceKey === faceKey
                                  ? learningConflict
                                  : undefined
                              const selectedChildName = selectedChildId
                                ? childNamesById[selectedChildId]
                                : undefined
                              const conflictChildName = conflictForFace
                                ? childNamesById[conflictForFace.otherChildId] ?? '다른 아이'
                                : undefined

                              return (
                                <div className="face-learning-row" key={`${faceKey}:learning`}>
                                  <label htmlFor={`learn-${faceKey}`}>
                                    얼굴 {faceIndex + 1} · 현재 {currentName}
                                  </label>
                                  <select
                                    id={`learn-${faceKey}`}
                                    value={selectedChildId}
                                    onChange={(event) => {
                                      setLearningSelections((previousSelections) => ({
                                        ...previousSelections,
                                        [faceKey]: event.target.value,
                                      }))
                                      setPendingLearning(null)
                                      setLearningConflict(null)
                                    }}
                                    disabled={Boolean(learningFaceKey)}
                                  >
                                    <option value="">아이 선택</option>
                                    {children.map((child) => (
                                      <option value={child.id} key={child.id}>
                                        {child.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className={isPendingLearning ? 'learning-confirm-button' : ''}
                                    onClick={() => handleLearnFace(id, faceIndex, selectedChildId)}
                                    disabled={
                                      !selectedChildId ||
                                      Boolean(learningFaceKey) ||
                                      Boolean(conflictForFace)
                                    }
                                  >
                                    {learningFaceKey === faceKey
                                      ? '학습 중…'
                                      : isPendingLearning
                                        ? '한 번 더 눌러 학습 확정'
                                        : '지정·추가 학습'}
                                  </button>
                                  {isPendingLearning && !conflictForFace ? (
                                    <button
                                      type="button"
                                      className="learning-cancel-button"
                                      onClick={cancelLearningConfirmation}
                                    >
                                      취소
                                    </button>
                                  ) : null}
                                  {conflictForFace ? (
                                    <div className="learning-conflict-warning" role="alert">
                                      <p>
                                        <strong>{conflictChildName}</strong> 아이와 얼굴이{' '}
                                        {Math.round(conflictForFace.similarity * 100)}% 유사합니다.{' '}
                                        <strong>{selectedChildName}</strong> 아이로 추가 학습하는
                                        것이 맞는지 다시 확인해 주세요.
                                      </p>
                                      <div className="learning-conflict-actions">
                                        <button
                                          type="button"
                                          className="conflict-confirm-button"
                                          onClick={handleConfirmLearningConflict}
                                        >
                                          그래도 {selectedChildName}로 학습
                                        </button>
                                        <button
                                          type="button"
                                          className="learning-cancel-button"
                                          onClick={cancelLearningConfirmation}
                                        >
                                          학습 취소
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                        <p>{file.name}</p>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    🖼️
                  </div>
                  <h2>아직 선택한 사진이 없어요</h2>
                  <p>사진을 선택하면 정사각형 미리보기가 여기에 보여집니다.</p>
                </div>
              )}
            </section>

            {analyzedItemCount > 0 ? (
              <section className="classification-results" aria-live="polite">
                <div className="results-heading">
                  <h2>아이별 분류 결과</h2>
                  <p>
                    총 {previewItems.length}장 중 {unconfirmedPhotoCount}장이 확인되지 않았어요.
                    단체사진은 얼굴이 확인된 모든 아이의 목록에 함께 들어갑니다.
                  </p>
                </div>

                {groupedChildResults.length > 0 ? (
                  groupedChildResults.map(({ child, items, excludedCount }) => (
                    <article className="child-result-card" key={child.id}>
                      <div className="child-result-header">
                        <div>
                          <h3>{child.name}</h3>
                          <p>
                            공유할 사진 {items.length}장
                            {excludedCount > 0 ? ` · ${excludedCount}장 제외됨` : ''}
                          </p>
                        </div>
                        <div className="child-result-actions">
                          {excludedCount > 0 ? (
                            <button
                              type="button"
                              className="result-restore-button"
                              onClick={() => handleRestoreChildPhotos(child)}
                            >
                              제외 취소
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="share-button result-share-button"
                            onClick={() => void handleShareChildPhotos(child, items)}
                            disabled={isAnalyzing || items.length === 0}
                          >
                            {child.name} 사진 공유
                          </button>
                        </div>
                      </div>
                      <p className="safety-note">
                        다른 아이 사진이 섞였다면 사진 오른쪽 위의 X를 눌러 이 공유 목록에서만
                        제외하세요.
                      </p>
                      {shareReceipts[child.id] ? (
                        <p className="share-receipt" role="status">
                          ✓ 전송 완료 · {shareReceipts[child.id].count}장 ·{' '}
                          {formatReceiptTime(shareReceipts[child.id].completedAt)}
                        </p>
                      ) : null}
                      <div className="result-photo-grid">
                        {items.map((item) => (
                          <div className="result-photo-item" key={item.id}>
                            <button
                              type="button"
                              className="photo-view-button"
                              onClick={() =>
                                setLightboxPhoto({
                                  src: item.url,
                                  alt: `${child.name} 분류 사진`,
                                })
                              }
                              aria-label={`${child.name} 분류 사진 크게 보기`}
                            >
                              <img src={item.url} alt={`${child.name} 분류 사진`} />
                              <span className="zoom-badge" aria-hidden="true">
                                확대
                              </span>
                            </button>
                            <button
                              type="button"
                              className="result-remove-button"
                              onClick={() => handleExcludeChildPhoto(child, item)}
                              aria-label={`${item.file.name}을 ${child.name} 목록에서 제외`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state compact-empty">
                    <h3>확정된 아이별 사진이 없어요</h3>
                    <p>AI 얼굴 준비를 먼저 하거나 대표사진을 더 선명한 사진으로 바꿔주세요.</p>
                  </div>
                )}

                {reviewItems.length > 0 ? (
                  <article className="review-result-card">
                    <div className="child-result-header">
                      <div>
                        <h3>확인 필요</h3>
                        <p>
                          총 {previewItems.length}장 중 등록된 아이를 한 명도 확정하지 못한
                          사진이 {reviewItems.length}장 있어요.
                        </p>
                      </div>
                    </div>
                    <p className="safety-note">
                      등록된 아이가 확인된 사진은 이 목록에 중복 표시하지 않습니다. 위 사진 카드에서
                      얼굴을 아이에게 지정하면 바로 추가 학습됩니다.
                    </p>
                    <div className="result-photo-grid">
                      {reviewItems.map((item) => (
                        <button
                          type="button"
                          className="photo-view-button review-photo-button"
                          onClick={() =>
                            setLightboxPhoto({
                              src: item.url,
                              alt: '확인 필요한 사진',
                            })
                          }
                          aria-label="확인 필요한 사진 크게 보기"
                          key={item.id}
                        >
                          <img src={item.url} alt="확인 필요한 사진" />
                          <span className="zoom-badge" aria-hidden="true">
                            확대
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                ) : null}
              </section>
            ) : null}
          </section>
        )}
      </section>
      {onboardingStep !== null ? (
        <div className="onboarding-overlay" role="dialog" aria-modal="true">
          <article className="onboarding-card">
            <header className="onboarding-header">
              <div>
                <p>GIVING TREE ADVENTURE</p>
                <span>STEP {onboardingStep + 1} / 4</span>
              </div>
              {onboardingCompleted ? (
                <button
                  type="button"
                  className="onboarding-close-button"
                  onClick={() => setOnboardingStep(null)}
                  aria-label="사용 안내 닫기"
                >
                  ×
                </button>
              ) : null}
            </header>

            <div className="onboarding-progress" aria-hidden="true">
              {[0, 1, 2, 3].map((step) => (
                <span
                  className={step <= onboardingStep ? 'active' : ''}
                  key={`onboarding-progress-${step}`}
                />
              ))}
            </div>

            <div className="onboarding-content">
              {onboardingStep === 0 ? (
                <section className="onboarding-welcome">
                  <div className="onboarding-tree">
                    <GivingTreeMark />
                  </div>
                  <p className="onboarding-kicker">WELCOME TO GIVING TREE</p>
                  <h2>아이들의 오늘을<br />예쁘게 키워볼까요?</h2>
                  <p>
                    사진은 이 아이폰 안에서만 정리돼요. 처음 사용하는 방법을 짧고 쉽게
                    알려드릴게요.
                  </p>
                </section>
              ) : null}

              {onboardingStep === 1 ? (
                <section className="onboarding-guide">
                  <p className="onboarding-kicker">HOW TO PLAY</p>
                  <h2>세 단계면 사진 정리 끝!</h2>
                  <div className="guide-quest-list">
                    <div className="guide-quest">
                      <span>1</span>
                      <div>
                        <strong>아이 등록</strong>
                        <p>정면·좌우·전신·근접 대표사진 6장으로 등록해요.</p>
                      </div>
                    </div>
                    <div className="guide-quest">
                      <span>2</span>
                      <div>
                        <strong>사진 분류</strong>
                        <p>여러 장을 골라 아이별 사진 묶음을 만들어요.</p>
                      </div>
                    </div>
                    <div className="guide-quest">
                      <span>3</span>
                      <div>
                        <strong>확인하고 공유</strong>
                        <p>직접 한 번 확인한 뒤 카카오톡으로 보내요.</p>
                      </div>
                    </div>
                  </div>
                  <div className="privacy-chip">🔒 사진과 얼굴 정보는 서버에 올리지 않아요</div>
                </section>
              ) : null}

              {onboardingStep === 2 ? (
                <section className="onboarding-class-size">
                  <p className="onboarding-kicker">SET YOUR CLASS</p>
                  <h2>우리 반은 몇 명인가요?</h2>
                  <p>등록 진행률과 준비 상태를 보기 쉽게 표시해 드릴게요.</p>
                  <div className="class-size-picker">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftClassSize((current) =>
                          Math.max(MIN_CLASS_SIZE, current - 1),
                        )
                      }
                      disabled={draftClassSize <= MIN_CLASS_SIZE}
                      aria-label="반 인원 한 명 줄이기"
                    >
                      −
                    </button>
                    <label>
                      <input
                        type="number"
                        min={MIN_CLASS_SIZE}
                        max={MAX_CLASS_SIZE}
                        value={draftClassSize}
                        onChange={(event) =>
                          setDraftClassSize(
                            Math.min(
                              MAX_CLASS_SIZE,
                              Math.max(MIN_CLASS_SIZE, Number(event.target.value) || 1),
                            ),
                          )
                        }
                        aria-label="반 인원"
                      />
                      <span>명</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftClassSize((current) =>
                          Math.min(MAX_CLASS_SIZE, current + 1),
                        )
                      }
                      disabled={draftClassSize >= MAX_CLASS_SIZE}
                      aria-label="반 인원 한 명 늘리기"
                    >
                      +
                    </button>
                  </div>
                  <div className="class-size-presets">
                    {[15, 20, 25, 30].map((size) => (
                      <button
                        type="button"
                        className={draftClassSize === size ? 'active' : ''}
                        onClick={() => setDraftClassSize(size)}
                        key={size}
                      >
                        {size}명
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {onboardingStep === 3 ? (
                <section className="onboarding-ready">
                  <div className="ready-badge" aria-hidden="true">✓</div>
                  <p className="onboarding-kicker">READY TO GROW</p>
                  <h2>{draftClassSize}명의<br />Giving Tree가 준비됐어요!</h2>
                  <div className="ready-summary">
                    <span>🌱 아이를 등록하고</span>
                    <span>🍃 사진을 분류한 뒤</span>
                    <span>💚 직접 확인하고 공유해요</span>
                  </div>
                  <p className="ready-backup-note">
                    Safari의 공유 버튼에서 `홈 화면에 추가`를 선택하면 앱처럼 열 수 있어요.
                    중요한 데이터는 `백업·복원`에서 iCloud Drive에 보관해 주세요.
                  </p>
                </section>
              ) : null}
            </div>

            {statusMessage && onboardingStep === 3 ? (
              <p className="modal-status-message">{statusMessage}</p>
            ) : null}

            <footer className="onboarding-actions">
              {onboardingStep > 0 ? (
                <button
                  type="button"
                  className="onboarding-back-button"
                  onClick={() => setOnboardingStep((current) => Math.max(0, (current ?? 1) - 1))}
                  disabled={isOnboardingSaving}
                >
                  이전
                </button>
              ) : <span />}
              <button
                type="button"
                className="onboarding-next-button"
                onClick={() => {
                  if (onboardingStep === 3) {
                    void handleFinishOnboarding()
                  } else {
                    setOnboardingStep((current) => Math.min(3, (current ?? 0) + 1))
                  }
                }}
                disabled={isOnboardingSaving}
              >
                {isOnboardingSaving
                  ? '저장 중…'
                  : onboardingStep === 0
                    ? '설명 보러 가기'
                    : onboardingStep === 3
                      ? 'Giving Tree 시작하기'
                      : '다음'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {classSettingsOpen ? (
        <div
          className="class-settings-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="class-settings-title"
          onClick={() => {
            if (!isClassSizeSaving) {
              setClassSettingsOpen(false)
            }
          }}
        >
          <article
            className="class-settings-card"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="class-settings-header">
              <div>
                <span className="settings-leaf" aria-hidden="true">🌿</span>
                <div>
                  <p>CLASS SETTINGS</p>
                  <h2 id="class-settings-title">우리 반 인원 수정</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClassSettingsOpen(false)}
                disabled={isClassSizeSaving}
                aria-label="반 인원 수정 닫기"
              >
                ×
              </button>
            </header>

            <p className="class-settings-description">
              실제 반 인원이 바뀌어도 등록된 아이와 얼굴 학습 데이터는 그대로 유지돼요.
            </p>

            <div className="class-size-picker settings-size-picker">
              <button
                type="button"
                onClick={() =>
                  setDraftClassSize((current) =>
                    Math.max(Math.max(MIN_CLASS_SIZE, children.length), current - 1),
                  )
                }
                disabled={
                  draftClassSize <= Math.max(MIN_CLASS_SIZE, children.length) ||
                  isClassSizeSaving
                }
                aria-label="반 인원 한 명 줄이기"
              >
                −
              </button>
              <label>
                <input
                  type="number"
                  min={Math.max(MIN_CLASS_SIZE, children.length)}
                  max={MAX_CLASS_SIZE}
                  value={draftClassSize}
                  onChange={(event) =>
                    setDraftClassSize(
                      Math.min(
                        MAX_CLASS_SIZE,
                        Math.max(
                          Math.max(MIN_CLASS_SIZE, children.length),
                          Number(event.target.value) || Math.max(1, children.length),
                        ),
                      ),
                    )
                  }
                  disabled={isClassSizeSaving}
                  aria-label="수정할 반 인원"
                />
                <span>명</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setDraftClassSize((current) =>
                    Math.min(MAX_CLASS_SIZE, current + 1),
                  )
                }
                disabled={draftClassSize >= MAX_CLASS_SIZE || isClassSizeSaving}
                aria-label="반 인원 한 명 늘리기"
              >
                +
              </button>
            </div>

            <div className="class-size-presets settings-presets">
              {[15, 20, 25, 30].map((size) => (
                <button
                  type="button"
                  className={draftClassSize === size ? 'active' : ''}
                  onClick={() => setDraftClassSize(size)}
                  disabled={size < children.length || isClassSizeSaving}
                  key={size}
                >
                  {size}명
                </button>
              ))}
            </div>

            <div className="registered-class-note">
              <span>현재 등록</span>
              <strong>{children.length}명</strong>
              <p>등록된 아이 수보다 작게 설정할 수 없어요.</p>
            </div>

            <footer className="class-settings-actions">
              <button
                type="button"
                className="class-settings-cancel"
                onClick={() => setClassSettingsOpen(false)}
                disabled={isClassSizeSaving}
              >
                취소
              </button>
              <button
                type="button"
                className="class-settings-save"
                onClick={() => void handleSaveClassSize()}
                disabled={isClassSizeSaving}
              >
                {isClassSizeSaving ? '저장 중…' : '변경 저장'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {backupDialogOpen ? (
        <div
          className="backup-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Giving Tree 데이터 백업과 복원"
          onClick={() => {
            if (!isBackupBusy) {
              setBackupDialogOpen(false)
            }
          }}
        >
          <article className="backup-card" onClick={(event) => event.stopPropagation()}>
            <header className="backup-header">
              <div>
                <p>PRIVATE DATA VAULT</p>
                <h2>백업·복원</h2>
              </div>
              <button
                type="button"
                onClick={() => setBackupDialogOpen(false)}
                disabled={isBackupBusy}
                aria-label="백업 화면 닫기"
              >
                ×
              </button>
            </header>

            <div className="backup-summary-grid">
              <div>
                <span>등록한 아이</span>
                <strong>{children.length}명</strong>
              </div>
              <div>
                <span>저장 상태</span>
                <strong>
                  {storagePersistent === true
                    ? '영구 저장'
                    : storagePersistent === false
                      ? '일반 저장'
                      : '확인 필요'}
                </strong>
              </div>
              <div>
                <span>최근 백업</span>
                <strong>
                  {lastBackupAt
                    ? new Date(lastBackupAt).toLocaleDateString('ko-KR')
                    : '아직 없음'}
                </strong>
              </div>
            </div>

            <section className="backup-section">
              <div className="backup-section-copy">
                <span className="backup-step-icon" aria-hidden="true">↓</span>
                <div>
                  <h3>암호화 백업 만들기</h3>
                  <p>아이 정보·대표사진·얼굴 학습 정보를 비밀번호로 보호해 저장해요.</p>
                </div>
              </div>
              <label className="backup-field">
                백업 비밀번호
                <input
                  type="password"
                  value={backupPassword}
                  onChange={(event) => setBackupPassword(event.target.value)}
                  placeholder="6자 이상"
                  autoComplete="new-password"
                  disabled={isBackupBusy}
                />
              </label>
              <label className="backup-field">
                비밀번호 한 번 더
                <input
                  type="password"
                  value={backupPasswordConfirm}
                  onChange={(event) => setBackupPasswordConfirm(event.target.value)}
                  placeholder="같은 비밀번호 입력"
                  autoComplete="new-password"
                  disabled={isBackupBusy}
                />
              </label>
              <p className="backup-warning">
                비밀번호는 복구할 수 없어요. 기억할 수 있는 비밀번호를 사용하고, 만들어진
                파일은 공유 화면에서 `파일에 저장` → `iCloud Drive`를 선택하세요.
              </p>
              <button
                type="button"
                className="backup-primary-button"
                onClick={() => void handleCreateBackup()}
                disabled={isBackupBusy}
              >
                {isBackupBusy ? '처리 중…' : '암호화 백업 파일 만들기'}
              </button>
            </section>

            <section className="backup-section restore-section">
              <div className="backup-section-copy">
                <span className="backup-step-icon" aria-hidden="true">↑</span>
                <div>
                  <h3>백업에서 복원하기</h3>
                  <p>새 아이폰이나 데이터가 사라졌을 때 저장해 둔 파일을 불러와요.</p>
                </div>
              </div>
              <input
                ref={restoreInputRef}
                type="file"
                accept=".givingtree,application/octet-stream"
                onChange={handleSelectRestoreFile}
                hidden
              />
              <button
                type="button"
                className="backup-file-button"
                onClick={() => restoreInputRef.current?.click()}
                disabled={isBackupBusy}
              >
                {restoreFile ? `✓ ${restoreFile.name}` : 'Giving Tree 백업 파일 선택'}
              </button>
              <label className="backup-field">
                백업 비밀번호
                <input
                  type="password"
                  value={restorePassword}
                  onChange={(event) => setRestorePassword(event.target.value)}
                  placeholder="백업할 때 사용한 비밀번호"
                  autoComplete="current-password"
                  disabled={isBackupBusy}
                />
              </label>
              <button
                type="button"
                className="restore-button"
                onClick={() => void handleRestoreBackup()}
                disabled={isBackupBusy || !restoreFile}
              >
                선택한 백업 복원하기
              </button>
            </section>

            {statusMessage ? (
              <p className="modal-status-message" role="status">{statusMessage}</p>
            ) : null}
          </article>
        </div>
      ) : null}

      {learningHistoryChild && learningHistoryProfile ? (
        <div
          className="learning-history-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="learning-history-title"
          onClick={() => setLearningHistoryChildId(null)}
        >
          <article
            className="learning-history-card"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>AI LEARNING HISTORY</p>
                <h2 id="learning-history-title">
                  {learningHistoryChild.name} 학습 기록
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLearningHistoryChildId(null)}
                aria-label="학습 기록 닫기"
              >
                ×
              </button>
            </header>
            <p className="learning-history-description">
              잘못 지정한 기록만 골라 삭제할 수 있어요. 대표사진 6장은 삭제되지 않습니다.
            </p>
            <div className="learning-history-summary">
              <span>대표사진 얼굴</span>
              <strong>
                {learningHistoryProfile.representativeEmbeddings?.length ?? 0}개
              </strong>
              <span>추가 학습</span>
              <strong>{learningHistoryItems.length}개</strong>
            </div>
            <div className="learning-history-list">
              {learningHistoryItems.map(({ index, sample }) => (
                <div className="learning-history-item" key={sample?.id ?? `legacy-${index}`}>
                  <div>
                    <strong>추가 학습 {index + 1}</strong>
                    <span>
                      {sample?.addedAt
                        ? new Date(sample.addedAt).toLocaleString('ko-KR')
                        : '기존 학습 기록'}
                    </span>
                    {sample?.sourceFileName ? <small>{sample.sourceFileName}</small> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleRemoveLearning(learningHistoryChild, index)
                    }
                    disabled={isAnalyzing || isPreparingProfiles || Boolean(learningFaceKey)}
                  >
                    이 기록 삭제
                  </button>
                </div>
              ))}
            </div>
            <footer>
              <button type="button" onClick={() => setLearningHistoryChildId(null)}>
                완료
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {lightboxPhoto ? (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="사진 크게 보기"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="photo-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close-button"
              onClick={() => setLightboxPhoto(null)}
              aria-label="확대 사진 닫기"
            >
              ← 사진으로 돌아가기
            </button>
            <div className="lightbox-image-frame">
              <img src={lightboxPhoto.src} alt={lightboxPhoto.alt} />
              {lightboxPhoto.faces?.map((face, faceIndex) => {
                const matchedName = face.match.childId
                  ? childNamesById[face.match.childId]
                  : undefined
                const suggestedName = face.match.suggestedChildId
                  ? childNamesById[face.match.suggestedChildId]
                  : undefined
                const label = `${faceIndex + 1} · ${
                  matchedName ?? (suggestedName ? `후보 ${suggestedName}` : '확인')
                }`

                return (
                  <span
                    className={`face-box ${
                      matchedName ? 'face-box-matched' : 'face-box-review'
                    }`}
                    key={`lightbox-face-${faceIndex}`}
                    title={`${label} · 유사도 ${Math.round(face.match.similarity * 100)}%`}
                    style={{
                      left: `${face.x * 100}%`,
                      top: `${face.y * 100}%`,
                      width: `${face.width * 100}%`,
                      height: `${face.height * 100}%`,
                    }}
                  >
                    <span>{label}</span>
                  </span>
                )
              })}
            </div>
            <p>바깥쪽을 누르거나 위 버튼을 누르면 바로 돌아갑니다.</p>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
