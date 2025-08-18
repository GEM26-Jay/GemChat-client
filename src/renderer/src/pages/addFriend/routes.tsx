import { createBrowserRouter } from 'react-router-dom'
import SearchUserBoard from './SearchUserBoard'
import AddFriendBoard from './AddFriendBoard'

const router = createBrowserRouter([
  {
    path: '/addFriend',
    element: <SearchUserBoard></SearchUserBoard>
  },
  {
    path: '/addRequest/:id',
    element: <AddFriendBoard></AddFriendBoard>
  }
])

export default router
