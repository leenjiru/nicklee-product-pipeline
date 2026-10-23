"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Instagram, KeyRound, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Status { active: string | null; accounts: { username: string; loggedOut: boolean }[] }

const PASSWORD_KEY = "instagram-admin-password"

export default function InstagramSessionPage() {
  const [password, setPassword] = useState("")
  const [sessionid, setSessionid] = useState("")
  const [status, setStatus] = useState<Status | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function call(method: "GET" | "POST", pw = password) {
    const response = await fetch("/api/instagram-session", {
      method,
      headers: { "X-Admin-Password": pw, "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({ sessionid }) : undefined,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Request failed")
    try { localStorage.setItem(PASSWORD_KEY, pw) } catch {}
    setStatus({ active: data.active, accounts: data.accounts || [] })
    return data
  }

  useEffect(() => {
    let saved = ""
    try { saved = localStorage.getItem(PASSWORD_KEY) || "" } catch {}
    if (saved) { setPassword(saved); call("GET", saved).catch(() => {}) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true); setMessage(null)
    try {
      const data = await call("POST")
      setMessage({ ok: true, text: `Logged in as @${data.username}. Instagram search works again.` }); setSessionid("")
    } catch (err) { setMessage({ ok: false, text: err instanceof Error ? err.message : "Couldn't save the cookie" }) } finally { setBusy(false) }
  }

  async function check() {
    setBusy(true); setMessage(null)
    try { await call("GET") } catch (err) { setMessage({ ok: false, text: err instanceof Error ? err.message : "Couldn't check" }) } finally { setBusy(false) }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:px-6">
      <div className="pt-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 text-white"><KeyRound /></div>
        <h1 className="text-3xl font-bold tracking-tight">Instagram login</h1>
        <p className="mt-3 text-muted-foreground">When Instagram logs the search account out, paste a fresh <code>sessionid</code> cookie here. Add a second spare account too, and search switches to it automatically when one is logged out.</p>
      </div>

      <Card className="mt-8">
        <CardHeader><CardTitle className="text-lg">Accounts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Site admin password (not your Instagram password)" aria-label="Site admin password" autoComplete="current-password" />
            <Button variant="outline" onClick={check} disabled={busy || !password}>Check</Button>
          </div>
          {status && (status.accounts.length === 0
            ? <p className="text-sm text-muted-foreground">No accounts yet.</p>
            : <ul className="space-y-1.5">{status.accounts.map((a) => (
                <li key={a.username} className="flex items-center gap-2 text-sm">
                  {a.loggedOut ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  <span className="font-medium">@{a.username}</span>
                  <span className="text-muted-foreground">{a.loggedOut ? "logged out - paste a new cookie" : a.username === status.active ? "in use" : "standby"}</span>
                </li>
              ))}</ul>)}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-lg">Paste a new cookie</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>On a computer, open <strong>instagram.com</strong> and log in to the spare account (not your main one).</li>
            <li>Press <strong>F12</strong>. Chrome/Edge: <strong>Application</strong> tab → <strong>Cookies</strong>. Firefox: <strong>Storage</strong> tab → <strong>Cookies</strong>. Pick <code>https://www.instagram.com</code>.</li>
            <li>Double-click the <strong>Value</strong> of <code>sessionid</code>, copy it and paste it below.</li>
            <li>Close the tab <strong>without logging out</strong>. Logging out kills the cookie.</li>
          </ol>
          <textarea value={sessionid} onChange={(e) => setSessionid(e.target.value)} placeholder="e.g. 54961464401%3AAbCd..." aria-label="sessionid cookie" rows={3}
            className="w-full rounded-md border bg-transparent p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" spellCheck={false} autoComplete="off" />
          <Button onClick={save} disabled={busy || !password || !sessionid.trim()} className="w-full">{busy ? <Loader2 className="animate-spin" /> : <Instagram />}Save login</Button>
          {message && <p className={`rounded-md p-3 text-sm ${message.ok ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}>{message.text}</p>}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm"><Link href="/instagram" className="text-blue-600 hover:underline dark:text-blue-400">← Back to Instagram search</Link></p>
    </main>
  )
}
