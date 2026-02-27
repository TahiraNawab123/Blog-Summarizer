import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import * as cheerio from "cheerio"

interface ArticleContent {
  title: string
  content: string
  url: string
  author?: string
  publishDate?: string
  siteName?: string
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim()
}

function calculateTextDensity(element: ReturnType<typeof $>, $: cheerio.CheerioAPI): number {
  const text = element.text().trim()
  const html = element.html() || ""
  
  const textLength = text.length
  const htmlLength = html.length
  
  if (htmlLength === 0) return 0
  
  const links = element.find("a")
  let linkText = ""
  links.each((_: number, el: cheerio.Element) => {
    linkText += $(el).text()
  })
  
  const linkDensity = linkText.length / textLength
  
  return textLength * (1 - Math.min(linkDensity, 0.5))
}

async function extractArticleContent(url: string): Promise<ArticleContent> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const finalUrl = response.url
    const html = await response.text()
    const $ = cheerio.load(html)

    $("script, style, noscript, iframe, embed, object, svg, canvas, video, audio, picture, source, track, map, area, form, input, textarea, button, select, optgroup, option, label, fieldset, legend, dialog, details, summary, menu, menuitem, template, slot, shadow, comment, .advertisement, .ad, .ads, .social-share, .share-buttons, .comments, .comment-section, .related-posts, .recommended, .sidebar, .widget, .popup, .modal, .overlay, .cookie-notice, .newsletter, .subscribe, .subscription, [role='complementary'], [role='navigation'], nav, header, footer, aside, .nav, .navigation, .menu, .footer, .header, .copyright, .credits, .author-bio, .bio, .promo, .promotion, .cta, .call-to-action").remove()

    $("[class*='cookie']").remove()
    $("[class*='newsletter']").remove()
    $("[class*='subscribe']").remove()
    $("[class*='social']").remove()
    $("[id*='cookie']").remove()
    $("[id*='newsletter']").remove()
    $("[id*='subscribe']").remove()

    let title = ""
    let content = ""
    let author = ""
    let publishDate = ""
    let siteName = ""

    siteName = 
      $('[property="og:site_name"]').attr("content") ||
      $('[name="application-name"]').attr("content") ||
      new URL(finalUrl).hostname.replace("www.", "") ||
      ""

    title =
      $('h1[class*="title"]').first().text().trim() ||
      $('h1[class*="post"]').first().text().trim() ||
      $('h1[class*="article"]').first().text().trim() ||
      $("article h1").first().text().trim() ||
      $(".post-title").first().text().trim() ||
      $(".entry-title").first().text().trim() ||
      $(".article-title").first().text().trim() ||
      $(".story-title").first().text().trim() ||
      $(".headline").first().text().trim() ||
      $("h1").first().text().trim() ||
      $('[property="og:title"]').attr("content") ||
      $('[name="twitter:title"]').attr("content") ||
      $("title").text().trim() ||
      "Untitled Article"

    author =
      $('[rel="author"]').first().text().trim() ||
      $('[itemprop="author"]').first().text().trim() ||
      $('[property="article:author"]').first().attr("content") ||
      $(".author-name").first().text().trim() ||
      $(".byline").first().text().trim() ||
      $(".author").first().text().trim() ||
      $('[name="author"]').attr("content") ||
      $(".writer").first().text().trim() ||
      $(".journalist").first().text().trim() ||
      $('[data-author]').attr("data-author") ||
      ""

    publishDate =
      $('[itemprop="datePublished"]').first().attr("content") ||
      $('[property="article:published_time"]').first().attr("content") ||
      $('[name="date"]').attr("content") ||
      $('[name="pubdate"]').attr("content") ||
      $(".publish-date").first().text().trim() ||
      $(".post-date").first().text().trim() ||
      $(".entry-date").first().text().trim() ||
      $(".article-date").first().text().trim() ||
      $(".story-date").first().text().trim() ||
      $("time").first().attr("datetime") ||
      $("time").first().text().trim() ||
      ""

    const contentSelectors = [
      "article",
      '[role="article"]',
      '[role="main"]',
      '[itemprop="articleBody"]',
      ".post-content",
      ".entry-content", 
      ".article-content",
      ".article-body",
      ".post-body",
      ".story-body",
      ".blog-content",
      ".blog-post",
      ".content-body",
      ".post-full",
      ".article-full",
      ".single-content",
      ".single-post",
      ".page-content",
      ".text-content",
      ".story-content",
      ".entry-body",
      "main",
      "#content",
      "#main",
      "#article",
      "#post-content",
      "#entry-content",
      ".main-content",
      ".primary-content",
      ".Medium-article",
      ".articleBody",
      ".ArticleBody",
      ".postArticle-content",
      ".story__content",
      ".caas-body",
      ".entry-content-content",
    ]

    let bestContent = ""
    let bestScore = 0

    for (const selector of contentSelectors) {
      const elements = $(selector)
      if (elements.length > 0) {
        elements.each((_: number, el: cheerio.Element) => {
          const element = $(el)
          const text = cleanText(element.text())
          const score = calculateTextDensity(element, $)
          
          if (score > bestScore && text.length > 200) {
            bestScore = score
            bestContent = text
          }
        })
        
        if (bestContent.length > 300) {
          content = bestContent
          break
        }
      }
    }

    if (!content || content.length < 300) {
      const paragraphs: string[] = []
      const seenTexts = new Set<string>()
      
      $("p, div, section").each((_: number, el: cheerio.Element) => {
        const element = $(el)
        const text = cleanText(element.text())
        
        if (seenTexts.has(text.toLowerCase()) || text.length < 50) return
        seenTexts.add(text.toLowerCase())
        
        const lowerText = text.toLowerCase()
        if (
          lowerText.includes("copyright") ||
          lowerText.includes("subscribe") ||
          lowerText.includes("newsletter") ||
          lowerText.includes("follow us") ||
          lowerText.includes("share this") ||
          lowerText.includes("read more") ||
          lowerText.includes("click here") ||
          lowerText.includes("sign up") ||
          lowerText.includes("all rights reserved") ||
          lowerText.includes("privacy policy") ||
          lowerText.includes("terms of") ||
          lowerText.includes("cookie") ||
          lowerText.length < 80
        ) {
          return
        }
        
        const score = calculateTextDensity(element, $)
        if (score > 100 && text.length > 80) {
          paragraphs.push(text)
        }
      })
      
      const scoredParagraphs = paragraphs.map((p, index) => ({
        text: p,
        score: (p.length * 0.5) + (1000 / (index + 1))
      }))
      
      scoredParagraphs.sort((a, b) => b.score - a.score)
      content = cleanText(scoredParagraphs.slice(0, 20).map(p => p.text).join(" "))
    }

    if (!content || content.length < 100) {
      $("div, section").each((_: number, el: cheerio.Element) => {
        const element = $(el)
        const text = cleanText(element.text())
        const score = calculateTextDensity(element, $)
        
        if (score > bestScore && text.length > 200) {
          bestScore = score
          bestContent = text
        }
      })
      content = bestContent
    }

    if (!content || content.length < 100) {
      throw new Error("Could not extract sufficient content from the article. The page may require JavaScript rendering or the URL may not point to an article.")
    }

    return {
      title: title.substring(0, 200),
      content: content.substring(0, 10000),
      url: finalUrl,
      author: author.substring(0, 100),
      publishDate: publishDate.substring(0, 50),
      siteName: siteName.substring(0, 100),
    }
  } catch (error) {
    console.error("Content extraction error:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to extract content: ${error.message}`)
    }
    throw new Error("Failed to extract content from the provided URL")
  }
}

