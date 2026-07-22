import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import fetch from 'node-fetch'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class KroksWikiGenerator {
  constructor(wikiUrl, apiToken) {
    this.wikiUrl = wikiUrl.replace(/\/$/, '')
    this.apiToken = apiToken
    this.graphqlEndpoint = `${this.wikiUrl}/graphql`

    this.headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  }

  ignoreDuplicateH1(content, title) {
    if (!title || !content) return content

    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`^\\s*#\\s+${escapedTitle}\\s*\\n+`, 'i')

    return content.replace(regex, '')
  }

  async readSectionMeta(parentFolderPath, folderName) {
    const metaFilePath = path.join(parentFolderPath, `${folderName}.md`)

    try {
      const metaContent = await fs.readFile(metaFilePath, 'utf8')
      const metaParsed = matter(metaContent)
      return {
        name: metaParsed.data.name || folderName,
        img: metaParsed.data.img || null,
        description: metaParsed.data.description || ''
      }
    } catch (e) {
      return {
        name: folderName.charAt(0).toUpperCase() + folderName.slice(1),
        img: null,
        description: ''
      }
    }
  }

  normalizePath(base, sub) {
    if (!sub) return base === '/' ? '/' : base
    const cleanBase = base.replace(/^\/+|\/+$/g, '')
    const cleanSub = sub.replace(/^\/+|\/+$/g, '')
    return '/' + (cleanBase ? `${cleanBase}/${cleanSub}` : cleanSub).replace(/\/+/g, '/')
  }

  isIndexArticle(articlePath, folderName) {
    return articlePath === folderName || articlePath === 'index' || articlePath === 'README'
  }

  // Картинки на главной странице
  async getCategoryImage(categoryName) {
    const uploadedImageUrls = {
      'Антенны': '/sections/antenny.png',
      'Приборы': '/sections/pribory.png',
      'Репитеры': '/sections/repitery.png',
      'Роутеры': '/sections/routery.png',
      'antenny': '/sections/antenny.png',
      'pribory': '/sections/pribory.png',
      'repitery': '/sections/repitery.png',
      'routery': '/sections/routery.png',
      'router': '/sections/routery.png'
    }

    const relativeUrl = uploadedImageUrls[categoryName] || uploadedImageUrls[categoryName.toLowerCase()]

    if (relativeUrl) {
      const fullUrl = `${this.wikiUrl}${relativeUrl}`
      console.log(`     Используем изображение: ${fullUrl}`)
      return fullUrl
    }

    console.log(`    Изображение для "${categoryName}" не найдено`)
    return null
  }

  async readMarkdownFiles(folderPath) {
    const articles = []
    const files = await fs.readdir(folderPath)
    const mdFiles = files.filter(file => file.endsWith('.md'))

    const subfolders = new Set()
    for (const file of files) {
      const filePath = path.join(folderPath, file)
      try {
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
          subfolders.add(file)
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }

    for (const file of mdFiles) {
      const fileNameWithoutExt = path.basename(file, '.md')
      if (subfolders.has(fileNameWithoutExt)) {
        continue
      }

      try {
        const filePath = path.join(folderPath, file)
        const content = await fs.readFile(filePath, 'utf8')
        const parsed = matter(content)
        const title = parsed.data.title || parsed.data.name || path.basename(file, '.md')

        articles.push({
          name: parsed.data.name || title,
          title: title,
          description: parsed.data.description || parsed.data.summary || '',
          path: path.basename(file, '.md'),
          content: this.ignoreDuplicateH1(parsed.content, title),
          tags: parsed.data.tags || []
        })
        console.log(`  ✓ ${file}`)
      } catch (error) {
        console.error(`   Ошибка чтения ${file}:`, error.message)
      }
    }
    return articles
  }

  async getAllSections(docsFolder) {
    const sections = []
    const entries = await fs.readdir(docsFolder, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name === 'uploads') {
        continue
      }

      if (entry.isDirectory()) {
        const sectionPath = path.join(docsFolder, entry.name)
        const mdFiles = (await fs.readdir(sectionPath)).filter(f => f.endsWith('.md'))

        if (mdFiles.length > 0) {
          const meta = await this.readSectionMeta(docsFolder, entry.name)

          sections.push({
            name: entry.name,
            displayName: meta.name,
            img: meta.img,
            description: meta.description,
            path: sectionPath,
            articleCount: mdFiles.length
          })
        }
      }
    }
    return sections
  }

  async getFolderStructure(folderPath, relativePath = '', parentFolderPath = null) {
    const structure = {
      name: path.basename(folderPath),
      path: folderPath,
      relativePath: relativePath,
      articles: [],
      subfolders: [],
      subfolderCards: []
    }

    if (parentFolderPath) {
      const meta = await this.readSectionMeta(parentFolderPath, structure.name)
      structure.displayName = meta.name
      structure.img = meta.img
      structure.description = meta.description
    }

    const entries = await fs.readdir(folderPath, { withFileTypes: true })

    const subfolderNames = new Set()
    for (const entry of entries) {
      if (entry.name === 'uploads') {
        continue
      }

      if (entry.isDirectory()) {
        subfolderNames.add(entry.name)
      }
    }

    for (const entry of entries) {
      if (entry.name === 'uploads') {
        continue
      }

      const entryPath = path.join(folderPath, entry.name)

      if (entry.isFile() && entry.name.endsWith('.md')) {
        const fileNameWithoutExt = path.basename(entry.name, '.md')
        if (subfolderNames.has(fileNameWithoutExt)) {
          continue
        }

        try {
          const content = await fs.readFile(entryPath, 'utf8')
          const parsed = matter(content)
          const title = parsed.data.title || parsed.data.name || path.basename(entry.name, '.md')

          structure.articles.push({
            name: parsed.data.name || title,
            title: title,
            description: parsed.data.description || parsed.data.summary || '',
            path: path.basename(entry.name, '.md'),
            content: this.ignoreDuplicateH1(parsed.content, title),
            tags: parsed.data.tags || []
          })
        } catch (error) {
          console.error(`   Ошибка чтения ${entry.name}:`, error.message)
        }
      } else if (entry.isDirectory()) {
        const subRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name
        const subStructure = await this.getFolderStructure(entryPath, subRelative, folderPath)
        structure.subfolders.push(subStructure)

        structure.subfolderCards.push({
          name: subStructure.displayName || subStructure.name,
          path: subStructure.name,
          description: subStructure.description || ''
        })
      }
    }
    return structure
  }

  generateUnifiedCardsContent(articles, subfolderCards, basePath = '', folderName = '') {
    const allItems = []

    subfolderCards.forEach(card => {
      allItems.push({
        type: 'folder',
        name: card.name,
        description: card.description,
        url: this.normalizePath(basePath, card.path)
      })
    })

    articles.forEach(article => {
      const articlePath = this.isIndexArticle(article.path, folderName) ? '' : article.path
      allItems.push({
        type: 'article',
        name: article.name,
        description: article.description,
        url: this.normalizePath(basePath, articlePath)
      })
    })

    let content = '\n<div class="cards-grid">\n'

    allItems.forEach(item => {
      const buttonText = item.type === 'folder' ? 'Перейти в раздел →' : 'Читать статью →'

      content += `\n<div class="card">\n\n`
      content += `### ${item.name}\n\n`
      content += `${item.description}\n\n`
      content += `[${buttonText}](${item.url})\n\n`
      content += `</div>\n`
    })

    content += '\n</div>\n'
    return content
  }

  async createPage(pagePath, title, content, description = '', tags = [], locale = 'ru', isPublished = true, isPrivate = false, editor = 'markdown') {
    const mutation = `
      mutation CreatePage($content: String!, $description: String!, $editor: String!,
                        $isPublished: Boolean!, $isPrivate: Boolean!, $locale: String!,
                        $path: String!, $tags: [String]!, $title: String!) {
        pages {
          create(
            content: $content,
            description: $description,
            editor: $editor,
            isPublished: $isPublished,
            isPrivate: $isPrivate,
            locale: $locale,
            path: $path,
            tags: $tags,
            title: $title
          ) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
            page {
              id
              path
              title
            }
          }
        }
      }
    `

    const variables = {
      content,
      description,
      editor,
      isPublished,
      isPrivate,
      locale,
      path: pagePath,
      tags,
      title
    }

    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: mutation, variables })
      })
      const result = await response.json()
      if (result.errors) {
        console.error('  GraphQL ошибки:', JSON.stringify(result.errors))
        return null
      }
      return result
    } catch (error) {
      console.error('  HTTP ошибка:', error.message)
      return null
    }
  }

  async updatePage(pageId, title, content, description = '', tags = [], locale = 'ru', isPublished = true, editor = 'markdown') {
    const mutation = `
      mutation UpdatePage($id: Int!, $content: String!, $description: String!,
                        $editor: String!, $isPublished: Boolean!, $locale: String!,
                        $tags: [String]!, $title: String!) {
        pages {
          update(
            id: $id,
            content: $content,
            description: $description,
            editor: $editor,
            isPublished: $isPublished,
            locale: $locale,
            tags: $tags,
            title: $title
          ) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
            page {
              id
              path
              title
            }
          }
        }
      }
    `

    const variables = {
      id: pageId,
      content,
      description,
      editor,
      isPublished,
      locale,
      tags,
      title
    }
    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: mutation, variables })
      })
      return await response.json()
    } catch (error) {
      console.error('  HTTP ошибка:', error.message)
      return null
    }
  }

  async getPageByPath(pagePath, locale = 'ru') {
    const pathVariants = [
      pagePath,
      pagePath.replace(/^\//, ''),
      '/' + pagePath.replace(/^\//, '')
    ]

    for (const testPath of pathVariants) {
      const query = `
        query PageByPath($path: String!, $locale: String!) {
          pages {
            single(path: $path, locale: $locale) {
              id
              path
              title
              content
            }
          }
        }
      `

      try {
        const response = await fetch(this.graphqlEndpoint, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            query,
            variables: { path: testPath, locale }
          })
        })

        const result = await response.json()

        if (result.data && result.data.pages && result.data.pages.single) {
          return result.data.pages.single
        }
      } catch (error) {
        console.error('  HTTP ошибка:', error.message)
      }
    }

    try {
      const allPagesQuery = `
        query {
          pages {
            list {
              id
              path
              title
              locale
            }
          }
        }
      `

      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: allPagesQuery })
      })

      const result = await response.json()

      if (result.data && result.data.pages && result.data.pages.list) {
        const normalizedPath = pagePath.replace(/^\//, '')
        const found = result.data.pages.list.find(p => {
          const pNormalized = p.path.replace(/^\//, '')
          return pNormalized === normalizedPath && p.locale === locale
        })

        if (found) {
          console.log(`    Найдена через список страниц: ${found.path} (ID: ${found.id})`)
          return { id: found.id, path: found.path, title: found.title }
        }
      }
    } catch (error) {
      console.error('  HTTP ошибка при поиске:', error.message)
    }

    return null
  }

  async createOrUpdatePage(wikiPath, title, content, description = '', tags = [], locale = 'ru') {
    const existingPage = await this.getPageByPath(wikiPath, locale)

    if (existingPage) {
      console.log(`    Найдена существующая страница (ID: ${existingPage.id}). Обновление...`)

      const result = await this.updatePage(
        existingPage.id,
        title,
        content,
        description,
        tags,
        locale
      )

      if (result && result.data && result.data.pages.update && result.data.pages.update.responseResult.succeeded) {
        console.log(`    Страница успешно обновлена: ${wikiPath}`)
        return true
      } else {
        console.error(`    Ошибка обновления:`, result?.errors || result?.data?.pages?.update?.responseResult?.message || 'неизвестно')
        return false
      }
    }

    console.log(`   ➕ Создание новой страницы`)
    const result = await this.createPage(wikiPath, title, content, description, tags, locale)

    if (result && result.data && result.data.pages.create) {
      const pageData = result.data.pages.create
      if (pageData.responseResult.succeeded) {
        console.log(`    Страница создана: ${wikiPath}`)
        return true
      } else {
        console.error(`    Ошибка: ${pageData.responseResult.message || 'неизвестно'}`)
        return false
      }
    } else {
      console.error(`    Неожиданный ответ от GraphQL:`, result?.errors || result)
      return false
    }
  }

  async createArticlePage(article, wikiPath, sectionName, locale) {
    console.log(`\n📄 Статья: ${article.name}`)
    console.log(`   Путь: ${wikiPath}`)

    const fullContent = article.content
    const description = (article.description || '').length > 240 ?
      (article.description || '').substring(0, 240) + '...' :
      article.description || ''
    const tags = ['kroks', 'docs', sectionName, ...(article.tags || [])]

    return await this.createOrUpdatePage(
      wikiPath,
      article.title,
      fullContent,
      description,
      tags,
      locale
    )
  }

  async processFolderStructure(structure, baseWikiPath, sectionName, locale) {
    let successCount = 0
    let failCount = 0

    const folderWikiPath = baseWikiPath

    if (structure.articles.length > 0 || structure.subfolderCards.length > 0) {
      const title = structure.displayName || structure.name.charAt(0).toUpperCase() + structure.name.slice(1)

      console.log(`\n📁 Раздел: ${title}`)
      console.log(`   Путь: ${structure.path}`)
      console.log(`   Найдено статей: ${structure.articles.length}`)
      console.log(`   Найдено подразделов: ${structure.subfolderCards.length}`)

      const fullContent = this.generateUnifiedCardsContent(
        structure.articles,
        structure.subfolderCards,
        folderWikiPath,
        structure.name
      )

      const success = await this.createOrUpdatePage(
        folderWikiPath,
        title,
        fullContent,
        structure.description || `Раздел документации: ${title}`,
        ['kroks', 'docs', sectionName, structure.name],
        locale
      )

      if (success) successCount++
      else failCount++

      for (const article of structure.articles) {
        const articlePath = this.isIndexArticle(article.path, structure.name) ? '' : article.path
        const articleWikiPath = this.normalizePath(folderWikiPath, articlePath)

        const articleSuccess = await this.createArticlePage(
          article,
          articleWikiPath,
          sectionName,
          locale
        )

        if (articleSuccess) successCount++
        else failCount++
      }
    }

    for (const subfolder of structure.subfolders) {
      const subResult = await this.processFolderStructure(
        subfolder,
        this.normalizePath(baseWikiPath, subfolder.name),
        sectionName,
        locale
      )
      successCount += subResult.successCount
      failCount += subResult.failCount
    }

    return { successCount, failCount }
  }

  async generateSectionPage(sectionName, sectionPath, baseWikiPath, locale) {
    console.log(`\n═══════════════════════════════════════`)
    console.log(`  Раздел: ${sectionName}`)
    console.log(`═══════════════════════════════════════`)

    const docsFolder = path.dirname(sectionPath)
    const structure = await this.getFolderStructure(sectionPath, sectionName, docsFolder)
    const targetWikiPath = this.normalizePath(baseWikiPath, sectionName)

    return await this.processFolderStructure(structure, targetWikiPath, sectionName, locale)
  }

  async generateMainIndexPage(sections, baseWikiPath, locale) {
    const wikiPath = '/home'
    const title = 'Документация Kroks'

    console.log(`\n Главная страница документации (путь: ${wikiPath})`)

    const docsFolder = process.env.DOCS_FOLDER || path.join(__dirname, 'kroks-docs')

    let content = '\n<div class="cards-grid">\n'

    for (const section of sections) {
      const sectionPath = path.join(docsFolder, section.name)
      const sectionUrl = this.normalizePath(baseWikiPath, section.name)

      const structure = await this.getFolderStructure(sectionPath, section.name, docsFolder)

      const sectionImage = await this.getCategoryImage(structure.displayName || section.displayName || section.name)
      const sectionTitle = structure.displayName || section.displayName || section.name

      content += `<div class="card">\n`
      content += `<div class="card-content">\n`
      content += `<div class="card-header">\n`
      content += `<h3 class="card-title"><a href="${sectionUrl}" class="category-link">${sectionTitle}</a></h3>\n`
      content += `</div>\n`

      const allItems = []

      structure.subfolderCards.forEach(subfolder => {
        allItems.push({
          type: 'folder',
          name: subfolder.name,
          url: this.normalizePath(sectionUrl, subfolder.path)
        })
      })

      structure.articles.forEach(article => {
        const articlePath = this.isIndexArticle(article.path, structure.name) ? '' : article.path
        allItems.push({
          type: 'article',
          name: article.name,
          url: this.normalizePath(sectionUrl, articlePath)
        })
      })

      if (allItems.length > 0) {
        content += `<ul class="card-article-list">\n`
        for (const item of allItems) {
          content += `<li><a href="${item.url}" class="article-link">${item.name}</a></li>\n`
        }
        content += `</ul>\n`
      }

      content += `</div>\n`

      if (sectionImage) {
        content += `<div class="card-image-container">\n`
        content += `<img src="${sectionImage}" alt="${sectionTitle}" class="card-image" />\n`
        content += `</div>\n`
      }

      content += `</div>\n`
    }

    content += '\n</div>\n'

    console.log(' Обновление главной страницы...')
    return await this.createOrUpdatePage(
      wikiPath,
      title,
      content,
      'Главная страница документации Kroks',
      ['kroks', 'docs', 'index'],
      locale
    )
  }

  async generateAll(docsFolder, baseWikiPath, locale) {
    console.log('═══════════════════════════════════════')
    console.log('  Генерация всех разделов документации')
    console.log('═══════════════════════════════════════')

    const sections = await this.getAllSections(docsFolder)

    if (sections.length === 0) {
      console.log('\n⚠️ Разделы не найдены!')
      return
    }

    console.log(`\nНайдено разделов: ${sections.length}`)
    sections.forEach(s => console.log(`  - ${s.displayName} (${s.articleCount} статей)`))

    let totalSuccess = 0
    let totalFail = 0

    for (const section of sections) {
      const result = await this.generateSectionPage(
        section.name,
        section.path,
        baseWikiPath,
        locale
      )

      totalSuccess += result.successCount
      totalFail += result.failCount
    }

    const mainSuccess = await this.generateMainIndexPage(sections, baseWikiPath, locale)
    if (mainSuccess) totalSuccess++
    else totalFail++

    console.log('\n═══════════════════════════════════════')
    console.log(`  Итого: ${totalSuccess} успешно, ${totalFail} с ошибками`)
    console.log('═══════════════════════════════════════')
  }

  async generateSingleSection(sectionName, docsFolder, baseWikiPath, locale) {
    console.log('═══════════════════════════════════════')
    console.log(`  Генерация раздела: ${sectionName}`)
    console.log('═══════════════════════════════════════')

    const sectionPath = path.join(docsFolder, sectionName)

    try {
      await fs.access(sectionPath)
    } catch {
      console.error(`\n Папка не найдена: ${sectionPath}`)
      return
    }

    await this.generateSectionPage(sectionName, sectionPath, baseWikiPath, locale)
  }
}

async function main() {
  const wikiUrl = process.env.WIKI_URL
  const apiToken = process.env.API_TOKEN
  const docsFolder = process.env.DOCS_FOLDER || path.join(__dirname, 'kroks-docs')

  const baseWikiPath = process.env.BASE_WIKI_PATH || '/'
  const locale = process.env.LOCALE || 'ru'

  if (!wikiUrl || !apiToken) {
    console.error(' Укажите WIKI_URL и API_TOKEN в файле .env')
    process.exit(1)
  }

  const generator = new KroksWikiGenerator(wikiUrl, apiToken)

  const args = process.argv.slice(2)

  if (args.includes('--all')) {
    await generator.generateAll(docsFolder, baseWikiPath, locale)
  } else if (args.includes('--section')) {
    const sectionName = args[args.length - 1]
    if (!sectionName || sectionName.startsWith('--')) {
      console.error(' Укажите имя раздела: npm run generate:section -- antenny')
      process.exit(1)
    }
    await generator.generateSingleSection(sectionName, docsFolder, baseWikiPath, locale)
  } else {
    await generator.generateAll(docsFolder, baseWikiPath, locale)
  }
}

main().catch(console.error)
