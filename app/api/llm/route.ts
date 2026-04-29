import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/llm/reactAgent';
import { Buffer } from 'buffer';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { logger} from '@/lib/logger'
import { writeToFile } from '@/lib/logger-to-file'
import { availableModels } from '@/lib/llm/model-config';
import { TokenUsageInspector, TokenUsageResult } from '@/lib/llm/token-usage-inspector';
import { isBatchImportData, parseBatchImportData, buildBatchImportPrompt } from '@/lib/llm/prompt-templates';
import { contextManager } from '@/lib/llm/context-manager';
import { MessageAttachment } from '@/lib/llm/context-store';
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now(); // T0: 请求开始
    let firstTokenTime: number | null = null; // T1: 首字时间
    const t_receive = Date.now();
    logger.info('1. 收到请求:'+t_receive);
    
    // 1) 解析 FormData
    const t_before_form = Date.now();
    const formData = await request.formData();
    logger.info('2. FormData 解析耗时:'+ (Date.now() - t_before_form) + ' ms');
    
    const prompt = (formData.get('prompt') as string) || '';
    const contextJson = (formData.get('contextJson') as string) || '';
    const messagesJson = (formData.get('messagesJson') as string) || null;
    const model = (formData.get('model') as string) || 'gpt-4o';
    const files = (formData.getAll('files') as File[]) || [];
    const conversationId = (formData.get('conversationId') as string) || null;

    // ========== 上下文系统集成 ==========
    let currentConversationId = conversationId;
    
    // 如果没有提供 conversationId，创建新对话
    if (!currentConversationId) {
      const contextData = contextJson ? JSON.parse(contextJson) : {};
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
      userText += `\n\n[Context]\n\`\`\`json\n${contextJson}\n\`\`\`\n`;
    }

    // 🔧 优化1：合并文件处理，避免重复读取文件
    const processedFiles: Array<{
      file: File;
      type: 'image' | 'json' | 'md';
      content: string;
      dataUrl?: string;
    }> = [];
    
    // 文件附件数组（用于存储到数据库）
    const messageAttachments: MessageAttachment[] = [];

    for (const file of files) {
      if (file.type?.startsWith('image/')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
        userText += `\n\n[图片文件: ${file.name}] (已作为视觉输入上传)\n`;
        processedFiles.push({
          file,
          type: 'image',
          content: '',
          dataUrl
        });
        // 添加到附件列表
        messageAttachments.push({
          name: file.name,
          type: 'image',
          content: dataUrl,
          size: file.size,
        });
      } else if (file.name?.toLowerCase().endsWith('.md') || file.type === 'text/markdown') {
        const mdText = await file.text();
        userText += `\n\n[Markdown: ${file.name}]\n${mdText}\n`;
        processedFiles.push({
          file,
          type: 'md',
          content: mdText
        });
        messageAttachments.push({
          name: file.name,
          type: 'md',
          content: mdText,
          size: file.size,
        });
      } else if (file.type === 'application/json' || file.name?.toLowerCase().endsWith('.json')) {
        const jsonText = await file.text();
        userText += `\n\n[JSON: ${file.name}]\n\`\`\`json\n${jsonText}\n\`\`\`\n`;
        processedFiles.push({
          file,
          type: 'json',
          content: jsonText
        });
        messageAttachments.push({
          name: file.name,
          type: 'json',
          content: jsonText,
          size: file.size,
        });
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

    const messageContent: any[] = [{ type: 'text', text: userText.trim() }];
    // 🔧 优化2：使用已处理的文件，避免重复读取
    for (const processedFile of processedFiles) {
      if (processedFile.type === 'image' && processedFile.dataUrl) {
        messageContent.push({
          type: 'image_url',
          image_url: { url: processedFile.dataUrl }
        });
      }
    }

    // 🔧 优化3：使用上下文系统获取历史消息
    const inputMessages: Array<HumanMessage | AIMessage> = [];
    
    // 从数据库获取历史消息（分层存储策略）
    const historyMessages = await contextManager.getContextForLLM(currentConversationId);
    
    // 转换为 LangChain 消息格式
    for (const msg of historyMessages) {
      if (msg.role === 'user') {
        inputMessages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        inputMessages.push(new AIMessage(msg.content));
      }
    }

    // 添加当前用户消息
    inputMessages.push(new HumanMessage({ content: messageContent }));

    if (isBatchImportData(prompt)) {
      const batchData = parseBatchImportData(prompt);
      if (batchData) {
        inputMessages[inputMessages.length - 1] = new HumanMessage(
          buildBatchImportPrompt(batchData)
        );
        logger.info('检测到批量导入任务，共 ' + batchData.projects.length + ' 个项目');
      }
    }

    const t_before_graph = Date.now();
    logger.info('3. 进入 Graph 准备时间:'+ (t_before_graph - t_receive) + ' ms');
    logger.info('4. 输入消息:'+ inputMessages.length);
    logger.info('5. 文件处理优化:'+ processedFiles.length + ' 个文件，避免重复读取');
    logger.info('6. 上下文系统:'+ (historyMessages.length > 0 ? `从历史加载 ${historyMessages.length} 条消息` : '新对话'));

    // 创建 Token 使用量回调处理器
    const tokenInspector = new TokenUsageInspector();
    
    const agent = await getAgent(availableModels.find(m => m.model === model) || availableModels[0]);
    const eventStream = await agent.stream({ messages: inputMessages }, { 
      streamMode: [ 'updates', 'messages',],
      callbacks: [tokenInspector]
    });
    const streamStart = Date.now();
    logger.info('Graph 开始执行:'+ (streamStart - startTime) + ' ms');

    // 用于累积助手回复内容
    let assistantContent = '';
    let assistantMessageId: string | null = null;
    
    const runtimeStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          // 用于聚合消息 chunk
          const messageChunks: any[] = [];
          
          for await (const event of eventStream) {
            if (event[0] === "updates") {
              logger.info(`[Node Update] 节点 ${Object.keys(event[1])[0]} 执行耗时:`+ (Date.now() - streamStart) + ' ms');
            }
            if (Array.isArray(event) && event.length === 2) {
              const [streamMode, chunk] = event;
              writeToFile(streamMode, chunk);
              if (streamMode === "messages") {
                const [messageChunk, metadata] = chunk as [any, any];
                // 保存 chunk 用于聚合
                messageChunks.push(messageChunk);
                
                // logger.info(messageChunk, metadata);
                const currentNode = metadata.langgraph_node;

                // --- 1. 提取深度思考 (Thought/Reasoning) ---
                // 处理不同厂商的思考内容字段
                let reasoning = messageChunk.additional_kwargs?.reasoning_content;
                // 检查其他可能的思考字段
                if (!reasoning) {
                  // 检查其他常见的思考字段名称
                  const possibleReasoningFields = ['reasoning', 'thought', 'thinking', 'rationale'];
                  for (const field of possibleReasoningFields) {
                    if (messageChunk.additional_kwargs?.[field]) {
                      reasoning = messageChunk.additional_kwargs[field];
                      break;
                    }
                  }
                }
                if (reasoning) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: "thought",
                    text: reasoning
                  })}\n\n`));
                }
                
                // --- 2. 处理其他厂商特有字段 ---
                if (messageChunk.additional_kwargs) {
                  // 可以在这里处理其他厂商特有的字段，如搜索来源、模型版本等
                  // 例如：
                  // const searchInfo = messageChunk.additional_kwargs.search_info;
                  // if (searchInfo) {
                  //   // 处理搜索信息
                  // }
                }

                // --- 2. 提取正式回答 (Content) ---
                // 只有当存在文本内容且不是正在调用工具时，才判定为有效回答
                if (messageChunk?.content && typeof messageChunk.content === "string") {
                  // 埋点：记录首字响应时间 (TTFT) - 只有在真正收到内容时才记录
                  if (firstTokenTime === null) {
                    firstTokenTime = Date.now();
                    logger.info(`首字耗时 (TTFT): ${firstTokenTime - startTime}ms`);
                    logger.info(`首字发送时间戳: ${Date.now()}`);
                    // 选做：可以通过特殊的 SSE 消息发给前端展示
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "metrics", ttft: firstTokenTime - startTime })}\n\n`));
                  }

                  // 累积助手回复内容
                  assistantContent += messageChunk.content;

                  // 判断消息类型：工具节点的内容作为thought，其他作为content
                  const messageType = currentNode === "tools" ? "thought" : "content";

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: messageType, // 工具节点内容作为thought，避免大段文本突然渲染
                    node: currentNode,
                    text: messageChunk.content
                  })}\n\n`));
                }

                // --- 3. 提取工具调用 (Tool Call) ---
                if (messageChunk?.tool_calls && messageChunk.tool_calls.length > 0) {
                  messageChunk.tool_calls.forEach((tc: any) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: "tool_call",
                      tool: tc.name,
                      message: `正在思考并准备调用: ${tc.name}...`
                    })}\n\n`));
                  });
                }
              }
              // --- 4. 处理节点更新状态 (Updates) ---
              else if (streamMode === "updates") {
                // 仅发送状态标记，用于前端 UI 显示进度条或 Loading
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: "status",
                  text: "工具执行完成，正在整合结果..."
                })}\n\n`));
              }
            }
          }
          
          // 流结束后，可以使用 LangChain 的 concat 方法聚合消息
          // 这里我们只是记录一下聚合的消息数量，实际聚合逻辑可以根据需要实现
          logger.info(`共接收 ${messageChunks.length} 个消息 chunk`);
          
          // 保存助手回复到数据库
          if (assistantContent.trim()) {
            assistantMessageId = await contextManager.addAssistantMessage(
              currentConversationId,
              assistantContent.trim(),
              {
                messageType: 'content',
              }
            );
            logger.info(`[Context] 保存助手消息: ${assistantMessageId}`);
          }
          
        } catch (err) {
          logger.error("Stream Error:"+ err);
        } finally {
          const endTime = Date.now();
          const totalDuration = endTime - startTime;
          logger.info(`总生成耗时: ${totalDuration}ms`);

          // 获取 token 使用量
          const tokenUsage = tokenInspector.getTokenUsage();
          logger.info('[TokenUsage] 最终使用量: ' + JSON.stringify(tokenUsage));

          // 更新消息的 Token 使用量
          if (assistantMessageId && tokenUsage) {
            try {
              await contextManager.updateMessageTokens(
                assistantMessageId,
                tokenUsage.promptTokens || 0,
                tokenUsage.completionTokens || 0
              );
              logger.info(`[Context] 更新消息 Token 使用量: ${assistantMessageId}`);
            } catch (error) {
              logger.error(`[Context] 更新 Token 使用量失败:`, error);
            }
          }

          // 发送结束指标（包含 token 使用量）
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "metrics",
            total_duration: totalDuration,
            pure_generate_duration: endTime - (firstTokenTime || endTime),
            token_usage: {
              inputTokens: tokenUsage.promptTokens || 0,
              outputTokens: tokenUsage.completionTokens || 0,
              totalTokens: tokenUsage.totalTokens || 0,
            },
            conversation_id: currentConversationId,
          })}\n\n`));
          
          // 记录：优先使用模型商返回的 usage 字段，而非手动计数
          logger.info('[TokenUsage] 使用模型商返回的 usage 字段进行统计');
          

          controller.close();
        }
      },
    });
    return new Response(runtimeStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',         // 禁用缓存，防止流被拦截
        'Connection': 'keep-alive',          // 保持长连接
        'Server-Timing': `pre;desc="Pre-processing";dur=${Date.now() - startTime}`,
        'X-Conversation-Id': currentConversationId, // 返回对话 ID
      },
    });
  } catch (error) {
    logger.error({ error},'LLM API error:');
    return NextResponse.json(
      { error: 'Failed to process LLM request' },
      { status: 500 }
    );
  }
}
