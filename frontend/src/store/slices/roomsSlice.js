import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  types: [],
  rooms: [],
  blocks: [],
  rules: [],
  isLoaded: false,
};

export const roomsSlice = createSlice({
  name: 'rooms',
  initialState,
  reducers: {
    setRoomsData: (state, action) => {
      const { types, rooms, blocks, rules } = action.payload || {};
      if (Array.isArray(types)) state.types = types;
      if (Array.isArray(rooms)) state.rooms = rooms;
      if (Array.isArray(blocks)) state.blocks = blocks;
      if (Array.isArray(rules)) state.rules = rules;
      state.isLoaded = true;
    },
    // Instant optimistic update for room category / type
    updateRoomTypeOptimistic: (state, action) => {
      const updated = action.payload;
      if (!updated?.id) return;
      const index = state.types.findIndex((t) => t.id === updated.id);
      if (index !== -1) {
        state.types[index] = { ...state.types[index], ...updated };
      }
    },
    addRoomTypeOptimistic: (state, action) => {
      const newType = action.payload;
      if (!newType) return;
      const id = newType.id || `temp-${Date.now()}`;
      state.types.unshift({ ...newType, id });
    },
    deleteRoomTypeOptimistic: (state, action) => {
      const id = action.payload;
      state.types = state.types.filter((t) => t.id !== id);
    },
    // Instant optimistic update for physical room number
    addRoomOptimistic: (state, action) => {
      const room = action.payload;
      if (!room) return;
      const id = room.id || `temp-room-${Date.now()}`;
      // Check if room with this number already exists and replace, else append
      const existingIdx = state.rooms.findIndex((r) => String(r.number || r.room_number) === String(room.number || room.room_number));
      if (existingIdx !== -1) {
        state.rooms[existingIdx] = { ...state.rooms[existingIdx], ...room, id: room.id || state.rooms[existingIdx].id };
      } else {
        state.rooms.push({ ...room, id });
      }
    },
    updateRoomOptimistic: (state, action) => {
      const updated = action.payload;
      if (!updated?.id) return;
      const index = state.rooms.findIndex((r) => r.id === updated.id);
      if (index !== -1) {
        state.rooms[index] = { ...state.rooms[index], ...updated };
      }
    },
    deleteRoomOptimistic: (state, action) => {
      const id = action.payload;
      state.rooms = state.rooms.filter((r) => r.id !== id);
    },
    // Instant optimistic update for blocked dates
    addBlockedDateOptimistic: (state, action) => {
      const block = action.payload;
      if (!block) return;
      const id = block.id || `temp-block-${Date.now()}`;
      state.blocks.unshift({ ...block, id });
    },
    deleteBlockedDateOptimistic: (state, action) => {
      const id = action.payload;
      state.blocks = state.blocks.filter((b) => b.id !== id);
    },
    // Instant optimistic update for pricing rules
    addPricingRuleOptimistic: (state, action) => {
      const rule = action.payload;
      if (!rule) return;
      const id = rule.id || `temp-rule-${Date.now()}`;
      state.rules.unshift({ ...rule, id });
    },
    deletePricingRuleOptimistic: (state, action) => {
      const id = action.payload;
      state.rules = state.rules.filter((r) => r.id !== id);
    },
  },
});

export const {
  setRoomsData,
  updateRoomTypeOptimistic,
  addRoomTypeOptimistic,
  deleteRoomTypeOptimistic,
  addRoomOptimistic,
  updateRoomOptimistic,
  deleteRoomOptimistic,
  addBlockedDateOptimistic,
  deleteBlockedDateOptimistic,
  addPricingRuleOptimistic,
  deletePricingRuleOptimistic,
} = roomsSlice.actions;

export default roomsSlice.reducer;

