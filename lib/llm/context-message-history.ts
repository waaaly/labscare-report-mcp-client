import { BaseChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { MessageRole } from '@prisma/client';
import { contextManager, LangChainMessage } from './context-manager';
import { logger } from '@/lib/logger';

/**
 * LangChain 集成的消息历史类
 * 实现 BaseChatMessageHistory 接口，与 LangChain Agent 无缝集成
 */
export class ContextChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace = ['langchain', 'chat_history'];
  
  private conversationId: string;
  private systemPrompt?: string;
  private messageCache: BaseMessage[] = [];
  private cacheValid = false;

  constructor(conversationId: string, systemPrompt?: string) {
    super();
    this.conversationId = conversationId;
    this.systemPrompt = systemPrompt;
  }

  /**
   * 获取所有消息（实现基类方法）
   * 从数据库获取消息并转换为 LangChain 格式
   */
  async getMessages(): Promise<BaseMessage[]> {
    // 如果缓存有效，直接返回缓存
    if (this.cacheValid && this.messageCache.length > 0) {
      return this.messageCache;
    }

    try {
      // 从上下文管理器获取消息
      const messages = await contextManager.getContextForLLM(this.conversationId);
      
      // 转换为 LangChain BaseMessage
      const baseMessages = this.convertToBaseMessages(messages);
      
      // 更新缓存
      this.messageCache = baseMessages;
      this.cacheValid = true;
      
      return baseMessages;
    } catch (error) {
      logger.error(`[ContextChatMessageHistory] 获取消息失败: ${this.conversationId}`, error);
      return [];
    }
  }

  /**
   * 添加用户消息
   */
  async addUserMessage(message: string | BaseMessage): Promise<void> {
    const content = typeof message === 'string' ? message : message.content.toString();
    
    await contextManager.addUserMessage(this.conversationId, content);
    
    // 使缓存失效
    this.invalidateCache();
    
    logger.info(`[ContextChatMessageHistory] 添加用户消息到对话: ${this.conversationId}`);
  }

  /**
   * 添加 AI 消息
   */
  async addAIChatMessage(message: string | BaseMessage, metadata?: Record<string, any>): Promise<void> {
    const content = typeof message === 'string' ? message : message.content.toString();
    
    await contextManager.addAssistantMessage(this.conversationId, content, {
      metadata,
    });
    
    // 使缓存失效
    this.invalidateCache();
    
    logger.info(`[ContextChatMessageHistory] 添加 AI 消息到对话: ${this.conversationId}`);
  }

  /**
   * 添加消息（通用方法，LangChain 内部调用）
   */
  async addMessage(message: BaseMessage): Promise<void> {
    if (message instanceof HumanMessage) {
      await this.addUserMessage(message);
    } else if (message instanceof AIMessage) {
      await this.addAIChatMessage(message);
    } else if (message instanceof SystemMessage) {
      // 系统消息通常不存储，或者存储在对话配置中
      logger.info(`[ContextChatMessageHistory] 忽略系统消息存储`);
    } else if (message instanceof ToolMessage) {
      // 工具消息
      await contextManager.addToolMessage(
        this.conversationId,
        message.name || 'unknown',
        {}, // tool_input 需要从消息中提取
        { content: message.content }, // tool_output
        { content: message.content.toString() }
      );
      this.invalidateCache();
    } else {
      // 其他类型消息
      await contextManager.addAssistantMessage(this.conversationId, message.content.toString(), {
        metadata: { messageType: 'unknown', originalType: message._getType() },
      });
      this.invalidateCache();
    }
  }

  /**
   * 添加消息列表
   */
  async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  /**
   * 清空消息历史
   */
  async clear(): Promise<void> {
    await contextManager.clearContext(this.conversationId);
    this.messageCache = [];
    this.cacheValid = true;
    
    logger.info(`[ContextChatMessageHistory] 清空对话: ${this.conversationId}`);
  }

  /**
   * 使缓存失效
   */
  invalidateCache(): void {
    this.cacheValid = false;
  }

  // ========== 私有方法 ==========

  /**
   * 将 LangChainMessage 转换为 BaseMessage
   */
  private convertToBaseMessages(messages: LangChainMessage[]): BaseMessage[] {
    const baseMessages: BaseMessage[] = [];

    // 添加系统提示词
    if (this.systemPrompt) {
      baseMessages.push(new SystemMessage(this.systemPrompt));
    }

    for (const msg of messages) {
      const baseMsg = this.convertSingleMessage(msg);
      if (baseMsg) {
        baseMessages.push(baseMsg);
      }
    }

    return baseMessages;
  }

  /**
   * 转换单条消息
   */
  private convertSingleMessage(msg: LangChainMessage): BaseMessage | null {
    const { role, content, name, additional_kwargs } = msg;

    switch (role) {
      case 'user':
        return new HumanMessage({
          content,
          name,
          additional_kwargs,
        });

      case 'assistant':
        return new AIMessage({
          content,
          name,
          additional_kwargs,
        });

      case 'system':
        return new SystemMessage({
          content,
          name,
          additional_kwargs,
        });

      default:
        logger.warn(`[ContextChatMessageHistory] 未知消息角色: ${role}`);
        return null;
    }
  }
}

/**
 * 创建消息历史实例的工厂函数
 */
export async function createContextMessageHistory(
  conversationId: string,
  systemPrompt?: string
): Promise<ContextChatMessageHistory> {
  return new ContextChatMessageHistory(conversationId, systemPrompt);
}

/**
 * 创建新对话并返回消息历史实例
 */
export async function createNewConversationWithHistory(
  params: {
    title?: string;
    model?: string;
    labId?: string;
    projectId?: string;
    reportId?: string;
    systemPrompt?: string;
  }
): Promise<{ conversationId: string; history: ContextChatMessageHistory }> {
  const conversationId = await contextManager.createConversation({
    title: params.title,
    model: params.model,
    labId: params.labId,
    projectId: params.projectId,
    reportId: params.reportId,
  });

  const history = new ContextChatMessageHistory(conversationId, params.systemPrompt);
  
  // 如果有系统提示词，添加到对话
  if (params.systemPrompt) {
    await contextManager.addSystemMessage(conversationId, params.systemPrompt);
  }

  return { conversationId, history };
}
