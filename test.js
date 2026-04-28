// import { ChatAnthropic } from "@langchain/anthropic";

// const model = new ChatAnthropic({
//   apiKey: process.env['ANTHROPIC_API_KEY'],
//   apiUrl: process.env['ANTHROPIC_BASE_URL'],
//   model: 'claude-3-5-sonnet-20240620', // 注意：请确保使用有效的模型名称
//   streaming: true, // 开启流式支持
// });

// async function run() {
//   try {
//      console.log("流已启动...1111"); 
//     const stream = await model.stream([
//       { role: 'user', content: 'Hello, Claude' }
//     ]);

//     console.log("流已启动..."); // 添加日志确认代码运行到此处

//     for await (const chunk of stream) {
//       process.stdout.write(chunk.content || "");
//     }
//   } catch (error) {
//     console.error("捕获到错误:", error); // 强制显示潜在的权限或网络错误
//   }
// }
// console.log(model);
// run();


// import { GoogleGenAI } from '@google/genai';

// // 初始化客户端（从环境变量 GEMINI_API_KEY 读取）
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// // 非流式调用
// const response = await ai.models.generateContent({
//   model: 'gemini-2.5-flash',
//   contents: 'Hello, Gemini',
// });
// console.log(response.text);

// // 流式调用
// const stream = await ai.models.generateContentStream({
//   model: 'gemini-2.5-flash',
//   contents: '用 TypeScript 写一个 Hello World',
// });
// for await (const chunk of stream) {
//   process.stdout.write(chunk.text ?? '');
// }

// import OpenAI from 'openai';

// const client = new OpenAI();

// // ========== 1. Chat Completions 流式调用 ==========
// const streamCompletion = await client.chat.completions.create({
//   model: 'gpt-5.2',
//   messages: [{ role: 'user', content: '写个冒泡排序算法' }],
//   max_tokens: 1024,
//   stream: true,  // 开启流式
// });

// // 逐块处理
// console.log('Chat Completions stream:');
// for await (const chunk of streamCompletion) {
//   const content = chunk.choices[0]?.delta?.content || '';
//   process.stdout.write(content);  // 实时打印
// }
// console.log('222\n');  // 换行

// // ========== 2. Responses 流式调用 ==========
// const streamResponse = await client.responses.create({
//   model: 'gpt-5.2',
//   input: 'Hello, GPT',
//   stream: true,   // 开启流式
// });

// console.log('Responses stream:');
// for await (const event of streamResponse) {
//   // 根据事件类型处理，通常文本在 event.delta 中
//   if (event.type === 'response.output_text.delta') {
//     process.stdout.write(event.delta);
//   }
//   // 也可以处理其他事件，如 response.completed 等
// }
// console.log('111\n');

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({
  modelName: "gpt-5.2",
  streaming: true,
});

const messages = [new HumanMessage("Hello, ")];

const agent = createAgent(model);

// const stream1 = await model.stream(messages, { 
//       streamMode: [ 'updates', 'messages',],
//       // callbacks: [tokenInspector]
//     })
try {
  const stream = await agent.stream({ messages: messages }, {
  streamMode: [ 'updates', 'messages',],
  // callbacks: [(token) => console.log(token)]
});

for await (const event of stream) {
  console.log(event);
  if (event[0] === 'messages') {
    process.stdout.write(event.content);
  }
} 
}catch (error) {
  console.error("捕获到错误:", error); // 强制显示潜在的权限或网络错误
}

