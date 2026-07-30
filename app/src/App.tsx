import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'

type PreviewItem = {
  file: File
  url: string
}

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewItemsRef = useRef<PreviewItem[]>([])

  useEffect(() => {
    previewItemsRef.current = previewItems
  }, [previewItems])

  useEffect(() => {
    return () => {
      previewItemsRef.current.forEach(({ url }) => URL.revokeObjectURL(url))
    }
  }, [])

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
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
      file,
      url: URL.createObjectURL(file),
    }))

    setSelectedFiles((previousFiles) => [...previousFiles, ...uniqueFiles])
    setPreviewItems((previousItems) => [...previousItems, ...nextPreviewItems])
    setStatusMessage(`${uniqueFiles.length}장의 사진을 추가했어요.`)
    event.target.value = ''
  }

  const handleClear = () => {
    previewItems.forEach(({ url }) => URL.revokeObjectURL(url))
    previewItemsRef.current = []
    setPreviewItems([])
    setSelectedFiles([])
    setStatusMessage('선택한 사진을 모두 비웠어요.')
  }

  const handleShare = async () => {
    if (selectedFiles.length === 0) {
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
      files: selectedFiles,
      title: '아이들 사진 정리 테스트',
      text: '사진을 함께 확인해 보세요.',
    }

    try {
      if (navigator.canShare?.(sharePayload)) {
        await navigator.share(sharePayload)
        setStatusMessage('사진을 공유했어요.')
      } else {
        setStatusMessage('이 기기에서는 사진 파일 공유가 지원되지 않아요. 사진을 직접 저장한 뒤 보내주세요.')
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setStatusMessage('공유를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    }
  }

  return (
    <main className="photo-sorter-app">
      <section className="shell">
        <header className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">개인용 사진 분류 테스트</p>
            <h1>아이들 사진을 편하게 골라서 공유해 보세요.</h1>
            <p className="description">
              여러 장을 한 번에 선택하고, 정사각형 미리보기로 확인한 뒤 바로 공유할 수 있어요.
            </p>
          </div>
          <div className="hero-badge" aria-hidden="true">
            📸
          </div>
        </header>

        <section className="controls-card">
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              사진 선택하기
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleClear}
              disabled={selectedFiles.length === 0}
            >
              전체 지우기
            </button>
            <button
              type="button"
              className="share-button"
              onClick={handleShare}
              disabled={selectedFiles.length === 0}
            >
              카카오톡으로 공유
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleSelect}
            hidden
          />

          <div className="selection-summary">
            <p>{selectedFiles.length}장 선택됨</p>
            <p className="hint">여러 장을 한 번에 고르면 미리보기가 바로 추가돼요.</p>
          </div>

          {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        </section>

        <section className="preview-card" aria-live="polite">
          {previewItems.length > 0 ? (
            <div className="preview-grid">
              {previewItems.map(({ file, url }) => (
                <article className="preview-tile" key={`${file.name}-${file.lastModified}-${file.size}`}>
                  <img src={url} alt={file.name} />
                  <p>{file.name}</p>
                </article>
              ))}
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
      </section>
    </main>
  )
}

export default App
