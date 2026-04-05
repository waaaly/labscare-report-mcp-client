# TypeScript 写法规范

## 基本原则

1. **严格类型检查** - 所有代码必须通过 `npm run typecheck`
2. **无 any 类型** - 避免使用 `any`，使用具体类型或 `unknown`
3. **类型推断** - 优先使用 TypeScript 的类型推断
4. **接口优先** - 使用 `interface` 定义对象形状，`type` 定义联合类型

## 组件规范

### 函数组件

```tsx
// ✅ 正确：使用 React.FC 或直接函数
export default function MyComponent({ prop1, prop2 }: Props) {
  return <div>{prop1}</div>;
}

// ❌ 错误：使用 any
export default function MyComponent({ data }: { data: any }) {
  return <div>{data}</div>;
}
```

### Props 定义

```tsx
// ✅ 正确：明确类型
interface Props {
  title: string;
  count?: number;
  onAction: () => void;
}

// ✅ 正确：使用类型导入
import { ButtonProps } from '@/components/ui/button';

// ❌ 错误：使用 any
interface Props {
  data: any;
  onClick: any;
}
```

### 事件处理

```tsx
// ✅ 正确：明确事件类型
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
};

const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

// ❌ 错误：使用 any
const handleChange = (e: any) => {
  const value = e.target.value;
};
```

## Hooks 规范

### useState

```tsx
// ✅ 正确：明确类型
const [count, setCount] = useState<number>(0);
const [data, setData] = useState<User[]>([]);
const [loading, setLoading] = useState<boolean>(false);

// ❌ 错误：不指定类型
const [count, setCount] = useState(0);
const [data, setData] = useState([]);
```

### useEffect

```tsx
// ✅ 正确：指定依赖数组
useEffect(() => {
  fetchData();
}, [dependency1, dependency2]);

// ✅ 正确：清理函数
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);

// ❌ 错误：缺少依赖
useEffect(() => {
  fetchData();
}, []); // 如果 fetchData 依赖外部变量，应该包含在依赖中
```

### 自定义 Hooks

```tsx
// ✅ 正确：明确返回类型
function useCustomHook(): { data: Data; loading: boolean } {
  const [data, setData] = useState<Data>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ...
  }, []);

  return { data, loading };
}

// ❌ 错误：不指定返回类型
function useCustomHook() {
  return { data, loading };
}
```

## API 路由规范

### Request/Response

```typescript
// ✅ 正确：明确请求体类型
interface CreateLabRequest {
  name: string;
  domain?: string;
}

// ✅ 正确：使用 Prisma 类型
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  const body: CreateLabRequest = await request.json();
  
  const lab = await prisma.lab.create({
    data: body,
  });
  
  return NextResponse.json(lab, { status: 201 });
}

// ❌ 错误：不验证类型
export async function POST(request: Request) {
  const body = await request.json();
  
  const lab = await prisma.lab.create({
    data: body, // body 是 any 类型
  });
  
  return NextResponse.json(lab);
}
```

### 错误处理

```typescript
// ✅ 正确：类型守卫
export async function GET() {
  try {
    const labs = await prisma.lab.findMany();
    return NextResponse.json(labs);
  } catch (error) {
    console.error('Failed to fetch labs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labs' },
      { status: 500 }
    );
  }
}

// ✅ 正确：类型断言
if (error instanceof Error) {
  return NextResponse.json(
    { error: error.message },
    { status: 500 }
  );
}

// ❌ 错误：不处理错误
export async function GET() {
  const labs = await prisma.lab.findMany();
  return NextResponse.json(labs);
}
```

## 状态管理规范

### Zustand Store

```typescript
// ✅ 正确：明确状态类型
interface LabState {
  currentLab: Lab | null;
  labs: Lab[];
  isLoading: boolean;
  error: string | null;
  setCurrentLab: (lab: Lab | null) => void;
  switchLab: (labId: string) => Promise<void>;
}

export const useLabStore = create<LabState>((set) => ({
  currentLab: null,
  labs: [],
  isLoading: false,
  error: null,
  
  setCurrentLab: (lab) => set({ currentLab: lab }),
  
  switchLab: async (labId) => {
    set({ isLoading: true });
    try {
      const lab = await fetchLab(labId);
      set({ currentLab: lab });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));

// ❌ 错误：不指定类型
export const useLabStore = create((set) => ({
  currentLab: null,
  labs: [],
  setCurrentLab: (lab) => set({ currentLab: lab }),
}));
```

## 工具函数规范

### 类型参数

