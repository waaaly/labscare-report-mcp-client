import { prisma } from '@/lib/prisma';
import { MessageRole, Message, Conversation } from '@prisma/client';
import { logger } from '@/lib/logger';

// 消息附件类型
export interface MessageAttachment {
  name: string;
  type: 'image' | 'json' | 'md' | 'file';
  url?: string;
  content?: string;
  size?: number;
}

// 创建消息参数
export interface CreateMessageParams {
  role: MessageRole;
  content: string;
  contentType?: string;
  messageType?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: Record<string, any>;
  inputTokens?: number;
  outputTokens?: number;
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
}

// 创建对话参数
export interface CreateConversationParams {
  title?: string;
  model?: string;
  labId?: string;
  projectId?: string;
  reportId?: string;
  metadata?: Record<string, any>;
}

// 更新对话参数
export interface UpdateConversationParams {
  title?: string;
  model?: string;
  labId?: string | null;
  projectId?: string | null;
  reportId?: string | null;
  metadata?: Record<string, any>;
}

// 查询选项
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}

// 上下文存储类
export class ContextStore {
  // ========== 对话管理 ==========
  
  /**
   * 创建新对话
   */
  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    try {
      const conversation = await prisma.conversation.create({
        data: {
          title: params.title || '新对话',
          model: params.model || 'gpt-4o',
          labId: params.labId,
          projectId: params.projectId,
          reportId: params.reportId,
          metadata: params.metadata || {},
        },
      });
      
      logger.info(`[ContextStore] 创建对话: ${conversation.id}`);
      return conversation;
    } catch (error) {
      logger.error('[ContextStore] 创建对话失败:', error);
      throw error;
    }
  }

  /**
   * 获取对话
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      return await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { sequence: 'asc' },
          },
        },
      });
    } catch (error) {
      logger.error(`[ContextStore] 获取对话失败: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * 更新对话
   */
  async updateConversation(
    conversationId: string,
    params: UpdateConversationParams
  ): Promise<Conversation> {
    try {
      const data: any = {};
      
      if (params.title !== undefined) data.title = params.title;
      if (params.model !== undefined) data.model = params.model;
      if (params.labId !== undefined) data.labId = params.labId;
      if (params.projectId !== undefined) data.projectId = params.projectId;
      if (params.reportId !== undefined) data.reportId = params.reportId;
      if (params.metadata !== undefined) data.metadata = params.metadata;
      
      return await prisma.conversation.update({
        where: { id: conversationId },
        data,
      });
    } catch (error) {
      logger.error(`[ContextStore] 更新对话失败: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await prisma.conversation.delete({
        where: { id: conversationId },
      });
      logger.info(`[ContextStore] 删除对话: ${conversationId}`);
    } catch (error) {
      logger.error(`[ContextStore] 删除对话失败: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * 列出对话
   */
  async listConversations(options: QueryOptions = {}): Promise<Conversation[]> {
    const { limit = 50, offset = 0, orderBy = 'desc' } = options;
    
    try {
      return await prisma.conversation.findMany({
        orderBy: { createdAt: orderBy },
        skip: offset,
        take: limit,
      });
    } catch (error) {
      logger.error('[ContextStore] 列出对话失败:', error);
      throw error;
    }
  }

  // ========== 消息管理 ==========

  /**
   * 添加消息到对话
   */
  async addMessage(
    conversationId: string,
    params: CreateMessageParams
  ): Promise<Message> {
    try {
      // 获取当前消息数用于计算 sequence
      const count = await prisma.message.count({
        where: { conversationId },
      });

      const message = await prisma.message.create({
        data: {
          conversationId,
          role: params.role,
          content: params.content,
          contentType: params.contentType || 'text',
          messageType: params.messageType,
          toolName: params.toolName,
          toolInput: params.toolInput,
          toolOutput: params.toolOutput,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          attachments: params.attachments || [],
          metadata: params.metadata || {},
          sequence: count,
        },
      });

      // 更新对话统计
      await this.updateConversationStats(conversationId);

      logger.info(`[ContextStore] 添加消息: ${message.id} 到对话: ${conversationId}`);
      return message;
    } catch (error) {
      logger.error(`[ContextStore] 添加消息失败: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * 批量添加消息
   */
  async addMessages(
    conversationId: string,
    messages: CreateMessageParams[]
  ): Promise<Message[]> {
    try {
      // 获取当前消息数
      const count = await prisma.message.count({
        where: { conversationId },
      });

      const createdMessages: Message[] = [];
      
      for (let i = 0; i < messages.length; i++) {
        const params = messages[i];
        const message = await prisma.message.create({
          data: {
            conversationId,
            role: params.role,
            content: params.content,
            contentType: params.contentType || 'text',
            messageType: params.messageType,
            toolName: params.toolName,
            toolInput: params.toolInput,
            toolOutput: params.toolOutput,
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            attachments: params.attachments || [],
            metadata: params.metadata || {},
            sequence: count + i,
          },
        });
        createdMessages.push(message);
      }

      // 更新对话统计
      await this.updateConversationStats(conversationId);

      logger.info(`[ContextStore] 批量添加 ${messages.length} 条消息到对话: ${conversationId}`);
      return createdMessages;
    } catch (error) {
      logger.error(`[ContextStore] 批量添加消息失败: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * 获取对话消息
   */
  async getMessages(
    conversationId: string,
    options: QueryOptions = {}
  ): Promise<Message[]> {
    const { limit, offset = 0, orderBy = 'asc' } = options;
    
    try {
      return await prisma.message.findMany({
        where: { conversationId },
        orderBy: { sequence: orderBy },
        skip: offset,
        take: limit,
      });
    } catch (error) {
      logger.error(`[ContextStore] 获取消息失败: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * 获取最近 N 条消息
   */
  async getRecentMessages(
    conversationId: string,
    count: number
  ): Promise<Message[]> {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { sequence: 'desc' },
        take: count,
      });
      
      // 返回按 sequence 升序排列的消息
      return messages.reverse();
    } catch (error) {
      logger.error(`[ContextStore] 获取最近消息失败: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * 删除消息
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const message = await prisma.message.delete({
        where: { id: messageId },
      });
      
      // 更新对话统计
      await this.updateConversationStats(message.conversationId);
      
      logger.info(`[ContextStore] 删除消息: ${messageId}`);
    } catch (error) {
      logger.error(`[ContextStore] 删除消息失败: ${messageId}`, error);
      throw error;
    }
  }

  /**
   * 清空对话消息
   */
  async clearMessages(conversationId: string): Promise<void> {
    try {
      await prisma.message.deleteMany({
        where: { conversationId },
      });
      
      // 重置对话统计
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          messageCount: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
        },
      });
      
      logger.info(`[ContextStore] 清空对话消息: ${conversationId}`);
    } catch (error) {
      logger.error(`[ContextStore] 清空消息失败: ${conversationId}`, error);
      throw error;
    }
  }

  // ========== 统计更新 ==========

  /**
   * 更新对话统计信息
   */
  private async updateConversationStats(conversationId: string): Promise<void> {
    try {
      const stats = await prisma.message.aggregate({
        where: { conversationId },
        _count: { id: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
      });

      const messageCount = stats._count.id;
      const totalInputTokens = stats._sum.inputTokens || 0;
      const totalOutputTokens = stats._sum.outputTokens || 0;
      const totalTokens = totalInputTokens + totalOutputTokens;

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          messageCount,
          totalInputTokens,
          totalOutputTokens,
          totalTokens,
        },
      });
    } catch (error) {
      logger.error(`[ContextStore] 更新统计失败: ${conversationId}`, error);
    }
  }

  // ========== Token 管理 ==========

  /**
   * 更新消息 Token 使用量
   */
  async updateMessageTokens(
    messageId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    try {
      const message = await prisma.message.update({
        where: { id: messageId },
        data: {
          inputTokens,
          outputTokens,
        },
      });

      // 更新对话统计
      await this.updateConversationStats(message.conversationId);
    } catch (error) {
      logger.error(`[ContextStore] 更新 Token 失败: ${messageId}`, error);
      throw error;
    }
  }
}

// 导出单例
export const contextStore = new ContextStore();
