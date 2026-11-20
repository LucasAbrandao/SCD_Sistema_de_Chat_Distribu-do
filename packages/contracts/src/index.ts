export type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'DEPENDENCY_UNAVAILABLE' | 'NOT_IMPLEMENTED' | 'INTERNAL_ERROR';
export interface ApiError { error: { code: ErrorCode; message: string; requestId: string } }
export interface User { id: string; username: string }
export interface RegisterInput { username: string; password: string }
export interface LoginInput extends RegisterInput {}
export interface LoginResult { accessToken: string; tokenType: 'Bearer'; expiresIn: number; user: User }
export interface Conversation { id: string; type: 'private' | 'group'; name: string | null; participantIds: string[]; createdAt: string }
export interface CreateConversation { type: 'private' | 'group'; name?: string; participantIds: string[] }
export interface Message { id: string; conversationId: string; senderId: string; clientMessageId: string; content: string; position: string; createdAt: string }
export interface SendMessage { conversationId: string; clientMessageId: string; content: string }
export type MessageAck = { ok: true; message: Message } | { ok: false; error: ApiError['error'] };
export interface ClientToServerEvents { 'message:send': (input: SendMessage, ack: (result: MessageAck) => void) => void }
export interface ServerToClientEvents { 'message:new': (message: Message) => void; 'auth:expired': () => void }
