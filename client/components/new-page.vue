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

        v-btn.mt-5(:href='`/e/` + locale + "/" + path', x-large)
          v-icon(left) mdi-plus
          span {{ $t('newpage.create') }}

        v-btn.mt-5(color='purple lighten-3', href='javascript:window.history.go(-1);', outlined)
          v-icon(left) mdi-arrow-left
          span {{ $t('newpage.goback') }}

    // ==========================================================
    // === ГАРАНТИРОВАННАЯ HTML ИНЪЕКЦИЯ (Body) ===
    // Размещена вне всех v-if / v-else, чтобы рендериться ВСЕГДА
    // ==========================================================

    // 1. Основной блок инъекции (отобразится, только если в injectBody есть текст)
    div(v-if='injectBody', v-html='injectBody')

    // === ФУТЕР ===
    Footer
</template>

<script>
import Footer from '../components/Footer.vue'

export default {
  components: {
    Footer
  },

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
    },
    injectBody() {
      // Максимально надежная проверка всех возможных путей в Vuex Store
      const val =
        this.$store.state.site?.config?.injectBody ||
        this.$store.state.config?.injectBody ||
        this.$store.state.injectBody ||
        ''

      // 🔍 ОТЛАДКА: Обязательно откройте консоль браузера (F12) и посмотрите вывод
      console.log('🔍 [new-page.vue] Значение injectBody:', val)
      console.log('🔍 [new-page.vue] Содержимое store.state:', this.$store.state)

      return val
    }
  },
  async created() {
    await this.checkIfSection()
  },
  methods: {
    async checkIfSection() {
      const currentPath = this.path.replace(/^\//, '').replace(/\/$/, '')

      if (!currentPath || currentPath === 'home') {
        this.isLoading = false
        return
      }

      try {
        // Исправлено: добавлены обратные кавычки ` ` для шаблонной строки
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query { pages { list(locale: "${this.locale}", limit: 500) { id path title } } }`
          })
        })

        if (response.status === 200) {
          const result = await response.json()
          if (result.data?.pages?.list) {
            this.allPages = result.data.pages.list
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
      const currentLevel = currentParts.length
      const searchPrefix = currentPath + '/'
      const addedPaths = new Set()
      const sectionPagesMap = new Map()

      this.allPages.forEach(page => {
        if (!page.path.startsWith(searchPrefix)) return

        const cleanPath = page.path.replace(/^\/+/, '')
        const parts = cleanPath.split('/').filter(Boolean)
        const pageLevel = parts.length
        const expectedLevel = currentLevel + 1
        let targetPath, targetTitle, isFolder

        if (pageLevel === expectedLevel) {
          targetPath = page.path
          targetTitle = page.title || parts[parts.length - 1].replace(/-/g, ' ')
          isFolder = false
        } else if (pageLevel > expectedLevel) {
          const targetParts = parts.slice(0, expectedLevel)
          targetPath = targetParts.join('/')

          const subSectionPage = this.allPages.find(p => {
            const cleanP = p.path.replace(/^\/+/, '')
            return cleanP === targetPath
          })

          if (subSectionPage) {
            targetTitle = subSectionPage.title
            isFolder = true
          } else {
            targetTitle = targetParts[targetParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            isFolder = true
          }
        }

        if (!addedPaths.has(targetPath)) {
          addedPaths.add(targetPath)
          sectionPagesMap.set(targetPath, {
            title: targetTitle,
            path: targetPath,
            isFolder: isFolder
          })
        }
      })

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

      this.sectionPages = Array.from(sectionPagesMap.values())
      this.sectionPages.sort((a, b) => {
        if (a.isFolder !== b.isFolder) {
          return a.isFolder ? -1 : 1
        }
        return a.title.localeCompare(b.title, 'ru')
      })

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
  padding-bottom: 100px !important; /* Отступ для футера */
}
</style>
