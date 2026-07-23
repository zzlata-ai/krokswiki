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

  normalizePath(base, sub) {
    if (!sub) return base === '/' ? '/' : base
    const cleanBase = base.replace(/^\/+|\/+$/g, '')
    const cleanSub = sub.replace(/^\/+|\/+$/g, '')
    return '/' + (cleanBase ? `${cleanBase}/${cleanSub}` : cleanSub).replace(/\/+/g, '/')
  }

  isIndexArticle(articlePath, folderName) {
    return articlePath === folderName || articlePath === 'index' || articlePath === 'README'
  }

  async readMarkdownFiles(folderPath) {
    const articles = []
    const files = await fs.readdir(folderPath)
    const mdFiles = files.filter(file => file.endsWith('.md'))

    for (const file of mdFiles) {
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
          sections.push({
            name: entry.name,
            displayName: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
            path: sectionPath,
            articleCount: mdFiles.length
          })
        }
      }
    }
    return sections
  }

  async getFolderStructure(folderPath, relativePath = '') {
    const structure = {
      name: path.basename(folderPath),
      path: folderPath,
      relativePath: relativePath,
      articles: [],
      subfolders: []
    }
    const entries = await fs.readdir(folderPath, { withFileTypes: true })

    // Собираем имена подпапок для фильтрации метафайлов
    const subfolderNames = new Set()
    for (const entry of entries) {
      if (entry.name === 'uploads') continue
      if (entry.isDirectory()) subfolderNames.add(entry.name)
    }

    for (const entry of entries) {
      if (entry.name === 'uploads') continue
      const entryPath = path.join(folderPath, entry.name)

      if (entry.isFile() && entry.name.endsWith('.md')) {
        // ПРОПУСКАЕМ файлы, которые являются метафайлами подразделов
        // (они будут обработаны через processSubfolderMetaFile)
        const fileNameWithoutExt = path.basename(entry.name, '.md')
        if (subfolderNames.has(fileNameWithoutExt)) {
          console.log(`  ⏭️ Пропущен метафайл подраздела: ${entry.name} (будет обработан отдельно)`)
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
        const subStructure = await this.getFolderStructure(entryPath, subRelative)
        structure.subfolders.push(subStructure)
      }
    }
    return structure
  }

  async createPage(pagePath, title, content, description = '', tags = [], locale = 'ru', isPublished = true, isPrivate = false, editor = 'markdown') {
    const mutation = `mutation CreatePage($content: String!, $description: String!, $editor: String!, $isPublished: Boolean!, $isPrivate: Boolean!, $locale: String!, $path: String!, $tags: [String]!, $title: String!) {
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
          responseResult { succeeded errorCode slug message }
          page { id path title }
        }
      }
    }`
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
    const mutation = `mutation UpdatePage($id: Int!, $content: String!, $description: String!, $editor: String!, $isPublished: Boolean!, $locale: String!, $tags: [String]!, $title: String!) {
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
          responseResult { succeeded errorCode slug message }
          page { id path title }
        }
      }
    }`
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
    console.log(`Путь: ${wikiPath}`)
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

  async processSubfolderMetaFile(subfolder, baseWikiPath, sectionName, locale) {
    const subfolderPath = subfolder.path
    const subfolderName = subfolder.name
    const parentFolder = path.dirname(subfolderPath)
    const metaFilePath = path.join(parentFolder, `${subfolderName}.md`)

    let metaSuccess = false
    try {
      await fs.access(metaFilePath)
      console.log(`\n   Метафайл подраздела: ${subfolderName}.md`)
      const content = await fs.readFile(metaFilePath, 'utf8')
      const parsed = matter(content)
      const title = parsed.data.title || parsed.data.name || subfolderName
      const description = (parsed.data.description || parsed.data.summary || '')
      const tags = ['kroks', 'docs', sectionName, ...(parsed.data.tags || [])]
      // Для метафайлов НЕ удаляем дублирующийся H1
      const fullContent = parsed.content

      const targetWikiPath = this.normalizePath(baseWikiPath, subfolderName)

      metaSuccess = await this.createOrUpdatePage(
        targetWikiPath,
        title,
        fullContent,
        description,
        tags,
        locale
      )
      console.log(metaSuccess
        ? `    ✅ Метафайл подраздела "${subfolderName}" перенесён → ${targetWikiPath}`
        : `     Ошибка переноса метафайла "${subfolderName}"`)
    } catch {
      console.log(`\n    ⚠️ Метафайл "${subfolderName}.md" не найден — страница подраздела не создаётся`)
    }

    return metaSuccess
  }

  async processFolderStructure(structure, baseWikiPath, sectionName, locale) {
    let successCount = 0
    let failCount = 0
    const folderWikiPath = baseWikiPath

    // 1. Создаем/обновляем статьи в текущей папке
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

    // 2. Рекурсивно обрабатываем вложенные папки
    for (const subfolder of structure.subfolders) {
      // Сначала обрабатываем метафайл подраздела (если есть)
      const metaSuccess = await this.processSubfolderMetaFile(
        subfolder,
        baseWikiPath,
        sectionName,
        locale
      )

      // Затем рекурсивно обрабатываем содержимое подраздела
      const subResult = await this.processFolderStructure(
        subfolder,
        this.normalizePath(baseWikiPath, subfolder.name),
        sectionName,
        locale
      )

      successCount += subResult.successCount + (metaSuccess ? 1 : 0)
      failCount += subResult.failCount
    }
    return { successCount, failCount }
  }

  async generateSectionPage(sectionName, sectionPath, baseWikiPath, locale) {
    console.log(`\n═══════════════════════════════════════`)
    console.log(`Обработка раздела: ${sectionName}`)
    console.log(`═══════════════════════════════════════`)

    const docsFolder = path.dirname(sectionPath)
    const targetWikiPath = this.normalizePath(baseWikiPath, sectionName)

    // ══════════════════════════════════════════════════
    // Обработка метафайла раздела (одноимённый .md)
    // Сохраняем контент БЕЗ очистки H1 заголовка
    // ═══════════════════════════════════════════════════
    const metaFilePath = path.join(docsFolder, `${sectionName}.md`)
    let metaSuccess = false
    try {
      await fs.access(metaFilePath)
      console.log(`\n Метафайл раздела: ${sectionName}.md`)
      const content = await fs.readFile(metaFilePath, 'utf8')
      const parsed = matter(content)
      const title = parsed.data.title || parsed.data.name || sectionName
      const description = (parsed.data.description || parsed.data.summary || '')
      const tags = ['kroks', 'docs', sectionName, ...(parsed.data.tags || [])]
      // ВАЖНО: Для метафайлов разделов НЕ удаляем дублирующийся H1
      const fullContent = parsed.content

      metaSuccess = await this.createOrUpdatePage(
        targetWikiPath,
        title,
        fullContent,
        description,
        tags,
        locale
      )
      console.log(metaSuccess
        ? `  ✅ Метафайл раздела "${sectionName}" перенесён → ${targetWikiPath}`
        : `   Ошибка переноса метафайла "${sectionName}"`)
    } catch {
      console.log(`\n  ️ Метафайл "${sectionName}.md" не найден — страница раздела не создаётся`)
    }
    // ══════════════════════════════════════════════════

    // Обработка статей внутри папки раздела
    const structure = await this.getFolderStructure(sectionPath, sectionName)
    const result = await this.processFolderStructure(structure, targetWikiPath, sectionName, locale)

    // Добавляем успех метафайла в общую статистику
    result.successCount += metaSuccess ? 1 : 0

    return result
  }

  async generateAll(docsFolder, baseWikiPath, locale) {
    console.log('═══════════════════════════════════════')
    console.log('  Генерация документации (с метафайлами разделов)')
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

    console.log('\n═══════════════════════════════════════')
    console.log(`  Итого: ${totalSuccess} страниц успешно, ${totalFail} с ошибками`)
    console.log('═══════════════════════════════════════')
  }

  async generateSingleSection(sectionName, docsFolder, baseWikiPath, locale) {
    console.log('═══════════════════════════════════════')
    console.log(`Генерация раздела: ${sectionName}`)
    console.log('═══════════════════════════════════════')

    const sectionPath = path.join(docsFolder, sectionName)
    try {
      await fs.access(sectionPath)
    } catch {
      console.error(`\n❌ Папка не найдена: ${sectionPath}`)
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
    console.error('❌ Укажите WIKI_URL и API_TOKEN в файле .env')
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
