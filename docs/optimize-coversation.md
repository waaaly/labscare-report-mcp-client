# 本文档是对LLM对话界面进行优化对话体验的文档

## 1. “缓冲区 + 批量更新”
不要每个chunk都setState
改造成如下：
```js
const bufferRef = useRef("");
const frameRef = useRef<number | null>(null);

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  bufferRef.current += chunk;

  // ❗ 使用 rAF 批量更新（关键）
  if (!frameRef.current) {
    frameRef.current = requestAnimationFrame(() => {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = bufferRef.current;
        return updated;
      });
      frameRef.current = null;
    });
  }
}
```
## 2.makrdown 渲染需要分阶段
👉 streaming 阶段用 plain text
👉 完成后再 markdown
示例代码如下：

```js
{message.role === 'assistant' ? (
  message.isStreaming ? (
    <pre className="whitespace-pre-wrap">{message.content}</pre>
  ) : (
    <ReactMarkdown>{message.content}</ReactMarkdown>
  )
) : (
  message.content
)}
```
## 3. 滚动控制优化
现在每次 render 都触发 smooth scroll → 抖动
改造成：
```js
const scrollToBottom = useCallback((smooth = false) => {
  messagesEndRef.current?.scrollIntoView({
    behavior: smooth ? 'smooth' : 'auto'
  });
}, []);
```
然后：
```js
// streaming 时
scrollToBottom(false)

// 完成时
scrollToBottom(true)
```

## 4.Pretext 思想的“进阶实现”（最关键）
把 message 拆成“结构化 token”
将现在的content
```js
content:string
```
改造成
```js
content: {
  raw: string
  tokens: string[]
}
```
当streaming时，
```js
bufferRef.current += chunk
tokens.push(chunk)
```