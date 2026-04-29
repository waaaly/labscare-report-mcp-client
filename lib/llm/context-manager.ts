import { MessageRole, Message } from '@prisma/client';
import { contextStore, CreateMessageParams, MessageAttachment } from './context-store';
import { logger } from '@/lib/logger';

// LangChain 消息格式
export interface LangChainMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
  additional_kwargs?: Record<string, any>;
}

// 上下文配置
export interface ContextConfig {
  // 传给 LLM 的最大消息数
  maxMessagesForLLM: number;
  // 系统提示词
  systemPrompt?: string;
  // 是否包含工具调用详情
  includeToolCalls: boolean;
  // 是否包含思考过程
  includeThoughts: boolean;
  // Token 限制（用于未来扩展智能截断）
  maxTokens?: number;
}

// 默认配置
const DEFAULT_CONFIG: ContextConfig = {
  maxMessagesForLLM: 20,
  includeToolCalls: true,
  includeThoughts: false,
  maxTokens: 8000,
};

// 上下文管理器
export class ContextManager {
  private config: ContextConfig;

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 创建新对话
   */
  async createConversation(params: {
    title?: string;
    model?: string;
    labId?: string;
    projectId?: string;
    reportId?: string;
  }): Promise<string> {
    const conversation = await contextStore.createConversation({
      title: params.title,
      model: params.model,
      labId: params.labId,
      projectId: params.projectId,
      reportId: params.reportId,
    });
    
    return conversation.id;
  }

  /**
   * 更新对话
   */
  async updateConversation(
    conversationId: string,
    params: {
      title?: string;
      model?: string;
      labId?: string | null;
      projectId?: string | null;
      reportId?: string | null;
    }
  ): Promise<void> {
    await contextStore.updateConversation(conversationId, {
      title: params.title,
      model: params.model,
      labId: params.labId,
      projectId: params.projectId,
      reportId: params.reportId,
    });
  }

