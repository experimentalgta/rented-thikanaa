import { Conversation } from '../types';

export interface OtherParticipantInfo {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
}

/**
 * Dynamically resolves the other participant in a conversation relative to the current logged-in user.
 * Symmetrically works for:
 * - Student -> Property Owner (shows Owner name & avatar)
 * - Property Owner -> Student (shows Student name & avatar)
 * - Roommate inquiries between two students
 */
export function getOtherParticipant(
  conversation: Conversation | null | undefined,
  currentUserId?: string
): OtherParticipantInfo {
  if (!conversation) {
    return { id: '', name: 'User', avatar: undefined, initials: 'U' };
  }

  // Find the other participant's ID
  const otherId = conversation.participant_ids?.find((id) => id !== currentUserId) || '';

  // Get name from participant_names map
  let name = otherId ? conversation.participant_names?.[otherId] : undefined;

  // If not found by otherId or matches generic placeholders, try other entries
  if (!name || name === 'User A' || name === 'User B') {
    const altKeys = Object.keys(conversation.participant_names || {}).filter((k) => k !== currentUserId);
    if (altKeys.length > 0 && conversation.participant_names[altKeys[0]]) {
      const candidate = conversation.participant_names[altKeys[0]];
      if (candidate && candidate !== 'User A' && candidate !== 'User B') {
        name = candidate;
      }
    }
  }

  // Graceful fallback if name is still placeholder or absent
  if (!name || name === 'User A' || name === 'User B') {
    name = 'Property Host';
  }

  const avatar = otherId
    ? conversation.participant_avatars?.[otherId]
    : Object.entries(conversation.participant_avatars || {}).find(([k]) => k !== currentUserId)?.[1];

  const initials = (name.trim().charAt(0) || 'U').toUpperCase();

  return {
    id: otherId,
    name: name.trim(),
    avatar,
    initials,
  };
}
