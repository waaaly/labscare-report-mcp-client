import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/llm/reactAgent';
import { Buffer } from 'buffer';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { logger} from '@/lib/logger'
import { writeToFile } from '@/lib/logger-to-file'
import { availableModels } from '@/lib/llm/model-config';
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

    for (const file of files) {
      if (file.type?.startsWith('image/')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
        userText += `\n\n[图片文件: ${file.name}] (已作为视觉输入上传)\n`;
        // 存储处理结果，避免重复读取
        processedFiles.push({
          file,
          type: 'image',
          content: '',
          dataUrl
        });
      } else if (file.name?.toLowerCase().endsWith('.md') || file.type === 'text/markdown') {
        const mdText = await file.text();
        userText += `\n\n[Markdown: ${file.name}]\n${mdText}\n`;
        processedFiles.push({
          file,
          type: 'md',
          content: mdText
        });
      } else if (file.type === 'application/json' || file.name?.toLowerCase().endsWith('.json')) {
        const jsonText = await file.text();
        userText += `\n\n[JSON: ${file.name}]\n\`\`\`json\n${jsonText}\n\`\`\`\n`;
        processedFiles.push({
          file,
          type: 'json',
          content: jsonText
        });
      }
    }

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

    // 🔧 优化3：直接构建最终数组，避免中间处理
    const inputMessages: Array<HumanMessage | AIMessage> = [];

    if (messagesJson) {
      try {
        const arr = JSON.parse(messagesJson as string) as Array<{ role: 'user' | 'assistant'; content: string }>;
        if (Array.isArray(arr)) {
          // 🔧 优化4：只处理最后10条消息，避免处理无用消息
          const recentMessages = arr.slice(-10);
          for (const m of recentMessages) {
            // 🔧 优化5：合并正则替换，减少正则执行次数
            let cleanContent = (m.content ?? '')
              .replace(/(\[状态\]|正在调用工具:).*?\n?/g, '') // 合并两个模式
              .trim();

            if (!cleanContent) continue; // 如果清洗后为空，不加入上下文

            if (m?.role === 'user') {
              inputMessages.push(new HumanMessage(cleanContent));
            } else if (m?.role === 'assistant') {
              inputMessages.push(new AIMessage(cleanContent));
            }
          }
        }
      } catch (e) {
        logger.error("解析消息历史失败:"+ e);
      }
    }

    inputMessages.push(new HumanMessage({ content: messageContent }));

    const t_before_graph = Date.now();
    logger.info('3. 进入 Graph 准备时间:'+ (t_before_graph - t_receive) + ' ms');
    logger.info('4. 输入消息:'+ inputMessages.length);
    logger.info('5. 文件处理优化:'+ processedFiles.length + ' 个文件，避免重复读取');
    logger.info('6. 消息处理优化:'+ (messagesJson ? '只处理最后10条消息' : '无消息历史'));

    const agent = await getAgent(availableModels.find(m => m.model === model) || availableModels[0]);
    const eventStream = await agent.stream({ messages: inputMessages }, { streamMode: [ 'updates', 'messages',] });
    const streamStart = Date.now();
    logger.info('Graph 开始执行:'+ (streamStart - startTime) + ' ms');

    const runtimeStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of eventStream) {
            if (event[0] === "updates") {
              logger.info(`[Node Update] 节点 ${Object.keys(event[1])[0]} 执行耗时:`+ (Date.now() - streamStart) + ' ms');
            }
            if (Array.isArray(event) && event.length === 2) {
              const [streamMode, chunk] = event;
              writeToFile(streamMode, chunk);
              if (streamMode === "messages") {
                const [messageChunk, metadata] = chunk as [any, any];
                // logger.info(messageChunk, metadata);
                const currentNode = metadata.langgraph_node;

                // --- 1. 提取深度思考 (Thought/Reasoning) ---
                // Qwen 和 DeepSeek 通常将思考内容放在这个字段
                const reasoning = messageChunk.additional_kwargs?.reasoning_content;
                if (reasoning) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: "thought",
                    text: reasoning
                  })}\n\n`));
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
        } catch (err) {
          logger.error("Stream Error:"+ err);
        } finally {
          const endTime = Date.now();
          const totalDuration = endTime - startTime;
          logger.info(`总生成耗时: ${totalDuration}ms`);

          // 发送结束指标
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "metrics",
            total_duration: totalDuration,
            pure_generate_duration: endTime - (firstTokenTime || endTime)
          })}\n\n`));

          controller.close();
        }
      },
    });
    return new Response(runtimeStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',         // 禁用缓存，防止流被拦截
        'Connection': 'keep-alive',          // 保持长连接
        'Server-Timing': `pre;desc="Pre-processing";dur=${Date.now() - startTime}`
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
