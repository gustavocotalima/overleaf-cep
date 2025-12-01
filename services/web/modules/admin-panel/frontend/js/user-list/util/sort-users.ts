import { User, Sort } from '../../../../types/api'
import { SortingOrder } from '../../../../../../types/sorting-order'
import { Compare } from '../../../../../../types/helpers/array/sort'

const order = (order: SortingOrder, users: User[]) => {
  return order === 'asc' ? [...users] : users.reverse()
}


function cmp(a, b) {
  const aEmpty = (a === "")
  const bEmpty = (b === "")
  if (aEmpty && bEmpty) return Compare.SORT_KEEP_ORDER
  if (aEmpty !== bEmpty) return aEmpty ? Compare.SORT_A_AFTER_B : Compare.SORT_A_BEFORE_B
  return a.localeCompare(b)
}

export const userNameComparator = (v1: User, v2: User) => {
  const res = cmp(v1.last_name, v2.last_name)
  if (res !== 0) return res
  return cmp(v1.first_name, v2.first_name)
}

export const defaultComparator = (
  v1: User,
  v2: User,
  key: 'lastActive' | 'signUpDate' | 'email'
) => {
  const value1 = v1[key]?.toLowerCase()
  const value2 = v2[key]?.toLowerCase()

  if (value1 !== value2) {
    if (value1 === undefined) return Compare.SORT_A_BEFORE_B
    if (value2 === undefined) return Compare.SORT_A_AFTER_B
    return value1 < value2 ? Compare.SORT_A_BEFORE_B : Compare.SORT_A_AFTER_B
  }
  return Compare.SORT_KEEP_ORDER
}

export default function sortUsers(users: User[], sort: Sort) {
  let sorted = [...users]
  if (sort.by === 'lastActive') {
    sorted = sorted.sort((...args) => {
      return defaultComparator(...args, 'lastActive')
    })
  }

  if (sort.by === 'signUpDate') {
    sorted = sorted.sort((...args) => {
      return defaultComparator(...args, 'signUpDate')
    })
  }

  if (sort.by === 'email') {
    sorted = sorted.sort((...args) => {
      return defaultComparator(...args, 'email')
    })
  }

  if (sort.by === 'name') {
    sorted = sorted.sort((...args) => {
      return userNameComparator(...args)
    })
  }

  return order(sort.order, sorted)
}
