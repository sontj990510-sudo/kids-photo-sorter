import type { MenuItem, Role } from './types'

export const ROLE_LABELS: Record<Role, string> = {
  director: '원장',
  teacher: '교사',
  parent: '학부모',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  director: '가입 승인과 유치원 전체를 관리해요',
  teacher: '담당 반 소식과 사진을 관리해요',
  parent: '우리 아이의 소식과 사진을 확인해요',
}

export const ROLE_HOME_COPY: Record<Role, { greeting: string; subcopy: string }> = {
  director: {
    greeting: '좋은 아침이에요, 김나무 원장님',
    subcopy: '오늘 확인할 가입 신청이 3건 있어요.',
  },
  teacher: {
    greeting: '안녕하세요, 이새봄 선생님',
    subcopy: '판다반의 오늘 소식을 준비해 볼까요?',
  },
  parent: {
    greeting: '반가워요, 하린이 보호자님',
    subcopy: '판다반에 새로운 알림장이 도착했어요.',
  },
}

export const MENUS_BY_ROLE: Record<Role, MenuItem[]> = {
  director: [
    {
      key: 'approvals',
      label: '가입 승인',
      eyebrow: '새 신청',
      icon: 'approval',
      tone: 'sun',
      badge: 3,
    },
    {
      key: 'children',
      label: '반·원아 관리',
      eyebrow: '6개 반',
      icon: 'people',
      tone: 'leaf',
    },
    {
      key: 'staff',
      label: '교사·권한',
      eyebrow: '안전 관리',
      icon: 'shield',
      tone: 'sky',
    },
    {
      key: 'global-notices',
      label: '전체 공지사항',
      eyebrow: '새 공지',
      icon: 'notice',
      tone: 'berry',
    },
    {
      key: 'class-note',
      label: '반별 알림장',
      eyebrow: '모든 반',
      icon: 'note',
      tone: 'mint',
    },
    {
      key: 'meals',
      label: '이번 달 식단',
      eyebrow: '7월 식단',
      icon: 'meal',
      tone: 'wood',
    },
    {
      key: 'photo-status',
      label: '사진 게시 현황',
      eyebrow: '검토 12장',
      icon: 'photo',
      tone: 'leaf',
    },
    {
      key: 'audit',
      label: '관리 기록',
      eyebrow: '변경 이력',
      icon: 'history',
      tone: 'sky',
    },
  ],
  teacher: [
    {
      key: 'global-notices',
      label: '전체 공지사항',
      eyebrow: '새 글 2개',
      icon: 'notice',
      tone: 'berry',
      badge: 2,
    },
    {
      key: 'class-note',
      label: '판다반 알림장',
      eyebrow: '오늘 기록',
      icon: 'note',
      tone: 'mint',
    },
    {
      key: 'upload-photos',
      label: '아이 사진 올리기',
      eyebrow: '교사 전용',
      icon: 'upload',
      tone: 'leaf',
    },
    {
      key: 'class-children',
      label: '판다반 원아',
      eyebrow: '12명',
      icon: 'people',
      tone: 'sun',
    },
    {
      key: 'meals',
      label: '이번 달 식단',
      eyebrow: '오늘의 메뉴',
      icon: 'meal',
      tone: 'wood',
    },
    {
      key: 'notifications',
      label: '알림 모아보기',
      eyebrow: '새 알림 4개',
      icon: 'bell',
      tone: 'sky',
      badge: 4,
    },
  ],
  parent: [
    {
      key: 'global-notices',
      label: '전체 공지사항',
      eyebrow: '새 글 2개',
      icon: 'notice',
      tone: 'berry',
      badge: 2,
    },
    {
      key: 'class-note',
      label: '판다반 알림장',
      eyebrow: '오늘의 소식',
      icon: 'note',
      tone: 'mint',
      badge: 1,
    },
    {
      key: 'child-album',
      label: '우리 아이 사진첩',
      eyebrow: '새 사진 8장',
      icon: 'photo',
      tone: 'leaf',
      badge: 8,
    },
    {
      key: 'meals',
      label: '이번 달 식단',
      eyebrow: '오늘의 메뉴',
      icon: 'meal',
      tone: 'wood',
    },
    {
      key: 'notifications',
      label: '알림 모아보기',
      eyebrow: '설정 가능',
      icon: 'bell',
      tone: 'sky',
    },
    {
      key: 'profile',
      label: '내 정보',
      eyebrow: '하린 · 판다반',
      icon: 'profile',
      tone: 'sun',
    },
  ],
}

export const MENU_TITLES: Record<MenuItem['key'], string> = {
  approvals: '가입 승인',
  children: '반·원아 관리',
  staff: '교사·권한 관리',
  'global-notices': '전체 공지사항',
  'class-note': '판다반 알림장',
  meals: '이번 달 식단',
  'photo-status': '사진 게시 현황',
  'upload-photos': '아이 사진 올리기',
  'class-children': '판다반 원아',
  'child-album': '우리 아이 사진첩',
  notifications: '알림 모아보기',
  audit: '관리 기록',
  profile: '내 정보',
}