```typescript
// ✅ 正确：明确参数类型
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ❌ 错误：使用 any
export function formatDate(date: any): string {
  return date.toLocaleDateString();
}
```

### 泛型函数

```typescript
// ✅ 正确：使用泛型
export function createApiResponse<T>(data: T, status: number = 200) {
  return {
    data,
    status,
    timestamp: new Date().toISOString(),
  };
}

// 使用示例
const response = createApiResponse<User>(userData);
const listResponse = createApiResponse<Project[]>(projects);

// ❌ 错误：不使用泛型
export function createApiResponse(data: unknown, status: number) {
  return { data, status, timestamp: new Date().toISOString() };
}
```

## 常见错误和修复

### 1. 缺少类型导入

```tsx
// ❌ 错误
import { Button } from '@/components/ui/button';

// ✅ 修复
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
```

### 2. 事件类型错误

```tsx
// ❌ 错误
const handleChange = (e: Event) => {
  console.log(e.target.value); // Error: Property 'target' does not exist on type 'Event'
};

// ✅ 修复
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value);
};
```

### 3. 可选属性处理

```tsx
// ❌ 错误
interface Props {
  title: string;
  count?: number;
}

function MyComponent({ title, count }: Props) {
  return <div>{count.toFixed(2)}</div>; // Error: Object is possibly 'undefined'
}

// ✅ 修复
function MyComponent({ title, count }: Props) {
  return <div>{count?.toFixed(2) ?? '0.00'}</div>;
}
```

### 4. 异步函数类型

```typescript
// ❌ 错误
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json(); // Error: Type is unknown
}

// ✅ 修复
async function fetchData(): Promise<Data[]> {
  const response = await fetch('/api/data');
  return response.json() as Promise<Data[]>;
}

// ✅ 更好：使用 Zod 验证
import { z } from 'zod';

const DataSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
}));

async function fetchData(): Promise<Data[]> {
  const response = await fetch('/api/data');
  const data = await response.json();
  return DataSchema.parse(data);
}
```

### 5. 表单处理

```tsx
// ❌ 错误
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const name = formData.get('name'); // Error: Type is string | File | null
};

// ✅ 修复
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const name = formData.get('name') as string;
};
```

## 最佳实践

### 1. 使用类型守卫

```typescript
function isLab(obj: unknown): obj is Lab {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj;
}

if (isLab(data)) {
  console.log(data.name); // TypeScript 知道 data 是 Lab 类型
}
```

### 2. 避免类型断言

```typescript
// ❌ 避免：过度使用 as
const data = response.json() as UserData;

// ✅ 更好：使用类型验证
const data = UserDataSchema.parse(response.json());
```

### 3. 使用工具类型

```typescript
// ✅ 使用 Pick 提取需要的属性
type LabUpdate = Pick<Lab, 'name' | 'domain' | 'version'>;

// ✅ 使用 Partial 处理可选更新
function updateLab(id: string, updates: Partial<Lab>) {
  return prisma.lab.update({
    where: { id },
    data: updates,
  });
}

// ✅ 使用 Omit 排除某些属性
type CreateLabInput = Omit<Lab, 'id' | 'createdAt' | 'updatedAt'>;
```

### 4. 类型导出

```typescript
// ✅ 导出类型以便其他文件使用
export interface Lab {
  id: string;
  name: string;
}

export type LabStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

// ✅ 使用类型别名提高可读性
export type LabId = string;
export type ProjectId = string;
```

## 检查命令

```bash
# 运行类型检查
npm run typecheck

# 运行 ESLint
npm run lint

# 同时运行两者
npm run typecheck && npm run lint
```

## 常用类型

### React 类型

```typescript
import type {
  ReactNode,
  ReactElement,
  ComponentType,
  MouseEvent,
  ChangeEvent,
  FormEvent,
  FocusEvent,
  KeyboardEvent,
} from 'react';
```

### Next.js 类型

```typescript
import type { Metadata, RouteParams } from 'next';
import type { NextRequest, NextResponse } from 'next/server';
```

### Prisma 类型

```typescript
import type { Prisma } from '@prisma/client';
import type { Lab, Project, Document } from '@prisma/client';
```

## 总结

遵循这些规范可以确保：

1. ✅ **类型安全** - 编译时捕获类型错误
2. ✅ **代码可维护性** - 清晰的类型定义
3. ✅ **IDE 支持** - 更好的自动完成和重构
4. ✅ **减少运行时错误** - 类型检查防止常见错误
5. ✅ **团队协作** - 统一的代码风格

记住：TypeScript 的类型系统是你的朋友，充分利用它！
