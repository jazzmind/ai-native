export interface ActivityEntry {
  id: string;
  conversation_id: string;
  coach_key: string;
  event_type: string;
  event_data: string;
  created_at: string;
}

export interface ActivityProvider {
  readonly type: string;

  add(
    userId: string,
    conversationId: string,
    coachKey: string,
    eventType: string,
    eventData?: Record<string, unknown>,
  ): Promise<void>;

  listByConversation(userId: string, conversationId: string): Promise<ActivityEntry[]>;

  isAvailable(): Promise<boolean>;
}
