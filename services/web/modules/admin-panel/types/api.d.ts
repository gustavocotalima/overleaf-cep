import { SortingOrder } from '../../../types/sorting-order'
import { MergeAndOverride } from '../../../types/utils'

export type Page = {
  size: number
  lastId?: string
}

export type Sort = {
  by: 'lastLoggedIn' | 'signUpDate' | 'deletedAt' | 'email' | 'name'
  order: SortingOrder
}

export type Filters = {
  all?: boolean
  admin?: boolean
  inactive?: boolean
  suspended?: boolean
  deleted?: boolean
  local?: boolean
  saml?: boolean
  oidc?: boolean
  ldap?: boolean
  search?: string
}

export type GetUsersRequestBody = {
  page: Page
  sort: Sort
  filters: Filters
}

export type UserApi = {
  id: string
  email: string
  first_name: string
  last_name: string
  isAdmin: boolean
  loginCount: number
  signUpDate: Date
  lastLoggedIn?: Date
  authFlags: number
  suspended: boolean
  inactive: boolean
  deleted?: boolean
  deletedAt?: Date
  deletedId?: string
}

export type User = MergeAndOverride<
  UserApi,
  {
    signUpDate: string
    lastLoggedIn?: string
    deletedAt?: string
    selected?: boolean
  }
>

export type GetUsersResponseBody = {
  totalSize: number
  users: User[]
}
