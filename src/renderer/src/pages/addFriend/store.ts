import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit'

// 1. 定义状态类型
interface SearchState {
  keyword: string
}

// 2. 初始状态
const initialState: SearchState = {
  keyword: ''
}

// 3. 创建slice
const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    // 修正：直接更新keyword字段
    setKeyword: (state, action: PayloadAction<string>) => {
      state.keyword = action.payload
    }
  }
})

// 4. 导出actions
export const { setKeyword } = searchSlice.actions

// 5. 创建store
const store = configureStore({
  reducer: {
    search: searchSlice.reducer
  }
})

// 6. 导出类型
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store
