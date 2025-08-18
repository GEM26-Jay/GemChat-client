// store/store.ts
import { configureStore } from '@reduxjs/toolkit'
import splitPanelReducer, { SplitPanelState } from './sliceSplitPanel'

// 显式定义 RootState
export interface RootState {
  splitPanel: SplitPanelState
}

export type AppDispatch = typeof store.dispatch

const store = configureStore({
  reducer: {
    splitPanel: splitPanelReducer
  }
})

export default store
