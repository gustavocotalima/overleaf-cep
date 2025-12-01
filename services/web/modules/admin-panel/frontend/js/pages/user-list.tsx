import { createRoot } from 'react-dom/client'
import UserListRoot from '../user-list/components/user-list-root'

const element = document.getElementById('user-list-root')
if (element) {
  const root = createRoot(element)
  root.render(<UserListRoot />)
}
