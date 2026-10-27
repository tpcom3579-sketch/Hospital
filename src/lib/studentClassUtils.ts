import type { Student } from '../types'

export const OTHER_CLASS_FILTER = 'other'

type RoomType = 'number' | 'letter' | 'other'

type ParsedClass = {
  level: number | null
  room: string | null
  roomType: RoomType
}

export type StudentClassFilterOption = {
  value: string
  label: string
}

const classPattern = /^(?:ม\.?\s*)?([1-6])\s*\/\s*(.+)$/i
const letterRoomPattern = /^[A-Z][A-Z0-9_-]*$/i
const roomTypeOrder: Record<RoomType, number> = { number: 0, letter: 1, other: 2 }

export function parseStudentClass(className: string): ParsedClass {
  const match = className.trim().match(classPattern)
  if (!match) return { level: null, room: null, roomType: 'other' }

  const rawRoom = match[2].trim()
  if (/^\d+$/.test(rawRoom)) {
    return { level: Number(match[1]), room: String(Number(rawRoom)), roomType: 'number' }
  }
  if (letterRoomPattern.test(rawRoom)) {
    return { level: Number(match[1]), room: rawRoom.toLocaleUpperCase('en'), roomType: 'letter' }
  }
  return { level: Number(match[1]), room: null, roomType: 'other' }
}

export function getStudentLevelFilter(className: string): string {
  const { level } = parseStudentClass(className)
  return level === null ? OTHER_CLASS_FILTER : String(level)
}

export function getStudentRoomFilter(className: string): string {
  const { room } = parseStudentClass(className)
  return room ?? OTHER_CLASS_FILTER
}

export function getStudentClassLevelOptions(students: Student[]): StudentClassFilterOption[] {
  const options = Array.from({ length: 6 }, (_, index) => ({
    value: String(index + 1),
    label: `ม.${index + 1}`,
  }))
  if (students.some((student) => getStudentLevelFilter(student.class_name) === OTHER_CLASS_FILTER)) {
    options.push({ value: OTHER_CLASS_FILTER, label: 'อื่นๆ' })
  }
  return options
}

export function getStudentClassRoomOptions(
  students: Student[],
  selectedLevel: string,
): StudentClassFilterOption[] {
  const rooms = new Map<string, ParsedClass>()
  for (const student of students) {
    if (selectedLevel && getStudentLevelFilter(student.class_name) !== selectedLevel) continue
    const parsedClass = parseStudentClass(student.class_name)
    rooms.set(getStudentRoomFilter(student.class_name), parsedClass)
  }

  return [...rooms.entries()]
    .map(([value, parsedClass]) => ({
      value,
      label: value === OTHER_CLASS_FILTER ? 'อื่นๆ' : value,
      parsedClass,
    }))
    .sort((first, second) => {
      const typeComparison = roomTypeOrder[first.parsedClass.roomType] - roomTypeOrder[second.parsedClass.roomType]
      if (typeComparison !== 0) return typeComparison
      if (first.parsedClass.roomType === 'number' && second.parsedClass.roomType === 'number') {
        return Number(first.value) - Number(second.value)
      }
      return first.label.localeCompare(second.label, 'en', { numeric: true, sensitivity: 'base' })
    })
    .map(({ value, label }) => ({ value, label }))
}

function compareRooms(first: ParsedClass, second: ParsedClass): number {
  const typeComparison = roomTypeOrder[first.roomType] - roomTypeOrder[second.roomType]
  if (typeComparison !== 0) return typeComparison
  if (first.roomType === 'number' && second.roomType === 'number') {
    return Number(first.room) - Number(second.room)
  }
  return (first.room ?? '').localeCompare(second.room ?? '', 'en', { numeric: true, sensitivity: 'base' })
}

export function compareStudentsByClass(first: Student, second: Student): number {
  const firstClass = parseStudentClass(first.class_name)
  const secondClass = parseStudentClass(second.class_name)
  const firstLevel = firstClass.level ?? 7
  const secondLevel = secondClass.level ?? 7

  return firstLevel - secondLevel
    || compareRooms(firstClass, secondClass)
    || first.number - second.number
    || first.student_id.localeCompare(second.student_id)
}
