import { Sort } from '../../../../types/api'
import { SortingOrder } from '../../../../../../types/sorting-order'
import { useUserListContext } from '../context/user-list-context'

const toggleSort = (order: SortingOrder): SortingOrder => {
  return order === 'asc' ? 'desc' : 'asc'
}

function useSort() {
  const { sort, setSort } = useUserListContext()

  const handleSort = (by: Sort['by']) => {
    setSort(prev => ({
      by,
      order: prev.by === by ? toggleSort(sort.order) : sort.order,
    }))
  }

  return { handleSort }
}

export default useSort