async function generateSummary(article: ArticleContent): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey || apiKey === "your_openai_api_key_here" || apiKey.startsWith("your_ope")) {
    console.log("OpenAI API key not configured, using fallback summarizer")
    return generateFallbackSummary(article)
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You are an expert content summarizer. Your task is to create clear, accurate, and concise summaries of articles and blog posts.

Guidelines:
- Create a summary that captures the main points and key insights
- Format as 4-6 bullet points for comprehensive coverage
- Each bullet point should be complete and informative (1-3 sentences)
- Focus on actionable insights, main arguments, and key findings
- Use simple, clear language that anyone can understand
- Prioritize quality over quantity
- Do NOT use numbered lists - use bullet points with "•" symbol
- Start each bullet with a strong keyword or phrase
- Avoid repeating information across bullet points
- If the article is about code or technical content, include key technical concepts
- For news articles, focus on the who, what, when, where, why
- For how-to articles, capture the main steps or key tips`,
      prompt: `Summarize the following article. Focus on the most important points and key insights:

${article.title ? `Title: ${article.title}` : ""}
${article.author ? `By: ${article.author}` : ""}
${article.publishDate ? `Published: ${article.publishDate}` : ""}
${article.siteName ? `Source: ${article.siteName}` : ""}
URL: ${article.url}

Content:
${article.content}

Provide a clean, well-structured summary with clear bullet points (using • symbol). Each point should capture a key insight or main point from the article.`,
      maxTokens: 1000,
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
  
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter((s) => s.length > 30 && s.length < 300)

  if (sentences.length === 0) {
    return `• Unable to generate summary from the provided content.\n• Title: ${article.title}\n• Source: ${article.url}\n\n— Summarized by Tahira Nawab`
  }

  const wordFreq: { [key: string]: number } = {}
  const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || []

  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "having", "do", "does", "did",
    "doing", "will", "would", "could", "should", "may", "might", "must",
    "shall", "can", "need", "this", "that", "these", "those", "what",
    "which", "who", "whom", "whose", "where", "when", "why", "how",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
    "us", "them", "my", "your", "his", "its", "our", "their", "mine",
    "yours", "hers", "ours", "theirs", "here", "there", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such",
    "no", "not", "only", "same", "so", "than", "too", "very", "just",
    "also", "now", "then", "once", "about", "after", "before", "between",
    "into", "through", "during", "above", "below", "up", "down", "out",
    "off", "over", "under", "again", "further", "then", "once", "any",
    "because", "before", "unless", "until", "while", "upon", "within",
    "without", "according", "however", "therefore", "otherwise", "else",
    "should", "could", "would", "might", "must", "shall", "get", "got",
    "going", "come", "came", "make", "made", "take", "took", "see", "saw",
    "know", "knew", "think", "thought", "want", "wanted", "use", "used",
    "find", "found", "give", "gave", "tell", "told", "say", "said",
    "that", "which", "their", "there", "been", "would", "could", "should",
    "when", "where", "who", "what", "why", "how", "some", "any", "many",
    "much", "most", "other", "such", "only", "own", "same", "than", "too",
    "very", "just", "also", "now", "here", "then", "still", "even", "back",
  ])

  words.forEach((word) => {
    if (!stopWords.has(word) && !/^\d+$/.test(word) && word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
  })

  const sentenceScores = sentences.map((sentence, index) => {
    const sentenceWords = sentence.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
    const uniqueWords = new Set(sentenceWords)
    let score = 0
    uniqueWords.forEach((word) => {
      if (!stopWords.has(word)) {
        score += wordFreq[word] || 0
      }
    })
    
    const normalizedScore = score * Math.min(1, sentence.length / 100)
    const positionBonus = 1 + (1 / (index + 1))
    
    return { 
      sentence: sentence.trim(), 
      score: normalizedScore * positionBonus 
    }
  })

  const topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(item => item.sentence)
    .filter((s) => s.length > 40)

  if (topSentences.length < 3) {
    const additionalSentences = sentences
      .filter(s => !topSentences.includes(s))
      .slice(0, 3 - topSentences.length)
    topSentences.push(...additionalSentences)
  }

  const uniqueSentences: string[] = []
  topSentences.forEach(sentence => {
    const isDuplicate = uniqueSentences.some(existing => {
      const similarity = calculateSimilarity(sentence, existing)
      return similarity > 0.7
    })
    if (!isDuplicate) {
      uniqueSentences.push(sentence)
    }
  })

  if (uniqueSentences.length === 0) {
    return `• This article discusses: ${article.title}\n• Content extracted from: ${article.url}\n• Summary generation requires OpenAI API key for detailed analysis.\n\n— Summarized by Tahira Nawab`
  }

  return uniqueSentences.map((sentence) => `• ${sentence}`).join("\n") + "\n\n— Summarized by Tahira Nawab"
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/))
  const words2 = new Set(str2.toLowerCase().split(/\s+/))
  
  let intersection = 0
  words1.forEach(word => {
    if (words2.has(word)) intersection++
  })
  
  const union = words1.size + words2.size - intersection
  return union > 0 ? intersection / union : 0
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 })
    }

    try {
      new URL(url)
    } catch {
      return NextResponse.json({ success: false, error: "Invalid URL format. Please include http:// or https://" }, { status: 400 })
    }

    const urlObj = new URL(url)
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return NextResponse.json({ success: false, error: "Only HTTP and HTTPS URLs are supported" }, { status: 400 })
    }

    const article = await extractArticleContent(url)
    
    if (!article.content || article.content.length < 100) {
      return NextResponse.json({ 
        success: false, 
        error: "Could not extract sufficient content from this URL. The page may not contain readable article content." 
      }, { status: 400 })
    }

    const summary = await generateSummary(article)

    return NextResponse.json({
      success: true,
      title: article.title,
      summary: summary,
    })
  } catch (error) {
    console.error("API error:", error)
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    
    let userMessage = errorMessage
    if (errorMessage.includes("fetch failed") || errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Could not reach the website. The URL may be invalid or the site may be blocking requests."
    } else if (errorMessage.includes("timeout")) {
      userMessage = "The website took too long to respond. Please try again or use a different URL."
    } else if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
      userMessage = "Access to this URL is forbidden. The site may be blocking automated requests."
    } else if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
      userMessage = "The requested page was not found. Please check the URL."
    }
    
    return NextResponse.json({ success: false, error: userMessage }, { status: 500 })
  }
}

