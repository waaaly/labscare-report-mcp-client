import { NextRequest, NextResponse } from 'next/server';
import { agent } from '@/lib/llm/reactAgent';
import { Buffer } from 'buffer';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { writeToFile } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now(); // T0: 请求开始
    let firstTokenTime: number | null = null; // T1: 首字时间
    const t_receive = Date.now();
    writeToFile('1. 收到请求:', t_receive);
    // 1) 解析 FormData
    const t_before_form = Date.now();
    const formData = await request.formData();
    writeToFile('2. FormData 解析耗时:', Date.now() - t_before_form, 'ms');
    const prompt = (formData.get('prompt') as string) || '';
    const contextJson = (formData.get('contextJson') as string) || '';
    const messagesJson = formData.get('messagesJson') as string | null;
    const files = (formData.getAll('files') as File[]) || [];

    let userText = prompt || '';
    if (contextJson) {
      userText += `\n\n[Context]\n\`\`\`json\n${contextJson}\n\`\`\`\n`;
    }

    for (const file of files) {
      if (file.type?.startsWith('image/')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
        userText += `\n\n[Image: ${file.name}]\n${dataUrl}\n`;
      } else if (file.name?.toLowerCase().endsWith('.md') || file.type === 'text/markdown') {
        const mdText = await file.text();
        userText += `\n\n[Markdown: ${file.name}]\n${mdText}\n`;
      } else if (file.type === 'application/json' || file.name?.toLowerCase().endsWith('.json')) {
        const jsonText = await file.text();
        userText += `\n\n[JSON: ${file.name}]\n\`\`\`json\n${jsonText}\n\`\`\`\n`;
      }
    }

    const messageContent: any[] = [{ type: 'text', text: userText.trim() }];
    for (const file of files) {
      if (file.type?.startsWith('image/')) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
        messageContent.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    }

    const baseMessages: Array<HumanMessage | AIMessage> = [];
    if (messagesJson) {
      try {
        const arr = JSON.parse(messagesJson as string) as Array<{ role: 'user' | 'assistant'; content: string }>;
        if (Array.isArray(arr)) {
          for (const m of arr) {
            // --- 新增：清洗逻辑 ---
            // 过滤掉包含 [状态]、[Tool Call] 等非对话文本
            let cleanContent = (m.content ?? '')
              .replace(/\[状态\].*?\n?/g, '') // 移除状态提示
              .replace(/正在调用工具:.*?\n?/g, '') // 移除工具提示
              .trim();

            if (!cleanContent) continue; // 如果清洗后为空，不加入上下文

            if (m?.role === 'user') {
              baseMessages.push(new HumanMessage(cleanContent));
            } else if (m?.role === 'assistant') {
              baseMessages.push(new AIMessage(cleanContent));
            }
          }
        }
      } catch (e) {
        console.error("解析消息历史失败:", e);
      }
    }

    const inputMessages = [...baseMessages.slice(-10), new HumanMessage({ content: messageContent })];
    const t_before_graph = Date.now();
    writeToFile('3. 进入 Graph 准备时间:', t_before_graph - t_receive, 'ms');
    writeToFile('4. 输入消息:', inputMessages);
    const eventStream = await agent.stream({ messages: inputMessages }, { streamMode: ['tools', 'updates', 'messages',] });
    const streamStart = Date.now();
    writeToFile('Graph 开始执行:', streamStart - startTime, 'ms');

    const runtimeStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of eventStream) {
            // 埋点：记录首字响应时间 (TTFT)
            if (firstTokenTime === null) {
              firstTokenTime = Date.now();
              writeToFile(`首字耗时 (TTFT): ${firstTokenTime - startTime}ms`);

              // 选做：可以通过特殊的 SSE 消息发给前端展示
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "metrics", ttft: firstTokenTime - startTime })}\n\n`));
            }
            if (event[0] === "updates") {
              writeToFile(`[Node Update] 节点 ${Object.keys(event[1])[0]} 执行耗时:`, Date.now() - streamStart, 'ms');
            }
            if (Array.isArray(event) && event.length === 2) {
              const [streamMode, chunk] = event;
              if (streamMode === "messages") {
                const [messageChunk, metadata] = chunk as [any, any];
                writeToFile(messageChunk, metadata);
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
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: "content", // 前端应只将此类型存入 history
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
          console.error("Stream Error:", err);
        } finally {
          const endTime = Date.now();
          const totalDuration = endTime - startTime;
          writeToFile(`总生成耗时: ${totalDuration}ms`);

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
    console.error('LLM API error:', error);
    return NextResponse.json(
      { error: 'Failed to process LLM request' },
      { status: 500 }
    );
  }
}
