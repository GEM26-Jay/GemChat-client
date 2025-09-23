// store/store.ts
import { configureStore } from '@reduxjs/toolkit'
import splitPanelReducer, { SplitPanelState } from './sliceSplitPanel'
import messageCursorReducer, { MessageCursorState } from './messageCursor'
// 显式定义 RootState
export interface RootState {
  splitPanel: SplitPanelState
  messageCursor: MessageCursorState
}

export type AppDispatch = typeof store.dispatch

const store = configureStore({
  reducer: {
    splitPanel: splitPanelReducer,
    messageCursor: messageCursorReducer
  }
})

export default store
