// store/panelSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface SplitPanelState {
  [key: string]: number // 面板标识 -> 宽度比例
}

const initialState: SplitPanelState = {}

const splitPanelSlice = createSlice({
  name: 'split-panel',
  initialState,
  reducers: {
    setSplitPanelSize: (state, action: PayloadAction<{ key: string; size: number }>) => {
      state[action.payload.key] = action.payload.size
    }
  }
})

export const { setSplitPanelSize } = splitPanelSlice.actions
export default splitPanelSlice.reducer
