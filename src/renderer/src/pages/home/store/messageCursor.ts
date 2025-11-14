import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface MessageCursorState {
  [key: string]: number
}

const initialState: MessageCursorState = {}

const messageCursorSlice = createSlice({
  name: 'messageCursor',
  initialState,
  reducers: {
    setMessageCursor: (state, action: PayloadAction<{ key: string; timestamp: number }>) => {
      state[action.payload.key] = action.payload.timestamp
    }
  }
})

export const { setMessageCursor } = messageCursorSlice.actions
export default messageCursorSlice.reducer
