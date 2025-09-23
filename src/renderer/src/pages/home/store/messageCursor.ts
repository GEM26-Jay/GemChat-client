import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface MessageCursorState {
  [key: string]: string
}

const initialState: MessageCursorState = {}

const messageCursorSlice = createSlice({
  name: 'messageCursor',
  initialState,
  reducers: {
    setMessageCursor: (state, action: PayloadAction<{ key: string; messageId: string }>) => {
      state[action.payload.key] = action.payload.messageId
    }
  }
})

export const { setMessageCursor } = messageCursorSlice.actions
export default messageCursorSlice.reducer
