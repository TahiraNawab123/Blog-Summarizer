import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import * as cheerio from "cheerio"

interface ArticleContent {
  title: string
  content: string
  url: string
}

async function extractArticleContent(url: string): Promise<ArticleContent> {
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove unwanted elements
    $("script, style, nav, header, footer, aside, .advertisement, .ads, .social-share, .comments").remove()

    // Try to find the main content using common selectors
    let title = ""
    let content = ""

    // Extract title
    title =
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      $('[property="og:title"]').attr("content") ||
      "Untitled Article"

    // Try different content selectors in order of preference
    const contentSelectors = [
      "article",
      '[role="main"]',
      ".post-content",
      ".entry-content",
      ".article-content",
      ".content",
      "main",
      ".post-body",
      ".story-body",
      ".article-body",
    ]

    for (const selector of contentSelectors) {
      const element = $(selector)
      if (element.length > 0) {
        content = element.text().trim()
        if (content.length > 200) {
          // Ensure we have substantial content
          break
        }
      }
    }

    // Fallback: extract all paragraph text
    if (!content || content.length < 200) {
      content = $("p")
        .map((_, el) => $(el).text().trim())
        .get()
        .join(" ")
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\n+/g, " ") // Replace newlines with space
      .trim()

    if (!content || content.length < 100) {
      throw new Error("Could not extract sufficient content from the article")
    }

    return {
      title: title.substring(0, 200), // Limit title length
      content: content.substring(0, 8000), // Limit content for API
      url,
    }
  } catch (error) {
    console.error("Content extraction error:", error)
    throw new Error("Failed to extract content from the provided URL")
  }
}

async function generateSummary(article: ArticleContent): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  // Check if API key is properly configured
  if (!apiKey || apiKey === "your_openai_api_key_here" || apiKey.startsWith("your_ope")) {
    console.log("OpenAI API key not configured, using fallback summarizer")
    return generateFallbackSummary(article)
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You are an expert content summarizer. Your task is to create concise, accurate summaries of articles and blog posts.

Guidelines:
- Create a summary that captures the main points and key insights
- Format as 3-5 bullet points for easy reading
- Each bullet point should be 1-2 sentences
- Focus on the most important information and actionable insights
- Maintain the original tone and context
- Avoid unnecessary details or filler content`,
      prompt: `Please summarize the following article:

Title: ${article.title}
URL: ${article.url}

Content: ${article.content}

Provide a clear, structured summary in bullet points that captures the essential information.`,
      maxTokens: 500,
    })

    return text.trim() + "\n\n— Summarized by Tahira Nawab"
  } catch (error) {
    console.error("OpenAI API error:", error)
    console.log("Falling back to basic summarizer")
    return generateFallbackSummary(article)
  }
}

function generateFallbackSummary(article: ArticleContent): string {
  const content = article.content
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20)

  if (sentences.length === 0) {
    return `• Unable to generate summary from the provided content.\n\n— Summarized by Tahira Nawab`
  }

  // Simple extractive summarization
  const wordFreq: { [key: string]: number } = {}
  const words = content.toLowerCase().match(/\b\w+\b/g) || []

  // Count word frequencies (excluding common stop words)
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
  ])

  words.forEach((word) => {
    if (word.length > 3 && !stopWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
  })

  // Score sentences based on word frequencies
  const sentenceScores = sentences.map((sentence) => {
    const sentenceWords = sentence.toLowerCase().match(/\b\w+\b/g) || []
    const score = sentenceWords.reduce((sum, word) => sum + (wordFreq[word] || 0), 0)
    return { sentence: sentence.trim(), score }
  })

  // Get top sentences
  const topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.sentence)
    .filter((s) => s.length > 30)

  if (topSentences.length === 0) {
    return `• This article discusses: ${article.title}\n• Content extracted from: ${article.url}\n• Summary generation requires OpenAI API key for detailed analysis.\n\n— Summarized by Tahira Nawab`
  }

  return topSentences.map((sentence) => `• ${sentence}`).join("\n") + "\n\n— Summarized by Tahira Nawab"
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ success: false, error: "Invalid URL format" }, { status: 400 })
    }

    // Extract article content
    const article = await extractArticleContent(url)

    // Generate summary
    const summary = await generateSummary(article)

    return NextResponse.json({
      success: true,
      title: article.title,
      summary: summary,
    })
  } catch (error) {
    console.error("API error:", error)

    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
