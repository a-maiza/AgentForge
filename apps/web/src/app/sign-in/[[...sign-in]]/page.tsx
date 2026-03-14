import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">AgentForge</h1>
          <p className="mt-2 text-sm text-slate-400">LLM Governance & Prompt Management</p>
        </div>
        <SignIn />
      </div>
    </main>
  );
}
