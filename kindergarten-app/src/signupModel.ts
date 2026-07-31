export type GuardianRelationship =
  | 'father'
  | 'mother'
  | 'grandmother'
  | 'grandfather'
  | 'other'

export type LegalAuthorityClaim = 'yes' | 'no' | 'unsure'

export const GUARDIAN_RELATIONSHIP_OPTIONS: Array<{
  value: GuardianRelationship
  label: string
}> = [
  { value: 'father', label: '아버지' },
  { value: 'mother', label: '어머니' },
  { value: 'grandmother', label: '할머니' },
  { value: 'grandfather', label: '할아버지' },
  { value: 'other', label: '기타' },
]

export const LEGAL_AUTHORITY_OPTIONS: Array<{
  value: LegalAuthorityClaim
  label: string
}> = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니요' },
  { value: 'unsure', label: '잘 모르겠어요' },
]

export const DEMO_PHONE_CODE = '246810'

function getUsNationalDigits(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length > 10 && digits.startsWith('1')) {
    return digits.slice(1, 11)
  }

  return digits.slice(0, 10)
}

export function formatUsPhoneInput(value: string) {
  const digits = getUsNationalDigits(value)

  if (!digits) {
    return ''
  }

  if (digits.length < 4) {
    return `(${digits}`
  }

  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function isStructurallyValidUsPhone(value: string) {
  const digits = getUsNationalDigits(value)

  // NANP area and exchange codes cannot begin with 0 or 1. A provider-side
  // lookup is still required later to prove that the number is real.
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)
}

export function toUsE164(value: string) {
  if (!isStructurallyValidUsPhone(value)) {
    return null
  }

  return `+1${getUsNationalDigits(value)}`
}

export function getRelationshipLabel(
  relationship: GuardianRelationship,
  otherText: string,
) {
  if (relationship === 'other') {
    return otherText.trim() || '기타'
  }

  return (
    GUARDIAN_RELATIONSHIP_OPTIONS.find(
      (option) => option.value === relationship,
    )?.label ?? ''
  )
}

export function getLegalAuthorityLabel(claim: LegalAuthorityClaim) {
  return (
    LEGAL_AUTHORITY_OPTIONS.find((option) => option.value === claim)?.label ?? ''
  )
}
