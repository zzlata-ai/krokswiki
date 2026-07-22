<template lang='pug'>
  v-app
    // === ЛОГИКА РАЗДЕЛА ===
    .section-view(v-if='isSection')
      v-container.pl-5.pt-4(fluid, grid-list-xl)
        v-layout(row)
          v-flex(xs12)
            v-card.mb-5.elevation-1
              v-card-title.headline
                v-icon.mr-3(color='orange') mdi-folder-open
                span Раздел: {{ sectionTitle }}
              v-card-text
                p.grey--text.mb-4 Выберите подраздел или статью из списка:

                v-list(two-line, rounded, tile)
                  template(v-for='(subpage, index) in sectionPages')
                    v-list-item(
                      :key='subpage.path'
                      :href='`/${subpage.path}`'
                      style='text-decoration: none; color: inherit; border-radius: 8px; margin-bottom: 8px; transition: background 0.2s;'
                    )
                      v-list-item-avatar
                        v-icon(:color='subpage.isFolder ? "orange" : "blue"') {{ subpage.isFolder ? "mdi-folder" : "mdi-file-document-outline" }}
                      v-list-item-content
                        v-list-item-title(:class='$vuetify.theme.dark ? "white--text" : "grey--text text--darken-4"') {{ subpage.title }}
                        v-list-item-subtitle {{ subpage.path }}
                    v-divider(v-if='index < sectionPages.length - 1')

                v-alert(v-if='sectionPages.length === 0', type='info', text, outlined)
                  | В этом разделе пока нет статей или подразделов.

    // === СТАНДАРТНЫЙ ЭКРАН СОЗДАНИЯ СТРАНИЦЫ ===
    .newpage(v-else-if='!isLoading')
      .newpage-content
        img.animated.fadeIn(src='/_assets/svg/icon-delete-file.svg', alt='Not Found')
        .headline {{ $t('newpage.title') }}
        .subtitle-1.mt-3 {{ $t('newpage.subtitle') }}
        v-btn.mt-5(:href='`/e/` + locale + `/` + path', x-large)
          v-icon(left) mdi-plus
          span {{ $t('newpage.create') }}
        v-btn.mt-5(color='purple lighten-3', href='javascript:window.history.go(-1);', outlined)
          v-icon(left) mdi-arrow-left
          span {{ $t('newpage.goback') }}
</template>

<script>
export default {
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    }
  },
  data() {
    return {
      isSection: false,
      sectionPages: [],
      isLoading: true,
      allPages: []
    }
  },
  computed: {
    sectionTitle() {
      const parts = this.path.split('/').filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1].replace(/-/g, ' ') : 'Раздел'
    }
  },
  async created() {
    await this.checkIfSection()
  },
  methods: {
    async checkIfSection() {
      const currentPath = this.path.replace(/^\//, '').replace(/\/$/, '')
      console.log('Проверка раздела:', currentPath, 'locale:', this.locale)

      if (!currentPath || currentPath === 'home') {
        this.isLoading = false
        return
      }

      try {
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query { pages { list(locale: "${this.locale}", limit: 500) { id path title } } }`
          })
        })

        if (response.status === 200) {
          const result = await response.json()

          if (result.data && result.data.pages && result.data.pages.list) {
            this.allPages = result.data.pages.list
            console.log('Все страницы из API:', this.allPages)

            // Собираем содержимое текущего раздела
            this.collectSectionContent(currentPath)
          }
        } else {
          console.error('GraphQL ответил с ошибкой:', response.status)
        }
      } catch (e) {
        console.error('❌ Ошибка при проверке раздела:', e)
      } finally {
        this.isLoading = false
      }
    },

    collectSectionContent(currentPath) {
      const currentParts = currentPath.split('/').filter(Boolean)
      const currentLevel = currentParts.length // На каком уровне текущий раздел (1, 2, 3...)
      const searchPrefix = currentPath + '/'
      const addedPaths = new Set()
      const sectionPagesMap = new Map()

      console.log(`Текущий раздел: ${currentPath}, уровень: ${currentLevel}`)

      // Проходим по всем страницам
      this.allPages.forEach(page => {
        if (!page.path.startsWith(searchPrefix)) return

        const cleanPath = page.path.replace(/^\/+/, '')
        const parts = cleanPath.split('/').filter(Boolean)
        const pageLevel = parts.length

        // Нам нужны только прямые потомки текущего раздела
        // Если текущий раздел на уровне N, то нужны страницы уровня N+1
        const expectedLevel = currentLevel + 1

        let targetPath, targetTitle, isFolder

        if (pageLevel === expectedLevel) {
          // Прямой потомок - добавляем как есть
          targetPath = page.path
          targetTitle = page.title || parts[parts.length - 1].replace(/-/g, ' ')
          isFolder = false // Пока не знаем
        } else if (pageLevel > expectedLevel) {
          // Глубокая вложенность - добавляем родителя нужного уровня
          const targetParts = parts.slice(0, expectedLevel)
          targetPath = targetParts.join('/')

          // Ищем, есть ли отдельная страница для этого подраздела
          const subSectionPage = this.allPages.find(p => {
            const cleanP = p.path.replace(/^\/+/, '')
            return cleanP === targetPath
          })

          if (subSectionPage) {
            targetTitle = subSectionPage.title
            isFolder = true // У этого подраздела есть дочерние страницы
          } else {
            targetTitle = targetParts[targetParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            isFolder = true
          }
        }

        // Добавляем только если ещё не добавлен
        if (!addedPaths.has(targetPath)) {
          addedPaths.add(targetPath)
          sectionPagesMap.set(targetPath, {
            title: targetTitle,
            path: targetPath,
            isFolder: isFolder
          })
        }
      })

      // Проверяем, у каких элементов есть потомки
      sectionPagesMap.forEach((item, path) => {
        const hasChildren = this.allPages.some(p => {
          const cleanP = p.path.replace(/^\/+/, '')
          const parts = cleanP.split('/').filter(Boolean)
          if (parts.length <= currentLevel + 1) return false
          const itemParts = path.split('/').filter(Boolean)
          return parts.slice(0, itemParts.length).join('/') === path
        })

        if (hasChildren) {
          item.isFolder = true
        }
      })

      // Преобразуем Map в массив и сортируем
      this.sectionPages = Array.from(sectionPagesMap.values())
      this.sectionPages.sort((a, b) => {
        // Сначала папки, потом статьи
        if (a.isFolder !== b.isFolder) {
          return a.isFolder ? -1 : 1
        }
        return a.title.localeCompare(b.title, 'ru')
      })

      console.log('✅ Раздел найден! Показываем:', this.sectionPages)

      if (this.sectionPages.length > 0) {
        this.isSection = true
      }
    }
  }
}
</script>

<style lang='scss'>
.section-view {
  min-height: 100vh;
  padding-top: 64px;
}
</style>