  /**
   * 添加用户消息
   */
  async addUserMessage(
    conversationId: string,
    content: string,
    options: {
      attachments?: MessageAttachment[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const message = await contextStore.addMessage(conversationId, {
      role: MessageRole.USER,
      content,
      contentType: 'text',
      attachments: options.attachments,
      metadata: options.metadata,
    });
    
    return message.id;
  }

  /**
   * 添加助手消息（支持流式更新）
   */
  async addAssistantMessage(
    conversationId: string,
    content: string,
    options: {
      messageType?: string;
      inputTokens?: number;
      outputTokens?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const message = await contextStore.addMessage(conversationId, {
      role: MessageRole.ASSISTANT,
      content,
      contentType: 'text',
      messageType: options.messageType,
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
      metadata: options.metadata,
    });
    
    return message.id;
  }

  /**
   * 添加工具调用消息
   */
  async addToolMessage(
    conversationId: string,
    toolName: string,
    toolInput: Record<string, any>,
    toolOutput: Record<string, any>,
    options: {
      content?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const content = options.content || `[Tool Call: ${toolName}]`;
    
    const message = await contextStore.addMessage(conversationId, {
      role: MessageRole.TOOL,
      content,
      contentType: 'json',
      messageType: 'tool_call',
      toolName,
      toolInput,
      toolOutput,
      metadata: options.metadata,
    });
    
    return message.id;
  }

  /**
   * 添加系统消息
   */
  async addSystemMessage(
    conversationId: string,
    content: string,
    options: {
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const message = await contextStore.addMessage(conversationId, {
      role: MessageRole.SYSTEM,
      content,
      contentType: 'text',
      messageType: 'system',
      metadata: options.metadata,
    });
    
    return message.id;
  }

  /**
   * 更新消息内容（用于流式响应）
   */
  async updateMessageContent(
    messageId: string,
    content: string
  ): Promise<void> {
    // 由于 Prisma 不支持部分更新 text 字段，这里需要通过 store 实现
    // 实际项目中可能需要使用原生 SQL 或重新设计
    logger.info(`[ContextManager] 更新消息内容: ${messageId}`);
    // TODO: 实现增量更新逻辑
  }

  /**
   * 更新消息 Token 使用量
   */
  async updateMessageTokens(
    messageId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    await contextStore.updateMessageTokens(messageId, inputTokens, outputTokens);
  }

  /**
   * 获取完整上下文（用于数据库存储层）
   */
  async getFullContext(conversationId: string): Promise<Message[]> {
    return await contextStore.getMessages(conversationId, {
      orderBy: 'asc',
    });
  }

  /**
   * 获取用于 LLM 的精简上下文
   * 这是核心方法，实现分层存储策略
   */
  async getContextForLLM(conversationId: string): Promise<LangChainMessage[]> {
    // 1. 获取最近 N 条消息
    const recentMessages = await contextStore.getRecentMessages(
      conversationId,
      this.config.maxMessagesForLLM
    );

    // 2. 转换为 LangChain 格式
    const langChainMessages: LangChainMessage[] = [];

    // 添加系统提示词（如果有）
    if (this.config.systemPrompt) {
      langChainMessages.push({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    // 转换消息
    for (const msg of recentMessages) {
      const lcMsg = this.convertToLangChainMessage(msg);
      if (lcMsg) {
        langChainMessages.push(lcMsg);
      }
    }

    logger.info(
      `[ContextManager] 对话 ${conversationId}: 获取 ${recentMessages.length} 条消息用于 LLM`
    );

    return langChainMessages;
  }

  /**
   * 获取对话统计信息
   */
  async getConversationStats(conversationId: string): Promise<{
    messageCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  } | null> {
    const conversation = await contextStore.getConversation(conversationId);
    if (!conversation) return null;

    return {
      messageCount: conversation.messageCount,
      totalInputTokens: conversation.totalInputTokens,
      totalOutputTokens: conversation.totalOutputTokens,
      totalTokens: conversation.totalTokens,
    };
  }

  /**
   * 清空对话上下文
   */
  async clearContext(conversationId: string): Promise<void> {
    await contextStore.clearMessages(conversationId);
    logger.info(`[ContextManager] 清空对话上下文: ${conversationId}`);
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await contextStore.deleteConversation(conversationId);
    logger.info(`[ContextManager] 删除对话: ${conversationId}`);
  }

  /**
   * 列出所有对话
   */
  async listConversations(options: { limit?: number; offset?: number } = {}) {
    return await contextStore.listConversations({
      limit: options.limit || 50,
      offset: options.offset || 0,
      orderBy: 'desc',
    });
  }

  // ========== 私有方法 ==========

  /**
   * 将数据库消息转换为 LangChain 格式
   */
  private convertToLangChainMessage(msg: Message): LangChainMessage | null {
    // 根据配置过滤消息类型
    if (msg.messageType === 'thought' && !this.config.includeThoughts) {
      return null;
    }

    if (msg.messageType === 'tool_call' && !this.config.includeToolCalls) {
      // 如果不包含工具调用，可以简化表示
      return {
        role: 'assistant',
        content: `[使用了工具: ${msg.toolName}]`,
      };
    }

    // 映射角色
    let role: 'user' | 'assistant' | 'system';
    switch (msg.role) {
      case MessageRole.USER:
        role = 'user';
        break;
      case MessageRole.ASSISTANT:
        role = 'assistant';
        break;
      case MessageRole.SYSTEM:
        role = 'system';
        break;
      case MessageRole.TOOL:
        // 工具消息作为 assistant 的 function_call 处理
        role = 'assistant';
        break;
      default:
        role = 'assistant';
    }

    // 构建内容
    let content = msg.content;

    // 如果有附件，添加到内容中
    if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      const attachments = msg.attachments as unknown as MessageAttachment[];
      const attachmentInfo = attachments
        .map((att) => `[附件: ${att.name} (${att.type})]`)
        .join('\n');
      content = `${content}\n\n${attachmentInfo}`;
    }

    // 构建 additional_kwargs
    const additional_kwargs: Record<string, any> = {};
    if (msg.toolName) {
      additional_kwargs.function_call = {
        name: msg.toolName,
        arguments: msg.toolInput,
      };
    }
    if (msg.toolOutput) {
      additional_kwargs.function_output = msg.toolOutput;
    }

    return {
      role,
      content,
      ...(msg.toolName && { name: msg.toolName }),
      ...(Object.keys(additional_kwargs).length > 0 && { additional_kwargs }),
    };
  }

  /**
   * 估算消息的 Token 数量（简化版）
   * 实际项目中可以使用 tiktoken 等库
   */
  private estimateTokens(content: string): number {
    // 粗略估算：中文 1 字符 ≈ 1.5 token，英文 1 单词 ≈ 1.3 token
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = content.length - chineseChars - englishWords;
    
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5);
  }
}

// 导出单例
export const contextManager = new ContextManager();
