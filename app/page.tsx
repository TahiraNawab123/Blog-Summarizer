"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Link, FileText, AlertCircle } from "lucide-react"

interface SummaryResponse {
  success: boolean
  summary?: string
  title?: string
  error?: string
}

export default function BlogSummarizer() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SummaryResponse | null>(null)

  const isValidUrl = (string: string) => {
    try {
      new URL(string)
      return true
    } catch (_) {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      setResult({ success: false, error: "Please enter a URL" })
      return
    }

    if (!isValidUrl(url)) {
      setResult({ success: false, error: "Please enter a valid URL" })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      const data: SummaryResponse = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: "Failed to connect to the server. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setUrl("")
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Blog Summarizer</h1>
          <p className="text-lg text-gray-600">Professional blog summarizer developed by Tahira Nawab</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Enter Blog URL
            </CardTitle>
            <CardDescription>Paste the URL of any blog post or article to get an AI-powered summary</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/blog-post"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                  disabled={loading}
                />
                <Button type="submit" disabled={loading || !url.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    "Summarize"
                  )}
                </Button>
                {(url || result) && (
                  <Button type="button" variant="outline" onClick={handleClear} disabled={loading}>
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <FileText className="h-5 w-5 text-green-600" />
                    Summary Generated
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Error
                  </>
                )}
              </CardTitle>
              {result.success && result.title && (
                <CardDescription className="text-base font-medium">{result.title}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {result.success ? (
                <div className="prose max-w-none">
                  <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <h4 className="font-semibold text-gray-900 mb-2">Key Points:</h4>
                    <div className="text-gray-700 whitespace-pre-line">{result.summary}</div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Supports most blog platforms and news websites. Powered by AI for accurate and concise summaries.</p>
        </div>
      </div>
    </div>
  )
}

