import { useState } from 'react';
import { getUser } from '../lib/auth';
import { Copy, Check, ExternalLink } from 'lucide-react';

export default function AccountPage() {
  const user = getUser();
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = window.location.origin;

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CodeBlock = ({ label, code, id }: { label: string; code: string; id: string }) => (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500 dark:text-zinc-500 font-medium">{label}</span>
        <button
          onClick={() => copyText(code, id)}
          className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-600 hover:text-indigo-600 dark:hover:text-white transition"
        >
          {copied === id ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied === id ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-sm font-mono text-slate-700 dark:text-zinc-300 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );

  const cardClass = 'border border-slate-200 dark:border-zinc-800 rounded-xl p-5 mb-6 bg-white dark:bg-transparent';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">账户信息</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">API 接入说明与账户详情</p>
      </div>

      {/* 用户信息卡片 */}
      <div className={cardClass}>
        <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400 mb-3">个人信息</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400 dark:text-zinc-600 mb-0.5">邮箱</p>
            <p className="text-sm">{user?.email || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-zinc-600 mb-0.5">昵称</p>
            <p className="text-sm">{user?.name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-zinc-600 mb-0.5">角色</p>
            <p className="text-sm">{user?.role === 'admin' ? '管理员' : '用户'}</p>
          </div>
        </div>
      </div>

      {/* API 接入信息 */}
      <div className={cardClass}>
        <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400 mb-4">API 接入信息</h3>
        <div className="space-y-4">
          <CodeBlock
            label="Base URL"
            code={`${baseUrl}/v1`}
            id="base-url"
          />
          <CodeBlock
            label="获取模型列表"
            code={`curl ${baseUrl}/v1/models \\
  -H "Authorization: Bearer sk-你的密钥"`}
            id="models"
          />
          <CodeBlock
            label="对话请求示例"
            code={`curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-你的密钥" \\
  -d '{
    "model": "deepseek-r1",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'`}
            id="chat"
          />
        </div>
      </div>

      {/* 客户端配置 */}
      <div className={cardClass}>
        <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400 mb-4">客户端配置</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">兼容所有 OpenAI API 格式的客户端</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'ChatGPT Next Web', url: 'https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web' },
            { name: 'Cherry Studio', url: 'https://github.com/kangfenmao/cherry-studio' },
            { name: 'RikkaHub', url: 'https://github.com/rikkahub/rikkahub' },
            { name: 'Open WebUI', url: 'https://github.com/open-webui/open-webui' },
          ].map((client) => (
            <a
              key={client.name}
              href={client.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 border border-slate-200 dark:border-zinc-800 rounded-lg hover:border-slate-300 dark:hover:border-zinc-600 transition group"
            >
              <span className="text-sm">{client.name}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-600 group-hover:text-slate-600 dark:group-hover:text-zinc-400 transition" />
            </a>
          ))}
        </div>
        <div className="mt-4 bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2">配置步骤</p>
          <ol className="text-sm text-slate-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
            <li>在客户端设置中找到 "API 地址" 或 "Base URL"</li>
            <li>填入 <code className="bg-slate-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-xs">{baseUrl}/v1</code></li>
            <li>在 "API Key" 处填入你的密钥（在密钥管理页面获取）</li>
            <li>选择模型开始对话</li>
          </ol>
        </div>
      </div>

      {/* 说明 */}
      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-transparent">
        <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400 mb-3">说明</h3>
        <ul className="text-sm text-slate-500 dark:text-zinc-500 space-y-1.5 list-disc list-inside">
          <li>完全兼容 OpenAI API 格式，支持流式和非流式输出</li>
          <li>支持所有上游提供的模型（GPT、Claude、DeepSeek 等）</li>
          <li>通过 <code className="text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-900 px-1 py-0.5 rounded text-xs">/v1/models</code> 接口查看可用模型列表</li>
          <li>密钥限额和速率限制请在密钥管理页面查看</li>
        </ul>
      </div>
    </div>
  );
}
