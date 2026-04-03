
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import pino from 'pino';

const isBrowser = typeof window !== 'undefined';
const isDevelopment = process.env.NODE_ENV === 'development';
const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  browser: {
    asObject: true, // 将日志作为对象传给 console.log，而不是字符串
    // transmit: { // 可选：如果你想把客户端日志发送到服务器
    //   level: 'error',
    //   send: (level, logEvent) => {
    //     // 发送到你的 API 接口记录客户端错误
    //     fetch('/api/log', { method: 'POST', body: JSON.stringify(logEvent) });
    //   }
    // }
  },
});


function formatLogArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

function writeToFile(...args: unknown[]) {
  if (typeof window === 'undefined') {
    const fs = require('fs');
    const path = require('path');
    const logFilePath = path.join(process.cwd(), 'debug.log');
    const timestamp = new Date().toISOString();
    const message = formatLogArgs(args);
    const logLine = `[${timestamp}] ${message}\n`;

    try {
      fs.appendFileSync(logFilePath, logLine, 'utf-8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}


export class RequestInspector extends BaseCallbackHandler {
  name = "llm_request_logger";


  // 当 LLM 开始请求时触发
  handleLLMStart(llm: any, prompts: string[], runId: string, parentRunId?: string, extraParams?: Record<string, any>) {
    logger.info("\n🚀 [LLM Request Started]");
    const modelName =
      llm?.kwargs?.model ||           // ← 最关键的一行（你当前的结构）
      llm?.model ||
      llm?.modelName ||
      llm?.name ||
      extraParams?.invocation_params?.model ||
      "unknown";

    logger.info(`📌 选择的模型: ${modelName}`);

    // 可选：额外打印更多信息，方便以后调试其他模型
    logger.info(`🌐 Base URL: ${llm?.kwargs?.configuration?.baseURL || 'default'}`);

    // 打印发送的消息列表 (重点检查这里是否有巨大的 Base64)
    if (extraParams?.invocation_params?.messages) {
      logger.info("Messages Count:", extraParams.invocation_params.messages.length);

      extraParams.invocation_params.messages.forEach((msg: any, i: number) => {
        logger.info(`--- Message ${i} (${msg.role}) ---`);
        // 如果内容是数组（多模态），遍历检查
        if (Array.isArray(msg.content)) {
          msg.content.forEach((part: any) => {
            if (part.type === 'image_url') {
              logger.info(`[Image Data]: ${part.image_url.url.substring(0, 50)}... (Length: ${part.image_url.url.length})`);
            } else {
              logger.info(`[Text]: ${part.text?.substring(0, 100)}...`);
            }
          });
        } else {
          logger.info(`[Text]: ${msg.content?.substring(0, 100)}...`);
        }
      });
    }

    // 打印绑定的工具
    // if (extraParams?.invocation_params?.tools) {
    //   logger.info("Tools:" + JSON.stringify(extraParams.invocation_params.tools, null, 2));
    // }
    logger.info("------------------------\n");
  }

}


export {
  logger,
  writeToFile,
}