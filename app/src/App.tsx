import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { openDB } from 'idb'
import { analyzeFacesInFile } from './lib/faceDetection'
import type { DetectedFaceBox } from './lib/faceDetection'
import { matchFaceEmbedding } from './lib/faceMatching'
import type { FaceMatch, FaceProfileRecord } from './lib/faceMatching'
import './App.css'

type PreviewItem = {
  id: string
  file: File
  url: string
}

type AnalyzedFace = DetectedFaceBox & {
  match: FaceMatch
}

type FaceAnalysis = {
  faces: AnalyzedFace[]
  durationMs: number
  error?: string
}

type ChildRecord = {
  id: string
  name: string
  photoFiles: File[]
  createdAt: string
  updatedAt: string
}

type TabKey = 'register' | 'classify'

const DB_NAME = 'kids-photo-sorter-db'
const DB_VERSION = 2
const CHILDREN_STORE_NAME = 'children'
const FACE_PROFILES_STORE_NAME = 'faceProfiles'
const MAX_PHOTOS = 10

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
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({ completed: 0, total: 0 })

  const classifyInputRef = useRef<HTMLInputElement | null>(null)
  const registerInputRef = useRef<HTMLInputElement | null>(null)
  const previewItemsRef = useRef<PreviewItem[]>([])
  const activeObjectUrlsRef = useRef<string[]>([])
  const childImageUrlsRef = useRef<Record<string, string>>({})
  const idSequenceRef = useRef(0)

  useEffect(() => {
    previewItemsRef.current = previewItems
  }, [previewItems])

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
      const [savedChildren, savedProfiles] = await Promise.all([
        database.getAll(CHILDREN_STORE_NAME) as Promise<ChildRecord[]>,
        database.getAll(FACE_PROFILES_STORE_NAME) as Promise<FaceProfileRecord[]>,
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
    } catch (error) {
      if (error instanceof Error) {
        setStatusMessage(`아이 목록을 불러오지 못했어요. ${error.message}`)
      }
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

  const clearDraftPreview = () => {
    draftPreviewItems.forEach(({ url }) => revokeObjectUrl(url))
    setDraftPreviewItems([])
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
        const embeddings: number[][] = []
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
              embeddings.push(onlyFace.embedding)
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

        if (embeddings.length > 0) {
          const profile: FaceProfileRecord = {
            childId: child.id,
            embeddings,
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
    setAnalysisProgress({ completed: 0, total: 0 })
    setStatusMessage(`${uniqueFiles.length}장의 사진을 추가했어요.`)
    event.target.value = ''
  }

  const handleClearClassification = () => {
    previewItems.forEach(({ url }) => revokeObjectUrl(url))
    previewItemsRef.current = []
    setPreviewItems([])
    setSelectedFiles([])
    setFaceAnalyses({})
    setAnalysisProgress({ completed: 0, total: 0 })
    setStatusMessage('선택한 사진을 모두 비웠어요.')
  }

  const handleRemoveClassificationItem = (itemId: string) => {
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

  const shareFiles = async (
    files: File[],
    title: string,
    text: string,
    successMessage: string,
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
    )
  }

  const handleSelectDraftPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const availableSlots = MAX_PHOTOS - draftPreviewItems.length
    if (availableSlots <= 0) {
      setStatusMessage(`대표사진은 최대 ${MAX_PHOTOS}장까지 등록할 수 있어요.`)
      event.target.value = ''
      return
    }

    const uniqueFiles = files.filter((file) => {
      return !draftPreviewItems.some(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified,
      )
    })

    if (uniqueFiles.length === 0) {
      setStatusMessage('이미 선택한 사진이에요. 다른 사진을 골라주세요.')
      event.target.value = ''
      return
    }

    const limitedFiles = uniqueFiles.slice(0, availableSlots)
    if (limitedFiles.length < uniqueFiles.length) {
      setStatusMessage(`대표사진은 최대 ${MAX_PHOTOS}장까지 등록 가능해요. ${limitedFiles.length}장만 추가했어요.`)
    }

    const nextDraftItems = limitedFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}-${createPreviewId()}`,
      file,
      url: createObjectUrl(file),
    }))

    setDraftPreviewItems((previousItems) => [...previousItems, ...nextDraftItems])
    event.target.value = ''
  }

  const handleRemoveDraftItem = (itemId: string) => {
    const targetItem = draftPreviewItems.find((item) => item.id === itemId)
    if (targetItem) {
      revokeObjectUrl(targetItem.url)
    }

    setDraftPreviewItems((previousItems) => previousItems.filter((item) => item.id !== itemId))
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

    if (draftPreviewItems.length < 1) {
      setStatusMessage('대표사진은 최소 1장 이상 등록해야 해요.')
      return
    }

    setIsSaving(true)

    try {
      const database = await openChildrenDB()
      const now = new Date().toISOString()
      const payload: ChildRecord = {
        id: editingChildId ?? `child-${createPreviewId()}`,
        name: trimmedName,
        photoFiles: draftPreviewItems.map((item) => item.file),
        createdAt: editingChildId
          ? children.find((child) => child.id === editingChildId)?.createdAt ?? now
          : now,
        updatedAt: now,
      }

      await database.put(CHILDREN_STORE_NAME, payload)
      await database.delete(FACE_PROFILES_STORE_NAME, payload.id)
      setFaceAnalyses({})
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
    const nextDraftItems = child.photoFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}-${createPreviewId()}`,
      file,
      url: createObjectUrl(file),
    }))
    setDraftPreviewItems(nextDraftItems)
    setActiveTab('register')
    setStatusMessage(`${child.name} 정보를 수정할 수 있어요.`)
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
      setStatusMessage('아이 정보를 삭제했어요.')
    } catch (error) {
      if (error instanceof Error) {
        setStatusMessage(`삭제하지 못했어요. ${error.message}`)
      }
    }
  }

  const childNamesById = Object.fromEntries(children.map((child) => [child.id, child.name]))
  const preparedChildCount = children.filter((child) => faceProfiles[child.id]).length
  const groupedChildResults = children
    .map((child) => ({
      child,
      items: previewItems.filter((item) =>
        faceAnalyses[item.id]?.faces.some((face) => face.match.childId === child.id),
      ),
    }))
    .filter((group) => group.items.length > 0)
  const reviewItems = previewItems.filter((item) =>
    faceAnalyses[item.id]?.faces.some((face) => face.match.status === 'review'),
  )
  const analyzedItemCount = Object.keys(faceAnalyses).length

  return (
    <main className="photo-sorter-app">
      <section className="shell">
        <header className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">아이 사진 관리</p>
            <h1>아이 등록부터 사진 분류까지 한 번에 관리해 보세요.</h1>
            <p className="description">
              아이의 대표사진을 등록하고, 사진 분류와 공유까지 같은 화면에서 이어서 진행할 수 있어요.
            </p>
          </div>
          <div className="hero-badge" aria-hidden="true">
            👶
          </div>
        </header>

        <nav className="tab-list" aria-label="기능 탭">
          <button
            type="button"
            className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            아이 등록
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'classify' ? 'active' : ''}`}
            onClick={() => setActiveTab('classify')}
          >
            사진 분류
          </button>
        </nav>

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

              <div className="button-row compact-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => registerInputRef.current?.click()}
                  disabled={isPreparingProfiles}
                >
                  대표사진 선택
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearDraftPreview}
                  disabled={draftPreviewItems.length === 0 || isPreparingProfiles}
                >
                  선택 초기화
                </button>
              </div>

              <input
                ref={registerInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleSelectDraftPhotos}
                hidden
              />

              <p className="helper-text">
                대표사진은 최소 1장, 최대 {MAX_PHOTOS}장까지 등록할 수 있어요. 얼굴 준비에는 아이 한 명만
                선명하게 나온 사진이 사용됩니다.
              </p>

              {draftPreviewItems.length > 0 ? (
                <div className="preview-grid draft-grid" aria-live="polite">
                  {draftPreviewItems.map((item) => (
                    <article className="preview-tile" key={item.id}>
                      <img src={item.url} alt={item.file.name} />
                      <div className="preview-meta">
                        <p>{item.file.name}</p>
                        <button type="button" onClick={() => handleRemoveDraftItem(item.id)}>
                          삭제
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty">
                  <div className="empty-icon" aria-hidden="true">
                    🖼️
                  </div>
                  <h3>아직 대표사진이 없어요</h3>
                  <p>사진을 선택하면 등록 전 미리보기가 여기에 나타납니다.</p>
                </div>
              )}

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
                    AI 준비 완료 {preparedChildCount}명 / 전체 {children.length}명
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
                          <img src={childImageUrls[child.id]} alt={child.name} />
                        ) : (
                          <div className="child-placeholder">📷</div>
                        )}
                      </div>
                      <div className="child-card-content">
                        <h3>{child.name}</h3>
                        <p>{new Date(child.createdAt).toLocaleDateString('ko-KR')}</p>
                        <p>{child.photoFiles.length}장의 대표사진</p>
                        {faceProfiles[child.id] ? (
                          <p className="profile-ready">
                            AI 준비 완료 · 얼굴 {faceProfiles[child.id].embeddings.length}개
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

              <div className="selection-summary">
                <p>{selectedFiles.length}장 선택됨</p>
                <p className="hint">
                  AI 준비 완료 {preparedChildCount}명 · 공유 전에는 분류 결과를 직접 확인해 주세요.
                </p>
              </div>

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
                          <img src={url} alt={file.name} />
                          {analysis?.faces.map((face, faceIndex) => {
                            const matchedName = face.match.childId
                              ? childNamesById[face.match.childId]
                              : undefined
                            const label = matchedName ?? '확인'

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
                  <p>단체사진은 얼굴이 확인된 모든 아이의 목록에 함께 들어갑니다.</p>
                </div>

                {groupedChildResults.length > 0 ? (
                  groupedChildResults.map(({ child, items }) => (
                    <article className="child-result-card" key={child.id}>
                      <div className="child-result-header">
                        <div>
                          <h3>{child.name}</h3>
                          <p>{items.length}장의 사진</p>
                        </div>
                        <button
                          type="button"
                          className="share-button result-share-button"
                          onClick={() => void handleShareChildPhotos(child, items)}
                          disabled={isAnalyzing}
                        >
                          {child.name} 사진 공유
                        </button>
                      </div>
                      <p className="safety-note">
                        보내기 전에 다른 아이 사진이 섞이지 않았는지 직접 확인해 주세요.
                      </p>
                      <div className="result-photo-grid">
                        {items.map((item) => (
                          <img src={item.url} alt={`${child.name} 분류 사진`} key={item.id} />
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
                        <p>{reviewItems.length}장의 사진에서 확실하지 않은 얼굴이 발견됐어요.</p>
                      </div>
                    </div>
                    <p className="safety-note">
                      이 사진들은 자동으로 어느 아이에게도 보내지 않습니다. 수동 수정 기능은 다음
                      단계에서 추가합니다.
                    </p>
                    <div className="result-photo-grid">
                      {reviewItems.map((item) => (
                        <img src={item.url} alt="확인 필요한 사진" key={item.id} />
                      ))}
                    </div>
                  </article>
                ) : null}
              </section>
            ) : null}
          </section>
        )}
      </section>
    </main>
  )
}

export default App
