import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/llm/reactAgent';
import { Buffer } from 'buffer';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { logger } from '@/lib/logger';
import { writeToFile } from '@/lib/logger-to-file';
import { availableModels } from '@/lib/llm/model-config';
import { TokenUsageInspector } from '@/lib/llm/token-usage-inspector';
import { isBatchImportData, parseBatchImportData, buildBatchImportPrompt } from '@/lib/llm/prompt-templates';
import { contextManager } from '@/lib/llm/context-manager';
import { MessageAttachment } from '@/lib/llm/context-store';
import { normalizeMessageChunk } from '@/lib/llm/normalizer';
import { AssistantAccumulator } from '@/lib/llm/assistant-accumulator';
import { encodeSSE } from '@/lib/llm/sse-serializer';

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    const t_receive = Date.now();
    logger.info('1. 收到请求:' + t_receive);

    // 1) 解析 FormData
    const t_before_form = Date.now();
    const formData = await request.formData();
    logger.info('2. FormData 解析耗时:' + (Date.now() - t_before_form) + ' ms');

    const prompt = (formData.get('prompt') as string) || '';
    const contextJson = (formData.get('contextJson') as any) || {};
    const model = (formData.get('model') as string) || 'gpt-4o';
    const files = (formData.getAll('files') as File[]) || [];
    const conversationId = contextJson?.conversationId || null;

    // ========== 上下文系统集成 ==========
    let currentConversationId = conversationId;

    if (!currentConversationId) {
      const contextData = contextJson;
      currentConversationId = await contextManager.createConversation({
        title: prompt.slice(0, 50) || '新对话',
        model,
        labId: contextData.labId,
        projectId: contextData.projectId,
        reportId: contextData.reportId,
      });
      logger.info(`[Context] 创建新对话: ${currentConversationId}`);
    }

    // 构建用户消息内容
    let userText = prompt || '';
    if (contextJson) {
      logger.debug(`[Context] JSON: ${contextJson}`);
    }

    // 文件处理（async-api-routes：Promise 尽早启动，避免串行等待）
    const processedFiles: Array<{
      file: File;
      type: 'image' | 'json' | 'md';
      content: string;
      dataUrl?: string;
    }> = [];
    const messageAttachments: MessageAttachment[] = [];

    for (const file of files) {
      if (file.type?.startsWith('image/')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
        userText += `\n\n[图片文件: ${file.name}] (已作为视觉输入上传)\n`;
        processedFiles.push({ file, type: 'image', content: '', dataUrl });
        messageAttachments.push({ name: file.name, type: 'image', content: dataUrl, size: file.size });
      } else if (file.name?.toLowerCase().endsWith('.md') || file.type === 'text/markdown') {
        const mdText = await file.text();
        userText += `\n\n[Markdown: ${file.name}]\n${mdText}\n`;
        processedFiles.push({ file, type: 'md', content: mdText });
        messageAttachments.push({ name: file.name, type: 'md', content: mdText, size: file.size });
      } else if (file.type === 'application/json' || file.name?.toLowerCase().endsWith('.json')) {
        const jsonText = await file.text();
        userText += `\n\n[JSON: ${file.name}]\n\`\`\`json\n${jsonText}\n\`\`\`\n`;
        processedFiles.push({ file, type: 'json', content: jsonText });
        messageAttachments.push({ name: file.name, type: 'json', content: jsonText, size: file.size });
      }
    }

    // 保存用户消息到数据库
    const userMessageId = await contextManager.addUserMessage(
      currentConversationId,
      userText.trim(),
      {
        attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
        metadata: { hasFiles: files.length > 0, fileCount: files.length },
      }
    );
    logger.info(`[Context] 保存用户消息: ${userMessageId}`);

    // 构建 LangChain 消息内容
    const messageContent: any[] = [{ type: 'text', text: userText.trim() }];
    for (const pf of processedFiles) {
      if (pf.type === 'image' && pf.dataUrl) {
        messageContent.push({ type: 'image_url', image_url: { url: pf.dataUrl } });
      }
    }

    // 获取历史消息并构建输入
    const inputMessages: Array<HumanMessage | AIMessage> = [];
    const historyMessages = await contextManager.getContextForLLM(currentConversationId);
    for (const msg of historyMessages) {
      if (msg.role === 'user') {
        inputMessages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        inputMessages.push(new AIMessage(msg.content));
      }
    }
    inputMessages.push(new HumanMessage({ content: messageContent }));

    // 批量导入检测
    if (isBatchImportData(prompt)) {
      const batchData = parseBatchImportData(prompt);
      if (batchData) {
        inputMessages[inputMessages.length - 1] = new HumanMessage(buildBatchImportPrompt(batchData));
        logger.info('检测到批量导入任务，共 ' + batchData.projects.length + ' 个项目');
      }
    }

    const t_before_graph = Date.now();
    logger.info('3. 进入 Graph 准备时间:' + (t_before_graph - t_receive) + ' ms');
    logger.info('4. 输入消息:' + inputMessages.length);
    logger.info('5. 文件处理:' + processedFiles.length + ' 个文件');
    logger.info('6. 上下文系统:' + (historyMessages.length > 0 ? `从历史加载 ${historyMessages.length} 条消息` : '新对话'));

    const tokenInspector = new TokenUsageInspector();
    const agent = await getAgent(availableModels.find(m => m.model === model) || availableModels[0]);
    const eventStream = await agent.stream(
      { messages: inputMessages },
      { streamMode: ['updates', 'messages'], callbacks: [tokenInspector] }
    );
    const streamStart = Date.now();
    logger.info('Graph 开始执行:' + (streamStart - startTime) + ' ms');

    // ========== 归一化 SSE 流水线 ==========
    let assistantMessageId: string | null = null;
    const accumulator = new AssistantAccumulator();

    const runtimeStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of eventStream) {
            if (!Array.isArray(event) || event.length !== 2) continue;
            const [streamMode, chunk] = event;
            writeToFile(streamMode, chunk);

            if (streamMode === 'messages') {
              const [messageChunk, metadata] = chunk as [unknown, { langgraph_node?: string }];

              // 归一化：所有厂商 chunk → StandardLLMEvent[]
              const normalizedEvents = normalizeMessageChunk(messageChunk, metadata);

              for (const e of normalizedEvents) {
                // TTFT 埋点（首个 content 事件）
                if (e.type === 'content' && firstTokenTime === null) {
                  firstTokenTime = Date.now();
                  logger.info(`首字耗时 (TTFT): ${firstTokenTime - startTime}ms`);
                  controller.enqueue(encodeSSE({ type: 'metrics', ttft: firstTokenTime - startTime }));
                }

                // 分字段累积（修复 assistantContent 丢失）
                accumulator.feed(e);

                // 发送 SSE
                controller.enqueue(encodeSSE(e));
              }

            } else if (streamMode === 'updates') {
              logger.info(`[Node Update] 节点 ${Object.keys(event[1] ?? {})[0]} 执行耗时:` + (Date.now() - streamStart) + ' ms');
              controller.enqueue(encodeSSE({ type: 'status', text: '工具执行完成，正在整合结果...' }));
            }
          }

          // 流结束：将累积内容存入数据库
          if (accumulator.hasContent()) {
            const { content, reasoning } = accumulator.toSavePayload();
            assistantMessageId = await contextManager.addAssistantMessage(
              currentConversationId,
              content,
              { messageType: 'content', metadata: reasoning ? { reasoning } : undefined }
            );
            logger.info(`[Context] 保存助手消息: ${assistantMessageId}`);
          }

        } catch (err) {
          logger.error('Stream Error:' + err);
          controller.enqueue(encodeSSE({ type: 'error', text: String(err) }));
        } finally {
          const endTime = Date.now();
          const totalDuration = endTime - startTime;
          logger.info(`总生成耗时: ${totalDuration}ms`);

          const tokenUsage = tokenInspector.getTokenUsage();
          logger.info('[TokenUsage] 最终使用量: ' + JSON.stringify(tokenUsage));

          // 更新 Token 使用量
          if (assistantMessageId && tokenUsage) {
            try {
              await contextManager.updateMessageTokens(
                assistantMessageId,
                tokenUsage.promptTokens || 0,
                tokenUsage.completionTokens || 0
              );
              logger.info(`[Context] 更新消息 Token 使用量: ${assistantMessageId}`);
            } catch (error) {
              logger.error({ error }, `[Context] 更新 Token 使用量失败`);
            }
          }

          // 发送结束指标
          controller.enqueue(encodeSSE({
            type: 'metrics',
            total_duration: totalDuration,
            pure_generate_duration: endTime - (firstTokenTime || endTime),
            token_usage: {
              inputTokens: tokenUsage.promptTokens || 0,
              outputTokens: tokenUsage.completionTokens || 0,
              totalTokens: tokenUsage.totalTokens || 0,
            },
            conversation_id: currentConversationId,
          }));

          controller.close();
        }
      },
    });

    return new Response(runtimeStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Server-Timing': `pre;desc="Pre-processing";dur=${Date.now() - startTime}`,
        'X-Conversation-Id': currentConversationId,
      },
    });

  } catch (error) {
    logger.error({ error }, 'LLM API error:');
    return NextResponse.json(
      { error: 'Failed to process LLM request' },
      { status: 500 }
    );
  }
}
