// app/api/run-script/route.ts
import { NextResponse } from 'next/server';
import ivm from 'isolated-vm';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { Script } from '@prisma/client';
import { logger } from '@/lib/logger';
export async function POST(req: Request) {
    try {
        const { id, dataSourceId, sampleId, projectId } = await req.json();
        const logs: string[] = [];
        let script: Script | null;
        let dataCopy: ivm.ExternalCopy | null = null;
        try {
            script = await prisma.script.findUnique({
                where: {
                    id: id
                }
            });
            if (!script) {
                throw new Error('Script not found');
            }
        } catch (error: any) {
            throw new Error(error.message);
        }
        // 加载 mock 数据，作为数据源
        // 后续应该读取minio中的数据
        try {
            const mockPath = path.join(process.cwd(), 'app/api/runner/mock.json');
            const mockData = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
            // 2. 将大型数据转为 ExternalCopy 以优化内存处理
            // ExternalCopy 允许将数据移动到隔离环境中，而不占用宿主堆空间
            dataCopy = new ivm.ExternalCopy(mockData);
        } catch (error: any) {
            throw new Error(error.message);
        }
        const isolate = new ivm.Isolate({ memoryLimit: 128 });
        const context = await isolate.createContext();
        const jail = context.global;


        // --- 1. 在沙箱内部初始化基础设施 (纯 JS 定义) ---
        // await context.evalSync(`
        // // 内部注册表，用于存放 set/get 的内容
        // // 如果你的代码里一定要用 global.set，可以这样手动挂载：
        // // var global = this;
        // const __registry = new Map();

        // // 直接定义在顶级作用域
        // function set(key, val) {
        //     __registry.set(key, val);
        // };

        // function get(key) {
        //     return __registry.get(key);
        // };

        // `);

        // // --- 2. 注入外部变量 (宿主传递给沙箱) ---
        // await jail.set('sampleId', sampleId || '1');
        // await jail.set('projectId', projectId || '1');
        // // 注入 dataCopy 到沙箱
        // await jail.set('dataCopy', dataCopy);
        // // --- 3. 注入 load 方法 (读取宿主文件并在沙箱内运行) ---
        // await jail.set('load', new ivm.Callback((filePath: string) => {
        //     // 确保路径安全（只能读取特定目录下的 js）
        //     const safePath = path.join(process.cwd(), 'app/api/runner/tools.js');
        //     const content = fs.readFileSync(safePath, 'utf8');

        //     // 直接在当前上下文执行 load 的文件内容
        //     // 这样 tools.js 里的 set(...) 就会调用上面定义的 global.set
        //     context.evalSync(content);
        // }));
        // await jail.set('log', new ivm.Callback((...args: any[]) => {
        //     // 1. 在服务端控制台打印
        //     console.log('[沙箱日志]:', ...args);

        //     // 2. 存入数组，方便稍后随接口一起返回给前端
        //     logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
        // }));

        // // --- 4. 注入宿主对象 (如 labscareHelper) ---
        // // 注意：我们将 helper 的核心方法注入到注册表
        // await context.evalSync(`
        // set('labscareHelper', {
        //     getSamples: function(id) {
        //     // 这里可以是从宿主预先传进来的数据，或者是同步的回调
        //     const fullData = dataCopy.copyInto();
        //     return fullData.samples; // 示例返回空
        //     },
        //     getProjectData: function(pid) {
        //     return {}; // 示例返回空
        //     }
        // });
        // `);

        // --- 5. 执行主脚本并捕获最后一行结果 ---
        // 为了确保最后一行 data 能被正确返回并序列化，我们进行一次包裹
        const lines = script.code.trim().replace(/;+$/, "").split('\n');
        const lastLine = lines.pop();
        /**
         *  ${lines.join('\n')}
                return ${lastLine ? lastLine.replace(/;+$/, '') : 'null'};
         */
        const wrappedCode = `
            (function() {
               var data = [1, 2, 3];
                console.log(data)
                return data
            })()
        `;
        const finalScript = await isolate.compileScript(wrappedCode, {
            filename: 'user_script.js' // 给脚本命名，方便在报错中识别
        });
        const result = await finalScript.run(context, { timeout: 2000 });
        logger.info(result, typeof result);

        // 处理返回值：如果是对象则序列化
        let finalData = result;
        // 如果 result 是对象引用 (ivm.Reference)
        if (typeof result === 'object' && result !== null) {
            // 使用 evalClosure 将 result 引用传回沙箱并执行序列化
            const jsonStr = await context.eval(
                'return JSON.stringify($0)',
            );
            finalData = JSON.parse(jsonStr);
        }

        // 释放资源
        isolate.dispose();
        logger.info(finalData, typeof finalData);
        return NextResponse.json({ success: true, data: finalData ,logs});

    } catch (error: any) {
        // isolated-vm 抛出的错误包含 line, column, startColumn, endColumn 等信息
        const errorDetail = {
            message: error.message,
            line: error.line,       // 报错行号
            column: error.column,   // 报错列号
            stack: error.stack      // 完整堆栈
        };

        return NextResponse.json({
            success: false,
            error: `错误位于第 ${errorDetail.line} 行: ${errorDetail.message}`,
            detail: errorDetail
        }, { status: 500 });
    }
}
